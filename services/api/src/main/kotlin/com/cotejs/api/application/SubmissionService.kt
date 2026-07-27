package com.cotejs.api.application

import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.NewSubmission
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.ProblemNotFoundException
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.port.inbound.ApplyJudgeOutcome
import com.cotejs.api.domain.port.inbound.SubmissionQueries
import com.cotejs.api.domain.port.inbound.SubmitCode
import com.cotejs.api.domain.port.outbound.BundleStore
import com.cotejs.api.domain.port.outbound.ExecutionLane
import com.cotejs.api.domain.port.outbound.JudgeDispatcher
import com.cotejs.api.domain.port.outbound.ProblemRepository
import com.cotejs.api.domain.port.outbound.SubmissionRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.LocalDateTime

@Service
class SubmissionService(
    private val submissions: SubmissionRepository,
    private val problems: ProblemRepository,
    private val dispatcher: JudgeDispatcher,
    private val bundles: BundleStore,
    private val events: SubmissionEventHub,
) : SubmissionQueries, SubmitCode, ApplyJudgeOutcome {
    private val log = LoggerFactory.getLogger(javaClass)

    override suspend fun all(): List<Submission> = submissions.findAllNewestFirst()

    /**
     * 제출 흐름: "채점 중"으로 먼저 영속(사용자에게 즉시 응답) → 번들 확보 →
     * 제출 레인으로 발행. 판정은 결과 토픽으로 되돌아와 [apply]가 반영한다.
     */
    override suspend fun submit(command: NewSubmission): Submission {
        val problem = problems.findById(command.problemId)
            ?: throw ProblemNotFoundException(command.problemId)

        val bundle = ensureBundle(problem)

        val pending = submissions.save(
            Submission(
                id = 0,
                user = command.user,
                problemId = problem.id,
                problemTitle = problem.title,
                // 번들이 없으면 채점할 수 없다 — 유저 귀책이 아니므로 오답류가 아닌
                // '채점 오류'로 남긴다(침묵보다 낫다).
                result = if (bundle == null) JudgeResult.INTERNAL_ERROR else JudgeResult.PENDING,
                language = command.language,
                length = command.code.length,
                code = command.code,
                submittedAt = LocalDateTime.now(),
                judgedAt = if (bundle == null) LocalDateTime.now() else null,
            ),
        )
        events.publish(pending)

        if (bundle == null) {
            log.warn("문제 {}에 테스트케이스가 없어 채점을 건너뜀 (제출 {})", problem.id, pending.id)
            return pending
        }

        dispatcher.dispatch(
            submission = pending,
            problem = problem.copy(testBundle = bundle),
            code = command.code,
            lane = ExecutionLane.SUBMIT,
        )
        return pending
    }

    /** 결과 반영은 멱등이다 — at-least-once라 같은 결과가 두 번 올 수 있다([ADR-0011]). */
    override suspend fun apply(outcome: JudgedOutcome) {
        val updated = submissions.applyOutcome(outcome)
        if (updated == null) {
            // 알 수 없는 제출 id — 재시도해도 같으므로 로그만 남기고 흘려보낸다.
            log.warn("결과가 가리키는 제출을 찾을 수 없음: {}", outcome.submissionId)
            return
        }
        events.publish(updated)
    }

    /**
     * 번들 확보 — DB의 테스트케이스로 만들어 올리고 참조를 캐시한다(claim-check 발행자).
     * 이미 참조가 있으면 그대로 쓴다. 테스트케이스가 없는 문제는 null.
     */
    private suspend fun ensureBundle(problem: Problem) = problem.testBundle ?: run {
        val cases = problems.findTestCases(problem.id)
        if (cases.isEmpty()) return@run null
        bundles.publish(problem.id, cases).also { problems.updateTestBundle(problem.id, it) }
    }
}
