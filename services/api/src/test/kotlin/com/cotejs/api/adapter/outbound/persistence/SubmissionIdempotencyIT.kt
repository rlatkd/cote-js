package com.cotejs.api.adapter.outbound.persistence

import com.cotejs.api.domain.model.CaseResult
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.Submission
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Instant
import kotlin.test.assertEquals

/**
 * **at-least-once의 짝**을 진짜 Postgres로 고정한다.
 *
 * 왜 이 하나만 통합 테스트인가([ADR-0016]): 멱등 저장은 "같은 결과가 두 번 와도 상태가
 * 변하지 않는다"는 불변식인데, 이건 **DB 제약·업서트 동작에 의존**해서 목으로는 검증이
 * 성립하지 않는다. 반면 어댑터를 넓게 테스트하면 Docker 의존이 늘어 flaky 위험만 커진다.
 *
 * 이전엔 이 불변식을 손으로 검증했다(컨슈머 그룹을 바꿔 결과 토픽을 전량 재소비).
 * 그 절차를 코드로 옮긴 것이 이 테스트다.
 */
@SpringBootTest
@Testcontainers
class SubmissionIdempotencyIT {

    @Autowired
    private lateinit var submissions: SubmissionPersistenceAdapter

    @Autowired
    private lateinit var users: UserPersistenceAdapter

    @Autowired
    private lateinit var cases: SubmissionCaseR2dbcRepository

    /** 제출은 소유자가 필수(user_id NOT NULL) — 테스트 유저를 upsert로 확보(재실행 멱등). */
    private suspend fun testUserId(): Long =
        users.upsert(provider = "seed", providerId = "it-tester", nickname = "it-tester").id

    @Test
    fun `같은 결과를 두 번 반영해도 상태와 케이스 수가 변하지 않는다`() = runTest {
        val saved = submissions.save(pendingSubmission(testUserId()))
        val outcome = outcomeFor(saved.id)

        val first = submissions.applyOutcome(outcome)
        val second = submissions.applyOutcome(outcome) // 중복 수신 — at-least-once에서 정상

        assertEquals(JudgeResult.ACCEPTED, first?.result)
        assertEquals(first?.result, second?.result)
        assertEquals(first?.execTimeMs, second?.execTimeMs)
        assertEquals(first?.judgedAt, second?.judgedAt, "판정 시각까지 동일해야 한다")

        val stored = cases.findBySubmissionIdIn(listOf(saved.id)).toList()
        assertEquals(2, stored.size, "케이스가 중복 삽입되면 안 된다")
        assertEquals(listOf(1, 2), stored.map { it.no }.sorted())
    }

    @Test
    fun `재채점 결과가 오면 이전 케이스를 남기지 않고 대체한다`() = runTest {
        val saved = submissions.save(pendingSubmission(testUserId()))
        submissions.applyOutcome(outcomeFor(saved.id)) // 케이스 2건

        // 문제의 테스트케이스가 늘어 재채점된 상황 — 케이스가 3건으로 바뀐다.
        submissions.applyOutcome(
            outcomeFor(saved.id).copy(
                result = JudgeResult.WRONG_ANSWER,
                cases = (1..3).map { CaseResult(it, JudgeResult.WRONG_ANSWER, 10, 100) },
            ),
        )

        val stored = cases.findBySubmissionIdIn(listOf(saved.id)).toList()
        assertEquals(3, stored.size, "옛 케이스가 남아 섞이면 안 된다")
        assertEquals(setOf(JudgeResult.WRONG_ANSWER.label), stored.map { it.result }.toSet())
    }

    @Test
    fun `알 수 없는 제출의 결과는 null을 돌려준다`() = runTest {
        // 예외를 던지면 컨슈머가 그 파티션에서 멈춘다 — 흘려보낼 수 있어야 한다.
        assertEquals(null, submissions.applyOutcome(outcomeFor(999_999)))
    }

    private fun pendingSubmission(userId: Long) = Submission(
        id = 0,
        user = "it-tester",
        userId = userId,
        problemId = 1000,
        problemTitle = "두 수의 합",
        result = JudgeResult.PENDING,
        language = Language.PYTHON,
        length = 10,
        code = "print(1)",
        mode = ExecutionMode.SUBMIT,
        submittedAt = Instant.now(),
    )

    private fun outcomeFor(submissionId: Long) = JudgedOutcome(
        submissionId = submissionId,
        result = JudgeResult.ACCEPTED,
        execTimeMs = 24,
        memoryUsedKb = 9420,
        judgedAt = Instant.parse("2026-07-28T12:00:00Z"),
        cases = listOf(
            CaseResult(1, JudgeResult.ACCEPTED, 24, 9420),
            CaseResult(2, JudgeResult.ACCEPTED, 22, 9420),
        ),
    )

    companion object {
        // 시드(R__)까지 적용되므로 문제 1000이 존재한다 — submission의 FK가 성립한다.
        @Container
        @JvmStatic
        private val postgres = PostgreSQLContainer("postgres:16-alpine")

        @DynamicPropertySource
        @JvmStatic
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("spring.r2dbc.username", postgres::getUsername)
            registry.add("spring.r2dbc.password", postgres::getPassword)
            registry.add("spring.flyway.url", postgres::getJdbcUrl)
            registry.add("spring.flyway.user", postgres::getUsername)
            registry.add("spring.flyway.password", postgres::getPassword)
            // 컨테이너 안엔 Kafka·MinIO가 없다 — 이 테스트는 영속 계층만 본다.
            registry.add("cotejs.kafka.brokers") { "localhost:59092" }
        }
    }
}
