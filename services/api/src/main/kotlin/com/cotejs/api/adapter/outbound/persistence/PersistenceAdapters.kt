package com.cotejs.api.adapter.outbound.persistence

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.Difficulty
import com.cotejs.api.domain.model.Example
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.port.outbound.ProblemRepository
import com.cotejs.api.domain.port.outbound.SubmissionRepository
import kotlinx.coroutines.flow.toList
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

// 아웃바운드 어댑터 — R2DBC 엔티티 ↔ 도메인 매핑(Repository 경계).

@Component
class ProblemPersistenceAdapter(
    private val problemRepo: ProblemR2dbcRepository,
    private val exampleRepo: ExampleR2dbcRepository,
    private val testCaseRepo: TestCaseR2dbcRepository,
    private val json: ObjectMapper,
) : ProblemRepository {
    override suspend fun findAll(): List<Problem> {
        val rows = problemRepo.findAll().toList().sortedBy { it.id }
        if (rows.isEmpty()) return emptyList()
        val examplesByProblem =
            exampleRepo.findByProblemIdIn(rows.map { it.id }).toList().groupBy { it.problemId }
        return rows.map { it.toDomain(examplesByProblem[it.id].orEmpty()) }
    }

    override suspend fun findById(id: Long): Problem? {
        val row = problemRepo.findById(id) ?: return null
        val examples = exampleRepo.findByProblemIdIn(listOf(id)).toList()
        return row.toDomain(examples)
    }

    override suspend fun findTestCases(problemId: Long): List<TestCase> =
        testCaseRepo.findByProblemIdOrderByOrd(problemId).toList()
            .map { TestCase(ord = it.ord, input = it.input, output = it.output) }

    override suspend fun updateTestBundle(problemId: Long, bundle: BundleRef) {
        problemRepo.updateTestBundle(problemId, bundle.key, bundle.sha256)
    }

    private fun ProblemEntity.toDomain(examples: List<ExampleEntity>): Problem =
        Problem(
            id = id,
            title = title,
            difficulty = Difficulty.fromLabel(difficulty),
            tier = tier,
            timeLimitMs = timeLimitMs,
            memoryLimitMb = memoryLimitMb,
            testBundle = testBundleKey?.let { key ->
                testBundleSha256?.let { sha -> BundleRef(key, sha) }
            },
            submissionCount = submissionCount,
            acceptedCount = acceptedCount,
            tags = tags,
            aiGenerated = aiGenerated,
            description = description,
            inputDesc = inputDesc,
            outputDesc = outputDesc,
            examples = examples.sortedBy { it.ord }.map { Example(it.input, it.output) },
            // JSONB는 asArray()로 받아 Jackson이 UTF-8로 해석하게 한다.
            // asString()은 JVM 기본 문자셋 디코딩이라 Windows(MS949)에서 한글이 깨진다.
            starterCode = json.readValue(starterCode.asArray()),
        )
}

@Component
class SubmissionPersistenceAdapter(
    private val submissionRepo: SubmissionR2dbcRepository,
) : SubmissionRepository {
    override suspend fun findAllNewestFirst(): List<Submission> =
        submissionRepo.findAllByOrderBySubmittedAtDesc().toList().map { it.toDomain() }

    override suspend fun save(submission: Submission): Submission =
        submissionRepo.save(submission.toEntity()).toDomain()

    /**
     * 멱등 반영: 대상 행을 읽어 결과 필드만 덮어쓴다. 같은 결과가 두 번 와도
     * 두 번째는 같은 값을 다시 쓸 뿐이라 상태가 변하지 않는다(at-least-once 흡수).
     */
    override suspend fun applyOutcome(outcome: JudgedOutcome): Submission? {
        val row = submissionRepo.findById(outcome.submissionId) ?: return null
        val updated = row.copy(
            result = outcome.result.label,
            execTimeMs = outcome.execTimeMs,
            memoryUsedKb = outcome.memoryUsedKb,
            judgedAt = outcome.judgedAt,
        )
        return submissionRepo.save(updated).toDomain()
    }

    private fun SubmissionEntity.toDomain(): Submission =
        Submission(
            id = requireNotNull(id) { "persisted submission must have id" },
            user = username,
            problemId = problemId,
            problemTitle = problemTitle,
            result = JudgeResult.fromLabel(result),
            language = Language.fromLabel(language),
            execTimeMs = execTimeMs,
            memoryUsedKb = memoryUsedKb,
            length = length,
            code = code,
            submittedAt = submittedAt,
            judgedAt = judgedAt,
        )

    private fun Submission.toEntity(): SubmissionEntity =
        SubmissionEntity(
            id = null, // 신규 저장 — id는 DB가 발급
            username = user,
            problemId = problemId,
            problemTitle = problemTitle,
            result = result.label,
            language = language.label,
            execTimeMs = execTimeMs,
            memoryUsedKb = memoryUsedKb,
            length = length,
            code = code,
            submittedAt = submittedAt,
            judgedAt = judgedAt,
        )
}
