package com.cotejs.api.domain.port.outbound

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.model.TraceContext

// 아웃바운드 포트 — 어댑터(R2DBC 영속·Kafka·MinIO)가 구현하는 계약.

interface ProblemRepository {
    suspend fun findAll(): List<Problem>

    suspend fun findById(id: Long): Problem?

    suspend fun findTestCases(problemId: Long): List<TestCase>

    /** 번들을 새로 만들어 올린 뒤 그 참조를 캐시한다. */
    suspend fun updateTestBundle(problemId: Long, bundle: BundleRef)

    /** run 레인용 예제 번들 참조 캐시. */
    suspend fun updateExampleBundle(problemId: Long, bundle: BundleRef)
}

interface SubmissionRepository {
    /** 정식 제출만, 최신순 페이지 — 예제 실행(run)은 기록에 노출하지 않는다. */
    suspend fun findNewestFirst(limit: Int, offset: Int): List<Submission>

    /** [submission].id는 무시되고 저장 후 발급된 id로 반환된다. */
    suspend fun save(submission: Submission): Submission

    /**
     * 채점 결과를 반영한다. at-least-once라 같은 결과가 두 번 올 수 있으므로
     * **멱등**해야 한다([ADR-0011]) — 같은 값으로 덮어써도 결과가 같도록 구현한다.
     * @return 반영된 제출(대상이 없으면 null)
     */
    suspend fun applyOutcome(outcome: JudgedOutcome): Submission?
}

/** 채점 요청 발행(Kafka 제출 레인). */
interface JudgeDispatcher {
    suspend fun dispatch(
        submission: Submission,
        problem: Problem,
        bundle: BundleRef,
        code: String,
        lane: ExecutionLane,
        trace: TraceContext,
    )
}

/** 실행 QoS 레인([ADR-0006]) — 같은 채점기라도 대기열을 나눈다. */
enum class ExecutionLane { RUN, SUBMIT, BATCH }

/**
 * 제출 남용 방지 — 레인별 횟수 제한(ADR-0006의 Redis 역할). 고정 창(fixed window) 카운터:
 * 슬라이딩 창의 정밀함이 필요한 워크로드가 아니다(경계 순간 2배 허용이 무해).
 */
fun interface RateLimiter {
    /** [key]의 창 내 카운트를 올리고 한도 안이면 true. 저장소 장애 시 true(가용성 우선, 로그). */
    suspend fun tryAcquire(key: String, limit: Int, window: java.time.Duration): Boolean
}

/** 테스트 번들 저장소(MinIO) — claim-check의 발행자 측. */
interface BundleStore {
    /** tar.gz로 묶어 올리고 (키, sha256)을 돌려준다. 같은 내용이면 같은 키가 나온다. */
    suspend fun publish(problemId: Long, cases: List<TestCase>): BundleRef
}
