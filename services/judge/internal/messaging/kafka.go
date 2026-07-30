// Package messaging — Kafka 어댑터. 제출 3레인(QoS)을 소비하고 결과를 발행한다.
// 계약은 Protobuf(contracts/proto/judge/v1) — 생성 코드는 services/judge/gen.
package messaging

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "github.com/rlatkd/cotejs/services/judge/gen/common/v1"
	judgev1 "github.com/rlatkd/cotejs/services/judge/gen/judge/v1"
	"github.com/rlatkd/cotejs/services/judge/internal/domain"
)

// QoS 3레인 — 레인을 토픽으로 분리했다(ADR-0006). 우선순위는 소비 정책으로 구현한다.
const (
	TopicRun    = "submission.run"
	TopicSubmit = "submission.submit"
	TopicBatch  = "submission.batch"
	TopicResult = "submission.result"
)

// 레인 우선순위 — 낮을수록 먼저. batch(AI 검증 대량 실행)가 유저 제출을 굶기지 않게 한다.
var lanePriority = map[string]int{TopicRun: 0, TopicSubmit: 1, TopicBatch: 2}

// Judger는 채점 코어(executor)를 가리키는 최소 인터페이스 — 이 패키지가 executor에
// 의존하지 않게 해 방향을 (어댑터 → 도메인)으로 유지한다.
type Judger interface {
	Judge(ctx context.Context, task domain.Task) (domain.JudgeResult, error)
}

// BundleFetcher는 claim-check 참조를 로컬 경로로 바꿔 준다(MinIO 어댑터가 구현).
type BundleFetcher interface {
	Fetch(ctx context.Context, key, sha256 string) (string, error)
}

type Worker struct {
	client  *kgo.Client
	judger  Judger
	bundles BundleFetcher
	log     *slog.Logger
}

type Config struct {
	Brokers []string
	GroupID string
}

func NewWorker(cfg Config, judger Judger, bundles BundleFetcher, log *slog.Logger) (*Worker, error) {
	client, err := kgo.NewClient(
		kgo.SeedBrokers(cfg.Brokers...),
		kgo.ConsumeTopics(TopicRun, TopicSubmit, TopicBatch),
		kgo.ConsumerGroup(cfg.GroupID),
		// 오프셋은 채점 완료 후 수동 커밋한다 — 자동 커밋이면 채점 도중 죽었을 때
		// 이미 커밋된 제출이 유실된다. 수동 커밋 = at-least-once(중복 채점은 허용,
		// 유실은 불허). 중복 결과는 api가 submission_id로 멱등 처리한다.
		kgo.DisableAutoCommit(),
		kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()),
	)
	if err != nil {
		return nil, err
	}
	return &Worker{client: client, judger: judger, bundles: bundles, log: log}, nil
}

func (w *Worker) Close() { w.client.Close() }

// Run은 컨텍스트가 끝날 때까지 소비→채점→결과 발행을 반복한다.
func (w *Worker) Run(ctx context.Context) error {
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		fetches := w.client.PollFetches(ctx)
		if errs := fetches.Errors(); len(errs) > 0 {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			for _, e := range errs {
				w.log.Error("fetch 실패", "topic", e.Topic, "err", e.Err)
			}
			continue
		}

		// 한 번에 받은 레코드를 레인 우선순위로 정렬해 처리한다. 한 폴에 run과 batch가
		// 섞여 오면 run을 먼저 — 인터랙티브 요청의 대기시간을 배치 뒤에 세우지 않는다.
		var records []*kgo.Record
		fetches.EachRecord(func(r *kgo.Record) { records = append(records, r) })
		sortByLane(records)

		for _, rec := range records {
			w.handle(ctx, rec)
		}

		// 처리한 만큼만 커밋(위 DisableAutoCommit 참조).
		if err := w.client.CommitUncommittedOffsets(ctx); err != nil {
			w.log.Error("오프셋 커밋 실패", "err", err)
		}
	}
}

func sortByLane(records []*kgo.Record) {
	// 레코드 수가 폴 단위(수십)라 단순 삽입 정렬로 충분하고, 안정 정렬이라
	// 같은 레인 안에서는 도착 순서가 보존된다.
	for i := 1; i < len(records); i++ {
		for j := i; j > 0 && lanePriority[records[j].Topic] < lanePriority[records[j-1].Topic]; j-- {
			records[j], records[j-1] = records[j-1], records[j]
		}
	}
}

func (w *Worker) handle(ctx context.Context, rec *kgo.Record) {
	var msg judgev1.Submission
	if err := proto.Unmarshal(rec.Value, &msg); err != nil {
		// 역직렬화 실패는 재시도해도 같다(poison message) — 로그만 남기고 넘긴다.
		w.log.Error("제출 메시지 파싱 실패 — 건너뜀", "topic", rec.Topic, "offset", rec.Offset, "err", err)
		return
	}

	// 채점 1건 = 스팬 1개. 부모는 ① Kafka 헤더의 W3C traceparent(표준 경로)
	// ② 없으면 proto 페이로드의 TraceContext(계약 경로)로 복원한다.
	ctx = extractParent(ctx, rec, msg.GetTrace())
	ctx, span := otel.Tracer("judge").Start(ctx, "judge "+rec.Topic,
		oteltrace.WithSpanKind(oteltrace.SpanKindConsumer),
		oteltrace.WithAttributes(
			attribute.Int64("submission.id", msg.SubmissionId),
			attribute.String("submission.lane", rec.Topic),
			attribute.String("submission.language", msg.Language),
		),
	)
	defer span.End()

	// 추적 컨텍스트를 로그에 싣는다 — 서비스를 건너 한 흐름을 이어보려면
	// 로그가 같은 키를 들고 있어야 한다(ADR-0017).
	log := w.log.With(
		"submission_id", msg.SubmissionId,
		"lane", rec.Topic,
		"trace_id", span.SpanContext().TraceID().String(),
	)
	started := time.Now()
	// 시작도 남긴다 — 완료 로그만 있으면 채점이 멈췄을 때 "받긴 했는지"를 알 수 없다.
	log.Info("채점 시작", "language", msg.Language)

	result, err := w.judge(ctx, &msg)
	if err != nil {
		// 시스템 장애 — 결과는 INTERNAL_ERROR로 보낸다. 결과를 안 보내면 사용자의
		// 화면이 영원히 "채점 중"에 머문다(침묵이 최악의 실패 모드).
		log.Error("채점 장애", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, "채점 장애")
	}
	span.SetAttributes(attribute.String("submission.verdict", string(result.Verdict)))
	log.Info("채점 완료", "verdict", result.Verdict, "took", time.Since(started))

	if err := w.publish(ctx, result, msg.GetTrace()); err != nil {
		log.Error("결과 발행 실패", "err", err)
		span.RecordError(err)
	}
}

// extractParent — 원격 부모 추적 복원. proto 경로는 trace_id·span_id만 있으면 충분하다.
func extractParent(ctx context.Context, rec *kgo.Record, tc *commonv1.TraceContext) context.Context {
	ctx = otel.GetTextMapPropagator().Extract(ctx, recordCarrier{rec})
	if oteltrace.SpanContextFromContext(ctx).IsValid() {
		return ctx
	}
	traceID, err1 := oteltrace.TraceIDFromHex(tc.GetTraceId())
	spanID, err2 := oteltrace.SpanIDFromHex(tc.GetSpanId())
	if err1 != nil || err2 != nil {
		return ctx // 부모 없음 — 여기서 새 추적이 시작된다
	}
	return oteltrace.ContextWithRemoteSpanContext(ctx, oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: oteltrace.FlagsSampled,
		Remote:     true,
	}))
}

// recordCarrier — kgo.Record 헤더를 OTel 전파 규약(TextMap)에 맞춘 운반자.
type recordCarrier struct{ rec *kgo.Record }

func (c recordCarrier) Get(key string) string {
	for _, h := range c.rec.Headers {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}

func (c recordCarrier) Set(key, val string) {
	for i, h := range c.rec.Headers {
		if h.Key == key {
			c.rec.Headers[i].Value = []byte(val)
			return
		}
	}
	c.rec.Headers = append(c.rec.Headers, kgo.RecordHeader{Key: key, Value: []byte(val)})
}

func (c recordCarrier) Keys() []string {
	keys := make([]string, 0, len(c.rec.Headers))
	for _, h := range c.rec.Headers {
		keys = append(keys, h.Key)
	}
	return keys
}

func (w *Worker) judge(ctx context.Context, msg *judgev1.Submission) (domain.JudgeResult, error) {
	fail := func(err error) (domain.JudgeResult, error) {
		return domain.JudgeResult{
			SubmissionID: msg.SubmissionId,
			Verdict:      domain.VerdictInternalError,
			ErrorMessage: err.Error(),
		}, err
	}

	dir, err := w.bundles.Fetch(ctx, msg.TestBundleKey, msg.TestBundleSha256)
	if err != nil {
		return fail(fmt.Errorf("테스트 번들 확보 실패: %w", err))
	}

	return w.judger.Judge(ctx, domain.Task{
		SubmissionID:  msg.SubmissionId,
		Language:      msg.Language,
		SourceCode:    msg.SourceCode,
		TimeLimitMS:   msg.TimeLimitMs,
		MemoryLimitMB: msg.MemoryLimitMb,
		BundleDir:     dir,
	})
}

func (w *Worker) publish(ctx context.Context, result domain.JudgeResult, trace *commonv1.TraceContext) error {
	payload, err := proto.Marshal(toProto(result, trace))
	if err != nil {
		return err
	}
	rec := &kgo.Record{
		Topic: TopicResult,
		// 같은 제출의 결과는 같은 파티션으로 — 순서 보장이 필요한 단위가 제출이다.
		Key:   []byte(fmt.Sprint(result.SubmissionID)),
		Value: payload,
	}
	// 결과에도 추적 헤더를 실어 api 결과 컨슈머 스팬이 같은 추적으로 이어지게 한다.
	otel.GetTextMapPropagator().Inject(ctx, recordCarrier{rec})
	return w.client.ProduceSync(ctx, rec).FirstErr()
}

func toProto(r domain.JudgeResult, trace *commonv1.TraceContext) *judgev1.JudgeResult {
	cases := make([]*judgev1.CaseResult, 0, len(r.Cases))
	for _, c := range r.Cases {
		cases = append(cases, &judgev1.CaseResult{
			No:           uint32(c.No),
			Verdict:      verdictToProto(c.Verdict),
			ExecTimeMs:   c.ExecTimeMS,
			MemoryUsedKb: c.MemoryUsedKB,
		})
	}
	return &judgev1.JudgeResult{
		SubmissionId: r.SubmissionID,
		Verdict:      verdictToProto(r.Verdict),
		ExecTimeMs:   r.ExecTimeMS,
		MemoryUsedKb: r.MemoryUsedKB,
		Cases:        cases,
		//nolint:staticcheck // 소비자 전환 기간 동안 구 필드도 함께 채운다(ADR-0017)
		ErrorMessage: r.ErrorMessage,
		JudgedAt:     timestamppb.Now(),
		Failure:      failureToProto(r),
		// 제출 메시지의 흐름을 그대로 이어받는다 — 새로 만들면 실이 끊긴다.
		Trace: trace,
	}
}

// failureToProto — 실패를 **수신자가 판단할 수 있는 형태**로 옮긴다.
// 정상 판정(오답·시간초과 등 유저 코드에 대한 평가)은 실패가 아니다: 채점은 성공했다.
func failureToProto(r domain.JudgeResult) *commonv1.Error {
	switch r.Verdict {
	case domain.VerdictCompileError:
		return &commonv1.Error{
			Code:      "COMPILE_FAILED",
			Message:   "제출 코드를 컴파일할 수 없습니다",
			Origin:    commonv1.FaultOrigin_FAULT_ORIGIN_CALLER,
			Retryable: false, // 같은 코드를 다시 보내도 결과가 같다
			Detail:    r.ErrorMessage,
		}
	case domain.VerdictInternalError:
		return &commonv1.Error{
			Code:      "JUDGE_INTERNAL_ERROR",
			Message:   "채점 시스템 오류로 판정할 수 없습니다",
			Origin:    commonv1.FaultOrigin_FAULT_ORIGIN_PROVIDER,
			Retryable: true, // 일시적 장애일 수 있다 — 재채점이 의미 있다
			Detail:    r.ErrorMessage,
		}
	default:
		return nil
	}
}

func verdictToProto(v domain.Verdict) judgev1.Verdict {
	switch v {
	case domain.VerdictAccepted:
		return judgev1.Verdict_VERDICT_ACCEPTED
	case domain.VerdictWrongAnswer:
		return judgev1.Verdict_VERDICT_WRONG_ANSWER
	case domain.VerdictCompileError:
		return judgev1.Verdict_VERDICT_COMPILE_ERROR
	case domain.VerdictRuntimeError:
		return judgev1.Verdict_VERDICT_RUNTIME_ERROR
	case domain.VerdictTimeLimitExceeded:
		return judgev1.Verdict_VERDICT_TIME_LIMIT_EXCEEDED
	case domain.VerdictMemoryLimitExceeded:
		return judgev1.Verdict_VERDICT_MEMORY_LIMIT_EXCEEDED
	case domain.VerdictInternalError:
		return judgev1.Verdict_VERDICT_INTERNAL_ERROR
	default:
		return judgev1.Verdict_VERDICT_UNSPECIFIED
	}
}
