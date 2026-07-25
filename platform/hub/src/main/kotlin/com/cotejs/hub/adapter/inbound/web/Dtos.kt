package com.cotejs.hub.adapter.inbound.web

import com.cotejs.hub.domain.model.Language
import com.cotejs.hub.domain.model.NewSubmission
import com.cotejs.hub.domain.model.Problem
import com.cotejs.hub.domain.model.Submission
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import java.time.format.DateTimeFormatter

// 웹 어댑터 DTO — arena가 소비하는 JSON 계약(OpenAPI /v3/api-docs의 원본).
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
    val timeLimit: String,
    val memoryLimit: String,
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
            timeLimit = p.timeLimit,
            memoryLimit = p.memoryLimit,
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

private val TIMESTAMP: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

data class SubmissionResponse(
    val id: Long,
    val user: String,
    val problemId: Long,
    val problemTitle: String,
    val result: String,
    val language: String,
    val time: String,
    val memory: String,
    val length: Int,
    val submittedAt: String,
) {
    companion object {
        fun from(s: Submission) = SubmissionResponse(
            id = s.id,
            user = s.user,
            problemId = s.problemId,
            problemTitle = s.problemTitle,
            result = s.result.label,
            language = s.language.label,
            time = s.time,
            memory = s.memory,
            length = s.length,
            submittedAt = s.submittedAt.format(TIMESTAMP),
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
    val user: String? = null,
) {
    /** 검증 통과 후 도메인 커맨드로 변환. 잘못된 language는 IllegalArgumentException → 400. */
    fun toCommand(): NewSubmission = NewSubmission(
        user = user?.takeIf { it.isNotBlank() } ?: "guest",
        problemId = requireNotNull(problemId),
        language = Language.fromLabel(requireNotNull(language)),
        code = requireNotNull(code),
    )
}
