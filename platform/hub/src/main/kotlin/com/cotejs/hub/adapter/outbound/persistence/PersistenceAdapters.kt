package com.cotejs.hub.adapter.outbound.persistence

import com.cotejs.hub.domain.model.Difficulty
import com.cotejs.hub.domain.model.Example
import com.cotejs.hub.domain.model.JudgeResult
import com.cotejs.hub.domain.model.Language
import com.cotejs.hub.domain.model.Problem
import com.cotejs.hub.domain.model.Submission
import com.cotejs.hub.domain.port.outbound.ProblemRepository
import com.cotejs.hub.domain.port.outbound.SubmissionRepository
import kotlinx.coroutines.flow.toList
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

// 아웃바운드 어댑터 — R2DBC 엔티티 ↔ 도메인 매핑(Repository 경계).

@Component
class ProblemPersistenceAdapter(
    private val problemRepo: ProblemR2dbcRepository,
    private val exampleRepo: ExampleR2dbcRepository,
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

    private fun ProblemEntity.toDomain(examples: List<ExampleEntity>): Problem =
        Problem(
            id = id,
            title = title,
            difficulty = Difficulty.fromLabel(difficulty),
            tier = tier,
            timeLimit = timeLimit,
            memoryLimit = memoryLimit,
            submissionCount = submissionCount,
            acceptedCount = acceptedCount,
            tags = tags,
            aiGenerated = aiGenerated,
            description = description,
            inputDesc = inputDesc,
            outputDesc = outputDesc,
            examples = examples.sortedBy { it.ord }.map { Example(it.input, it.output) },
            starterCode = json.readValue(starterCode.asString()),
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

    private fun SubmissionEntity.toDomain(): Submission =
        Submission(
            id = requireNotNull(id) { "persisted submission must have id" },
            user = username,
            problemId = problemId,
            problemTitle = problemTitle,
            result = JudgeResult.fromLabel(result),
            language = Language.fromLabel(language),
            time = execTime,
            memory = execMemory,
            length = length,
            submittedAt = submittedAt,
        )

    private fun Submission.toEntity(): SubmissionEntity =
        SubmissionEntity(
            id = null, // 신규 저장 — id는 DB가 발급
            username = user,
            problemId = problemId,
            problemTitle = problemTitle,
            result = result.label,
            language = language.label,
            execTime = time,
            execMemory = memory,
            length = length,
            submittedAt = submittedAt,
        )
}
