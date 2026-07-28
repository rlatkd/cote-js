package com.cotejs.api.application

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.CaseResult
import com.cotejs.api.domain.model.Difficulty
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.Example
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.NewSubmission
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.ProblemNotFoundException
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.model.TraceContext
import com.cotejs.api.domain.port.outbound.BundleStore
import com.cotejs.api.domain.port.outbound.ExecutionLane
import com.cotejs.api.domain.port.outbound.JudgeDispatcher
import com.cotejs.api.domain.port.outbound.ProblemRepository
import com.cotejs.api.domain.port.outbound.SubmissionRepository
import kotlinx.coroutines.test.runTest
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * 제출 유스케이스의 **정책**을 검증한다. 인프라는 흉내내지 않는다 — 여기 쓰는 대역은
 * "우리가 정의한 포트의 단순 구현"이지 Kafka·S3의 동작을 모사하는 목이 아니다([ADR-0016]).
 */
class SubmissionServiceTest {

    @Test
    fun `run 모드는 공개 예제로, submit 모드는 히든 케이스로 채점한다`() = runTest {
        // 히든 케이스를 예제 실행에 쓰면 사용자가 예제 실행만으로 히든 데이터를
        // 역추적할 수 있다([ADR-0014]).
        val fixture = fixture()

        fixture.service.submit(command(ExecutionMode.RUN))
        assertEquals(listOf(예제_케이스), fixture.bundles.published.single())
        assertEquals(ExecutionLane.RUN, fixture.dispatcher.lanes.single())

        fixture.bundles.published.clear()
        fixture.dispatcher.lanes.clear()

        fixture.service.submit(command(ExecutionMode.SUBMIT))
        assertEquals(listOf(히든_케이스), fixture.bundles.published.single())
        assertEquals(ExecutionLane.SUBMIT, fixture.dispatcher.lanes.single())
    }

    @Test
    fun `채점 데이터가 없으면 오답이 아니라 채점 오류로 남기고 발행하지 않는다`() = runTest {
        // 데이터 미비는 운영자 문제지 유저 코드 문제가 아니다 — 오답류로 기록하면
        // 사용자가 자기 코드를 의심한다.
        val fixture = fixture(testCases = emptyList())

        val result = fixture.service.submit(command(ExecutionMode.SUBMIT))

        assertEquals(JudgeResult.INTERNAL_ERROR, result.result)
        assertTrue(fixture.dispatcher.lanes.isEmpty(), "채점할 수 없으면 발행하지 않는다")
        assertTrue(fixture.events.published.isNotEmpty(), "그래도 사용자에겐 알린다(침묵 금지)")
    }

    @Test
    fun `제출은 채점 중 상태로 먼저 저장되고 즉시 반환된다`() = runTest {
        // 채점은 비동기라 응답을 기다리지 않는다 — 판정은 결과 토픽으로 되돌아온다.
        val fixture = fixture()

        val result = fixture.service.submit(command(ExecutionMode.SUBMIT))

        assertEquals(JudgeResult.PENDING, result.result)
        assertNull(result.judgedAt)
        assertEquals(1, fixture.dispatcher.lanes.size)
    }

    @Test
    fun `번들 참조가 이미 있으면 다시 발행하지 않는다`() = runTest {
        // 번들은 test_case에서 파생된 캐시다 — 참조가 있으면 재사용한다([ADR-0012]).
        val cached = BundleRef("bundles/cached.tgz", "abc123")
        val fixture = fixture(problem = problem().copy(testBundle = cached))

        fixture.service.submit(command(ExecutionMode.SUBMIT))

        assertTrue(fixture.bundles.published.isEmpty(), "캐시된 참조가 있으면 재발행 없음")
        assertEquals(cached, fixture.dispatcher.bundles.single())
    }

    @Test
    fun `없는 문제에 제출하면 실패한다`() = runTest {
        val fixture = fixture(problem = null)
        assertFailsWith<ProblemNotFoundException> { fixture.service.submit(command(ExecutionMode.SUBMIT)) }
    }

    @Test
    fun `결과 반영은 알 수 없는 제출을 만나도 예외를 던지지 않는다`() = runTest {
        // at-least-once라 이미 지워진 제출의 결과가 올 수 있다. 예외를 던지면
        // 컨슈머가 그 파티션에서 멈춘다([ADR-0011] poison message 규율).
        val fixture = fixture()

        fixture.service.apply(outcome(submissionId = 999))

        assertTrue(fixture.events.published.isEmpty(), "반영 대상이 없으면 알림도 없다")
    }

    @Test
    fun `결과가 반영되면 구독자에게 알린다`() = runTest {
        val fixture = fixture()
        val saved = fixture.service.submit(command(ExecutionMode.SUBMIT))
        fixture.events.published.clear()

        fixture.service.apply(outcome(submissionId = saved.id))

        val notified = fixture.events.published.single()
        assertEquals(JudgeResult.ACCEPTED, notified.result)
        assertEquals(2, notified.cases.size)
    }

    // ── 대역(fake) ──────────────────────────────────────────────────────
    // 하나같이 "포트의 최소 구현"일 뿐이다. 인프라 의미론(파티션·재시도·일관성)을
    // 흉내내지 않는다 — 그건 통합 테스트가 진짜 인프라로 할 일.

    private val 예제_케이스 = TestCase(1, "1 2", "3")
    private val 히든_케이스 = TestCase(1, "9 9", "18")

    private fun problem() = Problem(
        id = 1000,
        title = "두 수의 합",
        difficulty = Difficulty.BRONZE,
        tier = "Bronze V",
        timeLimitMs = 1000,
        memoryLimitMb = 256,
        submissionCount = 0,
        acceptedCount = 0,
        tags = emptyList(),
        aiGenerated = false,
        description = "",
        inputDesc = "",
        outputDesc = "",
        examples = listOf(Example(예제_케이스.input, 예제_케이스.output)),
        starterCode = emptyMap(),
    )

    private fun command(mode: ExecutionMode) = NewSubmission(
        user = "tester",
        problemId = 1000,
        language = Language.PYTHON,
        code = "print(1)",
        mode = mode,
    )

    private fun outcome(submissionId: Long) = JudgedOutcome(
        submissionId = submissionId,
        result = JudgeResult.ACCEPTED,
        execTimeMs = 30,
        memoryUsedKb = 9000,
        judgedAt = Instant.now(),
        cases = listOf(
            CaseResult(1, JudgeResult.ACCEPTED, 30, 9000),
            CaseResult(2, JudgeResult.ACCEPTED, 28, 9000),
        ),
    )

    private fun fixture(
        problem: Problem? = problem(),
        testCases: List<TestCase> = listOf(히든_케이스),
    ): Fixture {
        val problems = FakeProblems(problem, testCases)
        val submissions = FakeSubmissions()
        val dispatcher = FakeDispatcher()
        val bundles = FakeBundles()
        val events = RecordingEventHub()
        return Fixture(
            SubmissionService(submissions, problems, dispatcher, bundles, events),
            dispatcher, bundles, events,
        )
    }

    private class Fixture(
        val service: SubmissionService,
        val dispatcher: FakeDispatcher,
        val bundles: FakeBundles,
        val events: RecordingEventHub,
    )

    private class FakeProblems(
        private val problem: Problem?,
        private val testCases: List<TestCase>,
    ) : ProblemRepository {
        override suspend fun findAll() = listOfNotNull(problem)
        override suspend fun findById(id: Long) = problem
        override suspend fun findTestCases(problemId: Long) = testCases
        override suspend fun updateTestBundle(problemId: Long, bundle: BundleRef) = Unit
        override suspend fun updateExampleBundle(problemId: Long, bundle: BundleRef) = Unit
    }

    private class FakeSubmissions : SubmissionRepository {
        private val stored = mutableMapOf<Long, Submission>()
        private var nextId = 1L

        override suspend fun findAllNewestFirst() = stored.values.toList()

        override suspend fun save(submission: Submission): Submission =
            submission.copy(id = nextId++).also { stored[it.id] = it }

        override suspend fun applyOutcome(outcome: JudgedOutcome): Submission? {
            val existing = stored[outcome.submissionId] ?: return null
            return existing.copy(
                result = outcome.result,
                execTimeMs = outcome.execTimeMs,
                memoryUsedKb = outcome.memoryUsedKb,
                judgedAt = outcome.judgedAt,
                cases = outcome.cases,
            ).also { stored[it.id] = it }
        }
    }

    private class FakeDispatcher : JudgeDispatcher {
        val lanes = mutableListOf<ExecutionLane>()
        val bundles = mutableListOf<BundleRef>()

        override suspend fun dispatch(
            submission: Submission,
            problem: Problem,
            bundle: BundleRef,
            code: String,
            lane: ExecutionLane,
            trace: TraceContext,
        ) {
            lanes += lane
            bundles += bundle
        }
    }

    private class FakeBundles : BundleStore {
        val published = mutableListOf<List<TestCase>>()

        override suspend fun publish(problemId: Long, cases: List<TestCase>): BundleRef {
            published += cases
            return BundleRef("bundles/fake-${published.size}.tgz", "hash${published.size}")
        }
    }

    private class RecordingEventHub : SubmissionEventHub() {
        val published = mutableListOf<Submission>()
        override fun publish(submission: Submission) {
            published += submission
        }
    }
}
