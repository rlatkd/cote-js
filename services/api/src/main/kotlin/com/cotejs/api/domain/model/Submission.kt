package com.cotejs.api.domain.model

import java.time.LocalDateTime

enum class Language(val label: String) {
    PYTHON("Python"),
    CPP("C++"),
    JAVA("Java"),
    JAVASCRIPT("JavaScript");

    companion object {
        fun fromLabel(label: String): Language =
            entries.firstOrNull { it.label == label }
                ?: throw IllegalArgumentException("unknown language: $label")
    }
}

enum class JudgeResult(val label: String) {
    ACCEPTED("맞았습니다"),
    WRONG_ANSWER("틀렸습니다"),
    TIME_LIMIT("시간 초과"),
    MEMORY_LIMIT("메모리 초과"),
    RUNTIME_ERROR("런타임 에러"),
    COMPILE_ERROR("컴파일 에러"),
    PENDING("채점 중"),

    // 채점 시스템 자체 장애 — 유저 코드 잘못이 아니므로 오답류와 구분한다.
    // (judge의 VERDICT_INTERNAL_ERROR에 대응)
    INTERNAL_ERROR("채점 오류");

    companion object {
        fun fromLabel(label: String): JudgeResult =
            entries.firstOrNull { it.label == label }
                ?: throw IllegalArgumentException("unknown judge result: $label")
    }
}

data class Submission(
    val id: Long,
    val user: String,
    val problemId: Long,
    val problemTitle: String,
    val result: JudgeResult,
    val language: Language,
    // 채점 전에는 값이 없다 — 문자열 '—'로 없음을 흉내내던 것을 null로 바로잡음.
    val execTimeMs: Int? = null,
    val memoryUsedKb: Int? = null,
    val length: Int,
    val code: String? = null,
    val submittedAt: LocalDateTime,
    val judgedAt: LocalDateTime? = null,
)

/** 채점 결과 반영 커맨드 (judge 결과 토픽 → api). */
data class JudgedOutcome(
    val submissionId: Long,
    val result: JudgeResult,
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
    val judgedAt: LocalDateTime,
)

/** 제출 커맨드 (web → api). */
data class NewSubmission(
    val user: String,
    val problemId: Long,
    val language: Language,
    val code: String,
)
