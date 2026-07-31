package com.cotejs.api.application

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.model.TraceContext
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
import java.time.Instant

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

        // 실행 모드가 "무엇으로 채점하나"를 가른다:
        //   run    → 공개 예제(사용자가 이미 보는 데이터)
        //   submit → 히든 테스트케이스
        // run에 히든 케이스를 쓰면 예제 실행만으로 히든 데이터를 역추적할 수 있다.
        val bundle = when (command.mode) {
            ExecutionMode.RUN -> ensureExampleBundle(problem)
            ExecutionMode.SUBMIT -> ensureTestBundle(problem)
        }

        val pending = submissions.save(
            Submission(
                id = 0,
                // 주체는 인증 필터가 확인한 principal — 닉네임은 표시용 스냅샷, 소유는 userId.
                user = command.by.nickname,
                userId = command.by.userId,
                problemId = problem.id,
                problemTitle = problem.title,
                // 번들이 없으면 채점할 수 없다 — 유저 귀책이 아니므로 오답류가 아닌
                // '채점 오류'로 남긴다(침묵보다 낫다).
                result = if (bundle == null) JudgeResult.INTERNAL_ERROR else JudgeResult.PENDING,
                language = command.language,
                length = command.code.length,
                code = command.code,
                mode = command.mode,
                submittedAt = Instant.now(),
                judgedAt = if (bundle == null) Instant.now() else null,
            ),
        )
        events.publish(pending)

        if (bundle == null) {
            log.warn(
                "문제 {}에 채점 데이터가 없어 실행을 건너뜀 (제출 {}, 모드 {})",
                problem.id, pending.id, command.mode.label,
            )
            return pending
        }

        // web(Next 서버)이 시작한 추적이 있으면 잇고, 없으면 여기가 시작점이다.
        // 이 id가 judge 로그까지 따라간다(ADR-0017).
        val trace = command.parentTrace?.child() ?: TraceContext.start()
        log.info(
            "채점 요청 발행: submission={} mode={} trace={} parentSpan={}",
            pending.id, command.mode.label, trace.traceId, trace.parentSpanId ?: "-",
        )

        dispatcher.dispatch(
            submission = pending,
            problem = problem,
            bundle = bundle,
            trace = trace,
            code = command.code,
            lane = when (command.mode) {
                ExecutionMode.RUN -> ExecutionLane.RUN
                ExecutionMode.SUBMIT -> ExecutionLane.SUBMIT
            },
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
     * 번들 확보 — DB의 채점 데이터로 만들어 올리고 참조를 캐시한다(claim-check 발행자).
     * 이미 참조가 있으면 그대로 쓴다. 데이터가 없는 문제는 null(채점 불가).
     */
    private suspend fun ensureTestBundle(problem: Problem): BundleRef? =
        problem.testBundle ?: publish(problem.id, problems.findTestCases(problem.id)) {
            problems.updateTestBundle(problem.id, it)
        }

    private suspend fun ensureExampleBundle(problem: Problem): BundleRef? =
        problem.exampleBundle ?: publish(
            problem.id,
            // 공개 예제도 채점 입장에선 그냥 케이스다 — 같은 번들 규약으로 변환.
            problem.examples.mapIndexed { index, ex -> TestCase(index + 1, ex.input, ex.output) },
        ) { problems.updateExampleBundle(problem.id, it) }

    private suspend fun publish(
        problemId: Long,
        cases: List<TestCase>,
        cache: suspend (BundleRef) -> Unit,
    ): BundleRef? {
        if (cases.isEmpty()) return null
        return bundles.publish(problemId, cases).also { cache(it) }
    }
}
