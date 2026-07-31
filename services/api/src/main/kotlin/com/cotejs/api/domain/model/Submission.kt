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
        /** 저장 계약(V6, ADR-0020) — DB에는 enum name('ACCEPTED'…)이 저장된다. */
        fun fromName(name: String): JudgeResult =
            entries.firstOrNull { it.name == name }
                ?: throw IllegalArgumentException("unknown result code: $name")

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

/** 제출 빈도 초과 — 어댑터가 429로 번역한다. */
class RateLimitExceededException(message: String) : RuntimeException(message)

/** 케이스별 채점 결과 — "몇 번에서 틀렸나"가 학습 플랫폼의 핵심 피드백이다. */
data class CaseResult(
    val no: Int,
    val result: JudgeResult,
    val execTimeMs: Int?,
    val memoryUsedKb: Int?,
)

data class Submission(
    val id: Long,
    /** 표시용 닉네임(제출 시점 스냅샷). 소유 관계의 진실원은 [userId]. */
    val user: String,
    val userId: Long,
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
    /** 이 컨텍스트를 부모로 하는 다음 구간 — 같은 추적 id, 새 span. */
    fun child(): TraceContext = TraceContext(traceId = traceId, spanId = hex(8), parentSpanId = spanId)

    companion object {
        private val random = java.security.SecureRandom()

        // W3C traceparent: version(2) - trace-id(32) - parent-id(16) - flags(2), 전부 소문자 hex.
        private val TRACEPARENT = Regex("([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}")

        /** 추적이 없는 흐름의 시작점(내부 발생 작업 등). */
        fun start(): TraceContext = TraceContext(traceId = hex(16), spanId = hex(8))

        /**
         * W3C traceparent 헤더 파싱. 브라우저·프록시를 거친 외부 입력이므로
         * 형식이 어긋나면 잇지 않고 버린다(null) — 오염된 id가 전 구간 로그에 퍼지는 것보다
         * 추적이 끊기는 쪽이 낫다.
         */
        fun parse(traceparent: String?): TraceContext? {
            val m = TRACEPARENT.matchEntire(traceparent ?: return null) ?: return null
            val (version, traceId, spanId) = m.destructured
            if (version == "ff") return null // 스펙상 무효 버전
            if (traceId.all { it == '0' } || spanId.all { it == '0' }) return null // 스펙상 무효 id
            return TraceContext(traceId = traceId, spanId = spanId)
        }

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

/** 제출 커맨드 (web → api). 제출은 로그인 필수라 주체가 항상 있다(ADR-0019). */
data class NewSubmission(
    val by: AuthPrincipal,
    val problemId: Long,
    val language: Language,
    val code: String,
    val mode: ExecutionMode = ExecutionMode.SUBMIT,
    /** web(Next 서버)이 시작한 추적 — 있으면 잇고, 없으면 api가 새로 시작한다. */
    val parentTrace: TraceContext? = null,
)
