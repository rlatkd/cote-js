package com.cotejs.api.adapter.outbound.persistence

import kotlinx.coroutines.flow.Flow
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface ProblemR2dbcRepository : CoroutineCrudRepository<ProblemEntity, Long>

interface ExampleR2dbcRepository : CoroutineCrudRepository<ExampleEntity, Long> {
    fun findByProblemIdIn(problemIds: Collection<Long>): Flow<ExampleEntity>
}

interface SubmissionR2dbcRepository : CoroutineCrudRepository<SubmissionEntity, Long> {
    fun findAllByOrderBySubmittedAtDesc(): Flow<SubmissionEntity>
}
