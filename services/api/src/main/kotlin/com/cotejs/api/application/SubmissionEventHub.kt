package com.cotejs.api.application

import com.cotejs.api.domain.model.Submission
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.core.publisher.Sinks

/**
 * 제출 상태 변화의 팬아웃 지점 — 제출 접수·채점 완료를 구독자(web SSE)에게 밀어준다.
 *
 * **인프로세스 브로드캐스트인 이유**: 지금 api는 단일 인스턴스다. 여러 인스턴스로
 * 늘어나면 결과를 소비한 인스턴스에 붙은 구독자만 알림을 받게 되므로 그때
 * Redis pub/sub으로 바꾼다([ADR-0006] — M2 스케일아웃 범위). 임시 상태임을 TODO에 추적.
 */
@Component
class SubmissionEventHub {
    // 구독자가 없을 때의 이벤트는 버린다(SSE는 현재 상태 알림이지 이력 저장소가 아니다).
    private val sink = Sinks.many().multicast().directBestEffort<Submission>()

    fun publish(submission: Submission) {
        sink.tryEmitNext(submission)
    }

    fun stream(): Flux<Submission> = sink.asFlux()
}
