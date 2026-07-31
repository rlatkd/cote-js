package com.cotejs.api.application

import com.cotejs.api.domain.model.Submission
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.ReactiveStringRedisTemplate
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import tools.jackson.databind.ObjectMapper

/**
 * 제출 상태 변화의 팬아웃 지점 — 제출 접수·채점 완료를 구독자(web SSE)에게 밀어준다.
 * 인터페이스인 이유: 정책 테스트가 발행을 관찰하는 대역을 끼우기 위해(인프라 흉내 아님).
 */
interface SubmissionEventHub {
    fun publish(submission: Submission)

    fun stream(): Flux<Submission>
}

/**
 * Redis pub/sub 팬아웃([ADR-0006]·M2) — 인프로세스 Sinks를 대체한다.
 *
 * 왜 바꿨나: 다중 인스턴스에서 결과를 소비한 인스턴스에 붙은 구독자만 알림을 받는 문제
 * (연결이라는 상태는 인스턴스에 붙지만, 이벤트는 어느 인스턴스로든 들어온다). Redis 채널을
 * 거치면 모든 인스턴스의 구독자에게 도달한다 — 단일 인스턴스에서도 동작은 동일.
 *
 * 실패 모드: Redis가 내려가면 알림만 유실된다(채점·저장은 무관). SSE는 이력이 아니라
 * 알림이고 web은 목록 조회로 현재 상태를 복구하므로 수용(발행 실패는 로그만).
 */
@Component
class RedisSubmissionEventHub(
    private val redis: ReactiveStringRedisTemplate,
    private val json: ObjectMapper,
) : SubmissionEventHub {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun publish(submission: Submission) {
        redis.convertAndSend(CHANNEL, json.writeValueAsString(submission))
            .doOnError { log.warn("SSE 팬아웃 발행 실패(알림만 유실 — 목록 조회로 복구): {}", it.message) }
            .onErrorComplete()
            .subscribe()
    }

    override fun stream(): Flux<Submission> =
        redis.listenToChannel(CHANNEL)
            .map { json.readValue(it.message, Submission::class.java) }

    companion object {
        private const val CHANNEL = "submission.events"
    }
}
