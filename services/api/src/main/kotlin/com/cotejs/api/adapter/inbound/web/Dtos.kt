package com.cotejs.api.adapter.inbound.web

import com.cotejs.api.domain.model.AuthPrincipal
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.NewSubmission
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TraceContext
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

// 웹 어댑터 DTO — web가 소비하는 JSON 계약(OpenAPI /v3/api-docs의 원본).
// 필드명·포맷은 기존 계약(구 @cotejs/contracts)과 동일하게 유지한다(drop-in).

data class ExampleResponse(
    val input: String,
    val output: String,
)

data class ProblemResponse(
    val id: Long,
    val title: String,
    val difficulty: String,
    val tier: String,
    // 수치로 내보낸다 — 표시 형식("1초"·"256 MB")은 화면의 관심사다.
    val timeLimitMs: Int,
    val memoryLimitMb: Int,
    val submissionCount: Int,
    val acceptedCount: Int,
    val tags: List<String>,
    val aiGenerated: Boolean,
    val description: String,
    val inputDesc: String,
    val outputDesc: String,
    val examples: List<ExampleResponse>,
    val starterCode: Map<String, String>,
) {
    companion object {
        fun from(p: Problem) = ProblemResponse(
            id = p.id,
            title = p.title,
            difficulty = p.difficulty.label,
            tier = p.tier,
            timeLimitMs = p.timeLimitMs,
            memoryLimitMb = p.memoryLimitMb,
            submissionCount = p.submissionCount,
            acceptedCount = p.acceptedCount,
            tags = p.tags,
            aiGenerated = p.aiGenerated,
            description = p.description,
            inputDesc = p.inputDesc,
            outputDesc = p.outputDesc,
            examples = p.examples.map { ExampleResponse(it.input, it.output) },
            starterCode = p.starterCode,
        )
    }
}

data class CaseResultResponse(
    val no: Int,
    val result: String,
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
)

data class SubmissionResponse(
    val id: Long,
    val user: String,
    val problemId: Long,
    val problemTitle: String,
    val result: String,
    val language: String,
    // 채점 전에는 null — 없음을 '—' 문자열로 흉내내지 않는다(표시는 화면 담당).
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
    val length: Int,
    val mode: String,
    // ISO-8601 절대시각("2026-07-28T12:23:45Z") — 지역 시간 표시는 web이 한다.
    val submittedAt: String,
    val judgedAt: String?,
    val cases: List<CaseResultResponse>,
) {
    companion object {
        fun from(s: Submission) = SubmissionResponse(
            id = s.id,
            user = s.user,
            problemId = s.problemId,
            problemTitle = s.problemTitle,
            result = s.result.label,
            language = s.language.label,
            execTimeMs = s.execTimeMs,
            memoryUsedKb = s.memoryUsedKb,
            length = s.length,
            mode = s.mode.label,
            submittedAt = s.submittedAt.toString(),
            judgedAt = s.judgedAt?.toString(),
            cases = s.cases.map {
                CaseResultResponse(it.no, it.result.label, it.execTimeMs, it.memoryUsedKb)
            },
        )
    }
}

data class CreateSubmissionRequest(
    @field:NotNull @field:Positive
    val problemId: Long?,
    @field:NotBlank
    val language: String?,
    @field:NotBlank
    val code: String?,
    /** 실행 모드 — "run"(예제 실행) 또는 "submit"(정식 제출). 생략 시 정식 제출. */
    val mode: String? = null,
) {
    /**
     * 검증 통과 후 도메인 커맨드로 변환. 잘못된 language·mode는 IllegalArgumentException → 400.
     * 제출 주체는 body가 아니라 **인증 필터가 확인한 principal**이다 — 요청이 자신을
     * 아무 이름으로나 소개하게 두지 않는다(구 `user` 필드 폐기, ADR-0019).
     */
    fun toCommand(by: AuthPrincipal, parentTrace: TraceContext? = null): NewSubmission = NewSubmission(
        by = by,
        problemId = requireNotNull(problemId),
        language = Language.fromLabel(requireNotNull(language)),
        code = requireNotNull(code),
        mode = mode?.let { ExecutionMode.fromLabel(it) } ?: ExecutionMode.SUBMIT,
        parentTrace = parentTrace,
    )
}
