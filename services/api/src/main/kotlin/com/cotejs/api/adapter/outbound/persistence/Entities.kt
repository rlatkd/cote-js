package com.cotejs.api.adapter.outbound.persistence

import io.r2dbc.postgresql.codec.Json
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Table
import java.time.LocalDateTime

// R2DBC 영속 엔티티 — 도메인과 분리(hexagonal 아웃바운드 어댑터 내부).
// 컬럼명은 Spring Data의 camelCase → snake_case 자동 매핑을 따른다.

@Table("problem")
data class ProblemEntity(
    @Id val id: Long,
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
    val starterCode: Json,
)

@Table("example")
data class ExampleEntity(
    @Id val id: Long? = null,
    val problemId: Long,
    val ord: Int,
    val input: String,
    val output: String,
)

@Table("submission")
data class SubmissionEntity(
    @Id val id: Long? = null,
    val username: String,
    val problemId: Long,
    val problemTitle: String,
    val result: String,
    val language: String,
    val execTime: String,
    val execMemory: String,
    val length: Int,
    val submittedAt: LocalDateTime,
)
