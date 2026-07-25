package com.cotejs.api.domain.port.outbound

import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission

// 아웃바운드 포트 — 영속 어댑터(R2DBC)가 구현하는 계약.

interface ProblemRepository {
    suspend fun findAll(): List<Problem>

    suspend fun findById(id: Long): Problem?
}

interface SubmissionRepository {
    suspend fun findAllNewestFirst(): List<Submission>

    /** [submission].id는 무시되고 저장 후 발급된 id로 반환된다. */
    suspend fun save(submission: Submission): Submission
}
