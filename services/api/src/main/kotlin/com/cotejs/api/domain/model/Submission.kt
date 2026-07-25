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
    PENDING("채점 중");

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
    val time: String,
    val memory: String,
    val length: Int,
    val submittedAt: LocalDateTime,
)

/** 제출 커맨드 (web → api). */
data class NewSubmission(
    val user: String,
    val problemId: Long,
    val language: Language,
    val code: String,
)
