package com.cotejs.api.adapter.outbound.persistence

import kotlinx.coroutines.flow.Flow
import org.springframework.data.r2dbc.repository.Modifying
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface ProblemR2dbcRepository : CoroutineCrudRepository<ProblemEntity, Long> {
    @Modifying
    @Query("UPDATE problem SET test_bundle_key = :key, test_bundle_sha256 = :sha WHERE id = :id")
    suspend fun updateTestBundle(id: Long, key: String, sha: String): Int
}

interface ExampleR2dbcRepository : CoroutineCrudRepository<ExampleEntity, Long> {
    fun findByProblemIdIn(problemIds: Collection<Long>): Flow<ExampleEntity>
}

interface TestCaseR2dbcRepository : CoroutineCrudRepository<TestCaseEntity, Long> {
    fun findByProblemIdOrderByOrd(problemId: Long): Flow<TestCaseEntity>
}

interface SubmissionR2dbcRepository : CoroutineCrudRepository<SubmissionEntity, Long> {
    fun findAllByOrderBySubmittedAtDesc(): Flow<SubmissionEntity>
}
