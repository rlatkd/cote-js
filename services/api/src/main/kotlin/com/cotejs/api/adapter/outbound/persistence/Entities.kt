package com.cotejs.api.adapter.outbound.persistence

import io.r2dbc.postgresql.codec.Json
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant

// R2DBC 영속 엔티티 — 도메인과 분리(hexagonal 아웃바운드 어댑터 내부).
// 컬럼명은 Spring Data의 camelCase → snake_case 자동 매핑을 따른다.

@Table("problem")
data class ProblemEntity(
    @Id val id: Long,
    val title: String,
    val difficulty: String,
    val tier: String,
    val timeLimitMs: Int,
    val memoryLimitMb: Int,
    val submissionCount: Int,
    val acceptedCount: Int,
    val tags: List<String>,
    val aiGenerated: Boolean,
    val description: String,
    val inputDesc: String,
    val outputDesc: String,
    val starterCode: Json,
    val testBundleKey: String? = null,
    val testBundleSha256: String? = null,
    val exampleBundleKey: String? = null,
    val exampleBundleSha256: String? = null,
)

@Table("example")
data class ExampleEntity(
    @Id val id: Long? = null,
    val problemId: Long,
    val ord: Int,
    val input: String,
    val output: String,
)

@Table("test_case")
data class TestCaseEntity(
    @Id val id: Long? = null,
    val problemId: Long,
    val ord: Int,
    val input: String,
    val output: String,
)

@Table("users")
data class UserEntity(
    @Id val id: Long? = null,
    val provider: String,
    val providerId: String,
    val nickname: String,
    val role: String,
    val createdAt: Instant,
)

@Table("submission")
data class SubmissionEntity(
    @Id val id: Long? = null,
    val username: String,
    val userId: Long,
    val problemId: Long,
    val problemTitle: String,
    val result: String,
    val language: String,
    val execTimeMs: Int? = null,
    val memoryUsedKb: Int? = null,
    val length: Int,
    val code: String? = null,
    val mode: String,
    val submittedAt: Instant,
    val judgedAt: Instant? = null,
)

@Table("submission_case")
data class SubmissionCaseEntity(
    @Id val id: Long? = null,
    val submissionId: Long,
    val no: Int,
    val result: String,
    val execTimeMs: Int? = null,
    val memoryUsedKb: Int? = null,
)
