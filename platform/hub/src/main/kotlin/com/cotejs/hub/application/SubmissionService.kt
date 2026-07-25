package com.cotejs.hub.application

import com.cotejs.hub.domain.model.JudgeResult
import com.cotejs.hub.domain.model.NewSubmission
import com.cotejs.hub.domain.model.Submission
import com.cotejs.hub.domain.port.inbound.SubmissionQueries
import com.cotejs.hub.domain.port.inbound.SubmitCode
import com.cotejs.hub.domain.port.outbound.ProblemRepository
import com.cotejs.hub.domain.port.outbound.SubmissionRepository
import org.springframework.stereotype.Service
import java.time.LocalDateTime

@Service
class SubmissionService(
    private val submissions: SubmissionRepository,
    private val problems: ProblemRepository,
) : SubmissionQueries, SubmitCode {
    override suspend fun all(): List<Submission> = submissions.findAllNewestFirst()

    override suspend fun submit(command: NewSubmission): Submission {
        val problemTitle = problems.findById(command.problemId)?.title ?: "#${command.problemId}"

        // TODO(Judge 마일스톤): ADR-0006 경로 — Kafka 제출 토픽 발행 → judge 채점 →
        // 결과 토픽 소비 → 저장 + SSE 푸시. 현 슬라이스는 "채점 중"으로 영속 후 즉시 반환.
        val pending = Submission(
            id = 0,
            user = command.user,
            problemId = command.problemId,
            problemTitle = problemTitle,
            result = JudgeResult.PENDING,
            language = command.language,
            time = "—",
            memory = "—",
            length = command.code.length,
            submittedAt = LocalDateTime.now(),
        )
        return submissions.save(pending)
    }
}
