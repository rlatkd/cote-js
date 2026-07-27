package com.cotejs.api.adapter.inbound.messaging

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
import java.time.LocalDateTime
import java.time.ZoneId
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

        runCatching {
            apply.apply(
                JudgedOutcome(
                    submissionId = message.submissionId,
                    result = message.verdict.toDomain(),
                    // 미측정(컴파일 에러 등)은 0으로 오지만 0ms 실행은 없으므로 null로 본다.
                    execTimeMs = message.execTimeMs.takeIf { it > 0 },
                    memoryUsedKb = message.memoryUsedKb.takeIf { it > 0 },
                    judgedAt = message.judgedAt.toLocalDateTime(),
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
 * 계약(proto Timestamp)은 UTC epoch지만 DB의 TIMESTAMP 컬럼은 시스템 로컬 시각으로
 * 쓰이고 있다(`submittedAt = LocalDateTime.now()`). 그래서 로컬존으로 변환해 맞춘다 —
 * UTC 그대로 저장하면 같은 행의 submittedAt/judgedAt이 9시간 어긋난다(실제로 겪음).
 *
 * 알려진 부채: 타임존은 애초에 UTC(`timestamptz`)로 통일하고 표시에서만 변환하는 게 옳다
 * (docs/architecture/data-model.md).
 */
internal fun com.google.protobuf.Timestamp.toLocalDateTime(): LocalDateTime =
    LocalDateTime.ofInstant(Instant.ofEpochSecond(seconds, nanos.toLong()), ZoneId.systemDefault())
