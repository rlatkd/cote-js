package com.cotejs.api.adapter.outbound.persistence

import kotlinx.coroutines.flow.Flow
import org.springframework.data.r2dbc.repository.Modifying
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface ProblemR2dbcRepository : CoroutineCrudRepository<ProblemEntity, Long> {
    /** 제출 목록의 제목 표시용 — 지문까지 실린 전체 행을 끌어오지 않는다(프로젝션). */
    @Query("SELECT id, title FROM problem WHERE id IN (:ids)")
    fun findTitles(ids: Collection<Long>): Flow<ProblemTitleRow>

    @Modifying
    @Query("UPDATE problem SET test_bundle_key = :key, test_bundle_sha256 = :sha WHERE id = :id")
    suspend fun updateTestBundle(id: Long, key: String, sha: String): Int

    @Modifying
    @Query("UPDATE problem SET example_bundle_key = :key, example_bundle_sha256 = :sha WHERE id = :id")
    suspend fun updateExampleBundle(id: Long, key: String, sha: String): Int
}

interface ExampleR2dbcRepository : CoroutineCrudRepository<ExampleEntity, Long> {
    fun findByProblemIdIn(problemIds: Collection<Long>): Flow<ExampleEntity>
}

interface TestCaseR2dbcRepository : CoroutineCrudRepository<TestCaseEntity, Long> {
    fun findByProblemIdOrderByOrd(problemId: Long): Flow<TestCaseEntity>
}

interface StarterTemplateR2dbcRepository : CoroutineCrudRepository<StarterTemplateEntity, String>

interface UserR2dbcRepository : CoroutineCrudRepository<UserEntity, Long> {
    suspend fun findByProviderAndProviderId(provider: String, providerId: String): UserEntity?
}

interface SubmissionR2dbcRepository : CoroutineCrudRepository<SubmissionEntity, Long> {
    /** 채점 현황에는 정식 제출만 — 예제 실행(run)은 시험 삼아 돌린 것이라 기록으로 보이지 않는다. */
    @Query("SELECT * FROM submission WHERE mode = :mode ORDER BY submitted_at DESC LIMIT :limit OFFSET :offset")
    fun findByModeNewestFirst(mode: String, limit: Int, offset: Int): Flow<SubmissionEntity>
}

interface SubmissionCaseR2dbcRepository : CoroutineCrudRepository<SubmissionCaseEntity, Long> {
    /** 목록 조회용 일괄 적재 — 제출마다 쿼리하면 N+1이 된다(problem+example과 같은 관용구). */
    fun findBySubmissionIdIn(submissionIds: Collection<Long>): Flow<SubmissionCaseEntity>

    suspend fun deleteBySubmissionId(submissionId: Long): Long
}
