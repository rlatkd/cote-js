// judgeprobe — 개발용 제출 주입기. api 배선 전까지 파이프라인 전체(번들 업로드 →
// 제출 발행 → judged 채점 → 결과 소비)를 손으로 흘려보내는 도구다.
//
//	judgeprobe -bundle <dir> -source <풀이.py> [-lane submit] [-problem 1000]
//
// 하는 일: 번들 디렉토리를 tar.gz로 묶어 sha256을 계산하고 MinIO에 올린 뒤,
// 그 참조(claim-check)를 담은 Submission을 제출 토픽에 발행하고 결과를 기다린다.
package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/twmb/franz-go/pkg/kgo"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	judgev1 "github.com/rlatkd/cotejs/services/judge/gen/judge/v1"
	"github.com/rlatkd/cotejs/services/judge/internal/messaging"
)

func main() {
	bundleDir := flag.String("bundle", "", "테스트케이스 번들 디렉토리 (cases/NN.in|out)")
	source := flag.String("source", "", "제출 소스 파일(.py)")
	lane := flag.String("lane", "submit", "QoS 레인: run|submit|batch")
	problemID := flag.Int64("problem", 1000, "문제 id")
	submissionID := flag.Int64("submission", time.Now().Unix(), "제출 id(결과 매칭 키)")
	timeMS := flag.Uint("time-ms", 1000, "시간 제한(ms)")
	memMB := flag.Uint("mem-mb", 256, "메모리 제한(MB)")
	wait := flag.Duration("wait", 90*time.Second, "결과 대기 시간")
	noWait := flag.Bool("no-wait", false, "발행만 하고 결과를 기다리지 않음(레인 우선순위 검증 등)")
	flag.Parse()

	if *bundleDir == "" || *source == "" {
		flag.Usage()
		os.Exit(2)
	}
	topic, ok := map[string]string{
		"run":    messaging.TopicRun,
		"submit": messaging.TopicSubmit,
		"batch":  messaging.TopicBatch,
	}[*lane]
	if !ok {
		fmt.Fprintln(os.Stderr, "lane은 run|submit|batch 중 하나")
		os.Exit(2)
	}

	ctx := context.Background()
	code, err := os.ReadFile(*source)
	must(err, "소스 읽기")

	key, sum, err := uploadBundle(ctx, *bundleDir)
	must(err, "번들 업로드")
	fmt.Printf("번들 업로드: %s (sha256 %s…)\n", key, sum[:12])

	client, err := kgo.NewClient(
		kgo.SeedBrokers(env("KAFKA_BROKERS", "localhost:9092")),
		kgo.ConsumeTopics(messaging.TopicResult),
		// 소비 그룹 없이 지금 시점 이후만 본다 — 과거 결과에 반응하지 않게.
		kgo.ConsumeResetOffset(kgo.NewOffset().AtEnd()),
	)
	must(err, "kafka 연결")
	defer client.Close()

	payload, err := proto.Marshal(&judgev1.Submission{
		SubmissionId:     *submissionID,
		ProblemId:        *problemID,
		Language:         "python",
		SourceCode:       string(code),
		TimeLimitMs:      uint32(*timeMS),
		MemoryLimitMb:    uint32(*memMB),
		TestBundleKey:    key,
		TestBundleSha256: sum,
		SubmittedAt:      timestamppb.Now(),
	})
	must(err, "직렬화")

	must(client.ProduceSync(ctx, &kgo.Record{
		Topic: topic,
		Key:   []byte(fmt.Sprint(*submissionID)),
		Value: payload,
	}).FirstErr(), "제출 발행")
	if *noWait {
		fmt.Printf("제출 발행(대기 없음): topic=%s submission_id=%d\n", topic, *submissionID)
		return
	}
	fmt.Printf("제출 발행: topic=%s submission_id=%d — 결과 대기…\n", topic, *submissionID)

	waitCtx, cancel := context.WithTimeout(ctx, *wait)
	defer cancel()
	for {
		fetches := client.PollFetches(waitCtx)
		if err := fetches.Err(); err != nil {
			fmt.Fprintln(os.Stderr, "결과 대기 실패/타임아웃:", err)
			os.Exit(1)
		}
		var done bool
		fetches.EachRecord(func(r *kgo.Record) {
			var res judgev1.JudgeResult
			if err := proto.Unmarshal(r.Value, &res); err != nil || res.SubmissionId != *submissionID {
				return
			}
			out, _ := json.MarshalIndent(protoResultView(&res), "", "  ")
			fmt.Println(string(out))
			done = true
		})
		if done {
			return
		}
	}
}

type resultView struct {
	SubmissionID int64      `json:"submission_id"`
	Verdict      string     `json:"verdict"`
	ExecTimeMS   uint32     `json:"exec_time_ms"`
	MemoryUsedKB uint32     `json:"memory_used_kb"`
	Cases        []string   `json:"cases"`
	Error        string     `json:"error,omitempty"`
	JudgedAt     *time.Time `json:"judged_at,omitempty"`
}

func protoResultView(r *judgev1.JudgeResult) resultView {
	cases := make([]string, 0, len(r.Cases))
	for _, c := range r.Cases {
		cases = append(cases, fmt.Sprintf("#%d %s %dms %dKB", c.No, c.Verdict, c.ExecTimeMs, c.MemoryUsedKb))
	}
	v := resultView{
		SubmissionID: r.SubmissionId,
		Verdict:      r.Verdict.String(),
		ExecTimeMS:   r.ExecTimeMs,
		MemoryUsedKB: r.MemoryUsedKb,
		Cases:        cases,
		Error:        r.ErrorMessage,
	}
	if r.JudgedAt != nil {
		t := r.JudgedAt.AsTime()
		v.JudgedAt = &t
	}
	return v
}

// uploadBundle은 디렉토리를 tar.gz로 묶어 MinIO에 올리고 (키, sha256)을 돌려준다.
// 키에 해시를 넣어 내용이 바뀌면 키도 바뀌게 한다(불변 오브젝트).
func uploadBundle(ctx context.Context, dir string) (string, string, error) {
	var buf bytes.Buffer
	if err := writeTarGz(&buf, dir); err != nil {
		return "", "", err
	}
	sum := sha256.Sum256(buf.Bytes())
	hexSum := hex.EncodeToString(sum[:])
	key := fmt.Sprintf("bundles/%s.tgz", hexSum)

	client, err := minio.New(env("MINIO_ENDPOINT", "localhost:9000"), &minio.Options{
		Creds: credentials.NewStaticV4(
			env("MINIO_ACCESS_KEY", "cotejs"), env("MINIO_SECRET_KEY", "cotejs-dev"), ""),
	})
	if err != nil {
		return "", "", err
	}
	bucket := env("MINIO_BUCKET", "testdata")
	_, err = client.PutObject(ctx, bucket, key, bytes.NewReader(buf.Bytes()), int64(buf.Len()),
		minio.PutObjectOptions{ContentType: "application/gzip"})
	if err != nil {
		return "", "", err
	}
	return key, hexSum, nil
}

func writeTarGz(w io.Writer, dir string) error {
	gz := gzip.NewWriter(w)
	tw := tar.NewWriter(gz)

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		// 아카이브 내부 경로는 항상 슬래시 — 재현 가능한 해시를 위해 모드·시각도 고정.
		if err := tw.WriteHeader(&tar.Header{
			Name: filepath.ToSlash(rel),
			Mode: 0o644,
			Size: int64(len(data)),
		}); err != nil {
			return err
		}
		_, err = tw.Write(data)
		return err
	})
	if err != nil {
		return err
	}
	if err := tw.Close(); err != nil {
		return err
	}
	return gz.Close()
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func must(err error, what string) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s 실패: %v\n", what, err)
		if strings.Contains(err.Error(), "connection refused") {
			fmt.Fprintln(os.Stderr, "  → infra가 떠 있는지 확인: cd infra && docker compose up -d")
		}
		os.Exit(1)
	}
}
