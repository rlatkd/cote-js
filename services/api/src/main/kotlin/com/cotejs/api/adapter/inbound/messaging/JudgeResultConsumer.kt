package com.cotejs.api.adapter.inbound.messaging

import com.cotejs.api.domain.model.CaseResult
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.port.inbound.ApplyJudgeOutcome
import com.cotejs.contracts.judge.v1.Verdict
import com.google.protobuf.InvalidProtocolBufferException
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.common.errors.WakeupException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant
import com.cotejs.contracts.judge.v1.JudgeResult as JudgeResultMessage

/**
 * 채점 결과 소비 — judge가 발행한 결과를 DB에 반영하고 SSE로 밀어준다([ADR-0006] 이음새).
 *
 * Kafka 자바 컨슈머의 `poll()`은 블로킹이고 **스레드 안전하지 않다**. 그래서 전용
 * 단일 스레드 디스패처에 가둔다 — 이렇게 하면 이벤트 루프(WebFlux) 스레드를 막지 않으면서
 * 컨슈머의 단일 스레드 요구도 지킨다. 반영 자체는 suspend 유스케이스를 그대로 호출한다.
 */
@Component
class JudgeResultConsumer(
    private val consumer: KafkaConsumer<String, ByteArray>,
    private val apply: ApplyJudgeOutcome,
    @Value("\${cotejs.kafka.result-topic}") private val topic: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    private val pollDispatcher = Dispatchers.IO.limitedParallelism(1)
    private val scope = CoroutineScope(SupervisorJob() + pollDispatcher)

    @EventListener(ApplicationReadyEvent::class)
    fun start() {
        scope.launch {
            consumer.subscribe(listOf(topic))
            log.info("채점 결과 컨슈머 기동: {}", topic)
            try {
                while (isActive) {
                    val records = withContext(pollDispatcher) {
                        consumer.poll(Duration.ofMillis(500))
                    }
                    if (records.isEmpty) continue

                    for (record in records) handle(record)

                    // 반영을 마친 뒤 커밋(at-least-once) — 커밋 후 죽으면 결과가 유실된다.
                    withContext(pollDispatcher) { consumer.commitSync() }
                }
            } catch (_: WakeupException) {
                // 종료 신호 — 정상 경로
            } catch (e: Exception) {
                log.error("결과 컨슈머 중단", e)
            }
        }
    }

    private suspend fun handle(record: ConsumerRecord<String, ByteArray>) {
        val message = try {
            JudgeResultMessage.parseFrom(record.value())
        } catch (e: InvalidProtocolBufferException) {
            // poison message — 재시도해도 같은 결과이므로 건너뛴다(파티션을 막지 않는다).
            log.error("결과 메시지 파싱 실패 — 건너뜀 (offset {})", record.offset(), e)
            return
        }

        // 실패는 이제 구조화돼 온다 — 수신자가 문자열을 보고 추측하지 않는다(ADR-0017).
        if (message.hasFailure()) {
            val failure = message.failure
            log.warn(
                "채점 실패 수신: submission={} code={} origin={} retryable={} trace={}",
                message.submissionId, failure.code, failure.origin, failure.retryable,
                message.trace.traceId,
            )
        } else {
            // 정상 결과도 trace를 들고 남긴다 — 제출 한 건을 web→api→judge→api 로그로
            // 끝까지 따라가려면 모든 구간이 같은 키를 찍어야 한다(ADR-0017).
            log.info(
                "채점 결과 수신: submission={} verdict={} trace={}",
                message.submissionId, message.verdict, message.trace.traceId,
            )
        }

        runCatching {
            apply.apply(
                JudgedOutcome(
                    submissionId = message.submissionId,
                    result = message.verdict.toDomain(),
                    // 미측정(컴파일 에러 등)은 0으로 오지만 0ms 실행은 없으므로 null로 본다.
                    execTimeMs = message.execTimeMs.takeIf { it > 0 },
                    memoryUsedKb = message.memoryUsedKb.takeIf { it > 0 },
                    judgedAt = message.judgedAt.toInstant(),
                    // 케이스별 결과 — "몇 번에서 틀렸나"를 보여주려면 종합만으론 부족하다.
                    cases = message.casesList.map {
                        CaseResult(
                            no = it.no,
                            result = it.verdict.toDomain(),
                            execTimeMs = it.execTimeMs.takeIf { ms -> ms > 0 },
                            memoryUsedKb = it.memoryUsedKb.takeIf { kb -> kb > 0 },
                        )
                    },
                ),
            )
        }.onFailure { e ->
            // 반영 실패는 일시적일 수 있다(DB 장애 등). 지금은 커밋이 진행되어 이 결과가 유실된다 —
            // 재처리가 필요해지면 DLQ·재시도 정책을 도입한다(TODO).
            log.error("채점 결과 반영 실패: submission {}", message.submissionId, e)
        }
    }

    @PreDestroy
    fun stop() {
        consumer.wakeup() // poll() 블로킹 해제
        scope.cancel()
    }
}

internal fun Verdict.toDomain(): JudgeResult = when (this) {
    Verdict.VERDICT_ACCEPTED -> JudgeResult.ACCEPTED
    Verdict.VERDICT_WRONG_ANSWER -> JudgeResult.WRONG_ANSWER
    Verdict.VERDICT_COMPILE_ERROR -> JudgeResult.COMPILE_ERROR
    Verdict.VERDICT_RUNTIME_ERROR -> JudgeResult.RUNTIME_ERROR
    Verdict.VERDICT_TIME_LIMIT_EXCEEDED -> JudgeResult.TIME_LIMIT
    Verdict.VERDICT_MEMORY_LIMIT_EXCEEDED -> JudgeResult.MEMORY_LIMIT
    // UNSPECIFIED는 계약 위반(발행자 버그)이라 시스템 오류로 다룬다.
    Verdict.VERDICT_INTERNAL_ERROR, Verdict.VERDICT_UNSPECIFIED, Verdict.UNRECOGNIZED ->
        JudgeResult.INTERNAL_ERROR
}

/**
 * proto Timestamp(UTC epoch) → Instant. **변환이 아니라 그대로 옮기는 것**이다 —
 * 양쪽 다 절대시각이라 존 해석이 끼어들 여지가 없다(ADR-0013).
 */
internal fun com.google.protobuf.Timestamp.toInstant(): Instant =
    Instant.ofEpochSecond(seconds, nanos.toLong())
