package com.cotejs.api.adapter.outbound.messaging

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.TraceContext
import com.cotejs.contracts.common.v1.TraceContext as TraceMessage
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.port.outbound.ExecutionLane
import com.cotejs.api.domain.port.outbound.JudgeDispatcher
import com.google.protobuf.Timestamp
import kotlinx.coroutines.suspendCancellableCoroutine
import org.apache.kafka.clients.producer.Producer
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.clients.producer.RecordMetadata
import org.springframework.stereotype.Component
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
// 계약 메시지와 도메인 모델이 같은 이름이라 별칭으로 구분한다.
import com.cotejs.contracts.judge.v1.Submission as SubmissionMessage

/**
 * 채점 요청 발행 — QoS 3레인([ADR-0006])은 토픽 분리로 구현돼 있으므로
 * 레인 선택 = 토픽 선택이다.
 */
@Component
class KafkaJudgeDispatcher(
    private val producer: Producer<String, ByteArray>,
) : JudgeDispatcher {

    override suspend fun dispatch(
        submission: Submission,
        problem: Problem,
        bundle: BundleRef,
        code: String,
        lane: ExecutionLane,
        trace: TraceContext,
    ) {
        val message = SubmissionMessage.newBuilder()
            .setSubmissionId(submission.id)
            .setProblemId(problem.id)
            // judge의 언어 식별자는 소문자 슬러그다(러너 이미지 선택 키).
            .setLanguage(submission.language.label.lowercase())
            .setSourceCode(code)
            .setTimeLimitMs(problem.timeLimitMs)
            .setMemoryLimitMb(problem.memoryLimitMb)
            .setTestBundleKey(bundle.key)
            .setTestBundleSha256(bundle.sha256)
            .setSubmittedAt(submission.submittedAt.toProtoTimestamp())
            // 흐름 식별자를 실어 보낸다 — judge의 로그가 같은 trace_id를 들고 남는다.
            .setTrace(
                TraceMessage.newBuilder()
                    .setTraceId(trace.traceId)
                    .setSpanId(trace.spanId)
                    .apply { trace.parentSpanId?.let { setParentSpanId(it) } }
                    .build(),
            )
            .build()

        val record = ProducerRecord(
            lane.topic(),
            // 같은 제출은 같은 파티션으로 — 순서가 필요한 단위가 제출이다.
            submission.id.toString(),
            message.toByteArray(),
        )
        producer.sendAndAwait(record)
    }
}

/**
 * 자바 프로듀서의 콜백을 코루틴으로 잇는다 — `send()`는 이미 비동기라
 * 스레드를 붙잡지 않고, 브로커 확인(acks=all)이 오면 재개된다.
 */
private suspend fun Producer<String, ByteArray>.sendAndAwait(
    record: ProducerRecord<String, ByteArray>,
): RecordMetadata = suspendCancellableCoroutine { cont ->
    send(record) { metadata, error ->
        if (error != null) cont.resumeWithException(error) else cont.resume(metadata)
    }
}

internal fun ExecutionLane.topic(): String = when (this) {
    ExecutionLane.RUN -> "submission.run"
    ExecutionLane.SUBMIT -> "submission.submit"
    ExecutionLane.BATCH -> "submission.batch"
}

/** Instant → proto Timestamp. 양쪽 다 절대시각이라 존 해석이 없다(ADR-0013). */
internal fun java.time.Instant.toProtoTimestamp(): Timestamp =
    Timestamp.newBuilder().setSeconds(epochSecond).setNanos(nano).build()
