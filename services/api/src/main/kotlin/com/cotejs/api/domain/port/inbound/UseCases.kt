package com.cotejs.api.domain.port.inbound

import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.NewSubmission
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission

// 인바운드 포트 — 웹 어댑터가 호출하는 유스케이스 계약.

interface ProblemQueries {
    suspend fun all(): List<Problem>

    /** @throws com.cotejs.api.domain.model.ProblemNotFoundException */
    suspend fun byId(id: Long): Problem
}

interface SubmissionQueries {
    suspend fun all(): List<Submission>
}

interface SubmitCode {
    suspend fun submit(command: NewSubmission): Submission
}

/** 채점 결과 반영 — 인바운드 메시징 어댑터(Kafka 결과 토픽)가 호출한다. */
interface ApplyJudgeOutcome {
    suspend fun apply(outcome: JudgedOutcome)
}
