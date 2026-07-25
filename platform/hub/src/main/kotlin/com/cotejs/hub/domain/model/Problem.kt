package com.cotejs.hub.domain.model

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

data class Problem(
    val id: Long,
    val title: String,
    val difficulty: Difficulty,
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
    val examples: List<Example>,
    val starterCode: Map<String, String>,
)

class ProblemNotFoundException(id: Long) : RuntimeException("problem $id not found")
