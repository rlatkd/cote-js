package com.cotejs.api.domain.model

// 절대시각(Instant)만 쓴다 — LocalDateTime은 "어디의 몇 시"를 담지 못해
// 서비스 경계를 넘을 때 어긋난다(ADR-0013). 지역 시간 변환은 화면의 몫.
import java.time.Instant

// judge의 러너가 존재하는 언어만 접수한다(services/judge/internal/language).
// 목록이 어긋나면 채점기가 없는 언어를 받아 오판정한다.
enum class Language(val label: String) {
    PYTHON("Python"),
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

/**
 * 실행 모드 — 같은 채점기를 쓰지만 성격이 다르다.
 * `RUN`은 공개 예제로 시험 삼아 돌려보는 것(기록에 남지 않음),
 * `SUBMIT`은 히든 테스트케이스로 채점되어 기록되는 정식 제출.
 * QoS 레인도 이 값으로 갈린다([ADR-0006]).
 */
enum class ExecutionMode(val label: String) {
    RUN("run"),
    SUBMIT("submit");

    companion object {
        fun fromLabel(label: String): ExecutionMode =
            entries.firstOrNull { it.label == label }
                ?: throw IllegalArgumentException("unknown execution mode: $label")
    }
}

/** 케이스별 채점 결과 — "몇 번에서 틀렸나"가 학습 플랫폼의 핵심 피드백이다. */
data class CaseResult(
    val no: Int,
    val result: JudgeResult,
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
)

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
    val mode: ExecutionMode = ExecutionMode.SUBMIT,
    val submittedAt: Instant,
    val judgedAt: Instant? = null,
    val cases: List<CaseResult> = emptyList(),
)

/**
 * 요청 흐름 추적 컨텍스트 — 한 제출이 web→api→judge→api를 지나는 동안 같은 실을 꿴다.
 * 계약(common.v1.TraceContext)의 도메인 표현이며, 형식은 W3C Trace Context를 따른다.
 */
data class TraceContext(
    val traceId: String,
    val spanId: String,
    val parentSpanId: String? = null,
) {
    companion object {
        private val random = java.security.SecureRandom()

        /** 흐름의 시작점 — api가 제출을 접수하는 순간 한 번 만든다. */
        fun start(): TraceContext = TraceContext(traceId = hex(16), spanId = hex(8))

        private fun hex(bytes: Int): String =
            ByteArray(bytes).also(random::nextBytes).joinToString("") { "%02x".format(it) }
    }
}

/** 채점 결과 반영 커맨드 (judge 결과 토픽 → api). */
data class JudgedOutcome(
    val submissionId: Long,
    val result: JudgeResult,
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
    val judgedAt: Instant,
    val cases: List<CaseResult> = emptyList(),
)

/** 제출 커맨드 (web → api). */
data class NewSubmission(
    val user: String,
    val problemId: Long,
    val language: Language,
    val code: String,
    val mode: ExecutionMode = ExecutionMode.SUBMIT,
)
