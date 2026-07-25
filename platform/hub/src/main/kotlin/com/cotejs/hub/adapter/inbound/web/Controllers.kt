package com.cotejs.hub.adapter.inbound.web

import com.cotejs.hub.domain.port.inbound.ProblemQueries
import com.cotejs.hub.domain.port.inbound.SubmissionQueries
import com.cotejs.hub.domain.port.inbound.SubmitCode
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
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
) {
    @GetMapping
    suspend fun list(): List<SubmissionResponse> = queries.all().map(SubmissionResponse::from)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun create(@Valid @RequestBody body: CreateSubmissionRequest): SubmissionResponse =
        SubmissionResponse.from(submit.submit(body.toCommand()))
}
