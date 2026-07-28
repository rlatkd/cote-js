package com.cotejs.api.domain.model

// 도메인 모델 — 프레임워크 의존 없음(hexagonal 중심).

enum class Difficulty(val label: String) {
    BRONZE("Bronze"),
    SILVER("Silver"),
    GOLD("Gold"),
    PLATINUM("Platinum");

    companion object {
        fun fromLabel(label: String): Difficulty =
            entries.firstOrNull { it.label == label }
                ?: throw IllegalArgumentException("unknown difficulty: $label")
    }
}

data class Example(
    val input: String,
    val output: String,
)

/**
 * 테스트 번들 참조 — claim-check([ADR-0009]). 진실원은 `test_case` 행들이고,
 * 이건 그것으로 만든 MinIO 오브젝트의 캐시된 참조다(내용이 바뀌면 해시가 바뀐다).
 */
data class BundleRef(
    val key: String,
    val sha256: String,
)

data class TestCase(
    val ord: Int,
    val input: String,
    val output: String,
)

data class Problem(
    val id: Long,
    val title: String,
    val difficulty: Difficulty,
    val tier: String,
    // 제한은 수치로 보관한다 — 표시 형식("1초")은 화면의 관심사이고,
    // judge 계약(proto)도 수치라 경계마다 파싱하지 않기 위해.
    val timeLimitMs: Int,
    val memoryLimitMb: Int,
    val testBundle: BundleRef? = null,
    // run 레인용 — 공개 예제로 만든 번들(히든 케이스 노출 방지)
    val exampleBundle: BundleRef? = null,
    val submissionCount: Int,
    val acceptedCount: Int,
    val tags: List<String>,
    val aiGenerated: Boolean,
    val description: String,
    val inputDesc: String,
    val outputDesc: String,
    val examples: List<Example>,
    val starterCode: Map<String, String>,
)

class ProblemNotFoundException(id: Long) : RuntimeException("problem $id not found")
