package com.cotejs.api.adapter.inbound.web

import com.cotejs.api.application.SubmissionEventHub
import com.cotejs.api.domain.model.TraceContext
import com.cotejs.api.domain.port.inbound.ProblemQueries
import com.cotejs.api.domain.port.inbound.SubmissionQueries
import com.cotejs.api.domain.port.inbound.SubmitCode
import jakarta.validation.Valid
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.reactive.asFlow
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

// 인바운드 웹 어댑터 — suspend 핸들러(WebFlux + 코루틴).
// 전역 prefix(/api)는 spring.webflux.base-path가 담당한다.

@RestController
@RequestMapping("/problems")
class ProblemController(
    private val problems: ProblemQueries,
) {
    @GetMapping
    suspend fun list(): List<ProblemResponse> = problems.all().map(ProblemResponse::from)

    @GetMapping("/{id}")
    suspend fun byId(@PathVariable id: Long): ProblemResponse =
        ProblemResponse.from(problems.byId(id))
}

@RestController
@RequestMapping("/submissions")
class SubmissionController(
    private val queries: SubmissionQueries,
    private val submit: SubmitCode,
    private val events: SubmissionEventHub,
) {
    @GetMapping
    suspend fun list(): List<SubmissionResponse> = queries.all().map(SubmissionResponse::from)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun create(
        @Valid @RequestBody body: CreateSubmissionRequest,
        // web(Next 서버)이 시작한 추적을 이어받는다(W3C Trace Context, [ADR-0017]).
        @RequestHeader("traceparent", required = false) traceparent: String? = null,
    ): SubmissionResponse =
        SubmissionResponse.from(submit.submit(body.toCommand(TraceContext.parse(traceparent))))

    /**
     * 제출 상태 변화 스트림(SSE) — 채점이 비동기라 "언제 끝났는지"를 서버가 알려준다.
     * 단방향 알림이라 WebSocket 대신 SSE([ADR-0006]); 브라우저 `EventSource`가
     * 재연결까지 맡는다. 연결이 끊긴 동안의 이벤트는 잃으므로, web은 목록 조회로
     * 현재 상태를 먼저 채우고 이 스트림은 갱신에만 쓴다.
     */
    @GetMapping("/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun stream(): Flow<SubmissionResponse> =
        events.stream().asFlow().map(SubmissionResponse::from)
}
