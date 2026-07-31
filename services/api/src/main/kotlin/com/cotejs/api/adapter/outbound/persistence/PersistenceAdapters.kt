package com.cotejs.api.adapter.outbound.persistence

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.CaseResult
import com.cotejs.api.domain.model.Difficulty
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.Example
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Role
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.model.User
import com.cotejs.api.domain.port.outbound.ProblemRepository
import com.cotejs.api.domain.port.outbound.SubmissionRepository
import com.cotejs.api.domain.port.outbound.UserRepository
import java.time.Instant
import kotlinx.coroutines.flow.toList
import org.springframework.dao.DuplicateKeyException
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

// 아웃바운드 어댑터 — R2DBC 엔티티 ↔ 도메인 매핑(Repository 경계).

@Component
class ProblemPersistenceAdapter(
    private val problemRepo: ProblemR2dbcRepository,
    private val exampleRepo: ExampleR2dbcRepository,
    private val testCaseRepo: TestCaseR2dbcRepository,
    private val templateRepo: StarterTemplateR2dbcRepository,
    private val json: ObjectMapper,
) : ProblemRepository {
    override suspend fun findAll(): List<Problem> {
        val rows = problemRepo.findAll().toList().sortedBy { it.id }
        if (rows.isEmpty()) return emptyList()
        val examplesByProblem =
            exampleRepo.findByProblemIdIn(rows.map { it.id }).toList().groupBy { it.problemId }
        val templates = starterTemplates()
        return rows.map { it.toDomain(examplesByProblem[it.id].orEmpty(), templates) }
    }

    override suspend fun findById(id: Long): Problem? {
        val row = problemRepo.findById(id) ?: return null
        val examples = exampleRepo.findByProblemIdIn(listOf(id)).toList()
        return row.toDomain(examples, starterTemplates())
    }

    private suspend fun starterTemplates(): Map<String, String> =
        templateRepo.findAll().toList().associate { it.language to it.code }

    override suspend fun findTestCases(problemId: Long): List<TestCase> =
        testCaseRepo.findByProblemIdOrderByOrd(problemId).toList()
            .map { TestCase(ord = it.ord, input = it.input, output = it.output) }

    override suspend fun updateTestBundle(problemId: Long, bundle: BundleRef) {
        problemRepo.updateTestBundle(problemId, bundle.key, bundle.sha256)
    }

    override suspend fun updateExampleBundle(problemId: Long, bundle: BundleRef) {
        problemRepo.updateExampleBundle(problemId, bundle.key, bundle.sha256)
    }

    private fun ProblemEntity.toDomain(examples: List<ExampleEntity>, templates: Map<String, String>): Problem =
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
            exampleBundle = exampleBundleKey?.let { key ->
                exampleBundleSha256?.let { sha -> BundleRef(key, sha) }
            },
            submissionCount = submissionCount,
            acceptedCount = acceptedCount,
            tags = tags,
            aiGenerated = aiGenerated,
            description = description,
            inputDesc = inputDesc,
            outputDesc = outputDesc,
            examples = examples.sortedBy { it.ord }.map { Example(it.input, it.output) },
            // 유효 스타터 = 공용 템플릿 위에 문제별 오버라이드를 덮는다(ADR-0020).
            // JSONB는 asArray()로 받아 Jackson이 UTF-8로 해석하게 한다.
            // asString()은 JVM 기본 문자셋 디코딩이라 Windows(MS949)에서 한글이 깨진다.
            starterCode = templates + (starterCode?.let { json.readValue<Map<String, String>>(it.asArray()) } ?: emptyMap()),
        )
}

@Component
class UserPersistenceAdapter(
    private val userRepo: UserR2dbcRepository,
) : UserRepository {
    override suspend fun findById(id: Long): User? = userRepo.findById(id)?.toDomain()

    override suspend fun upsert(provider: String, providerId: String, nickname: String): User {
        val existing = userRepo.findByProviderAndProviderId(provider, providerId)
        val saved = when {
            existing == null -> try {
                userRepo.save(
                    UserEntity(
                        provider = provider,
                        providerId = providerId,
                        nickname = nickname,
                        role = Role.USER.name,
                        createdAt = Instant.now(),
                    ),
                )
            } catch (_: DuplicateKeyException) {
                // 동시 첫 로그인 경합 — UNIQUE(provider, provider_id)가 한쪽을 이기게 했으니
                // 진 쪽은 이긴 행을 읽어 닉네임만 맞춘다.
                val won = requireNotNull(userRepo.findByProviderAndProviderId(provider, providerId))
                if (won.nickname == nickname) won else userRepo.save(won.copy(nickname = nickname))
            }
            // 재로그인 — 닉네임은 로그인 시점 스냅샷이므로 바뀌었을 때만 갱신.
            existing.nickname != nickname -> userRepo.save(existing.copy(nickname = nickname))
            else -> existing
        }
        return saved.toDomain()
    }

    private fun UserEntity.toDomain(): User = User(
        id = requireNotNull(id) { "persisted user must have id" },
        provider = provider,
        providerId = providerId,
        nickname = nickname,
        role = Role.fromName(role),
    )
}

@Component
class SubmissionPersistenceAdapter(
    private val submissionRepo: SubmissionR2dbcRepository,
    private val caseRepo: SubmissionCaseR2dbcRepository,
    private val problemRepo: ProblemR2dbcRepository,
) : SubmissionRepository {
    override suspend fun findNewestFirst(limit: Int, offset: Int): List<Submission> {
        val rows = submissionRepo.findByModeNewestFirst(ExecutionMode.SUBMIT.label, limit, offset).toList()
        if (rows.isEmpty()) return emptyList()

        // 케이스별 결과를 함께 싣는다 — 응답에 필드가 있는데 항상 비어 있으면 계약이 거짓이 된다.
        val casesBySubmission = caseRepo.findBySubmissionIdIn(rows.mapNotNull { it.id })
            .toList().groupBy { it.submissionId }
        // 제목은 비정규화 컬럼 대신 조인(프로젝션) — 제목 수정이 과거 제출에도 반영된다(V6).
        val titles = problemRepo.findTitles(rows.map { it.problemId }.distinct())
            .toList().associate { it.id to it.title }
        return rows.map { row ->
            row.toDomain(
                cases = casesBySubmission[row.id].orEmpty().sortedBy { it.no }.map { it.toDomain() },
                problemTitle = titles[row.problemId] ?: "(삭제된 문제)",
            )
        }
    }

    override suspend fun save(submission: Submission): Submission =
        // 제목은 저장하지 않는다 — 입력 도메인 객체의 것을 되돌려줄 뿐(진실원은 problem).
        submissionRepo.save(submission.toEntity()).toDomain(problemTitle = submission.problemTitle)

    /**
     * 멱등 반영: 대상 행을 읽어 결과 필드만 덮어쓴다. 같은 결과가 두 번 와도
     * 두 번째는 같은 값을 다시 쓸 뿐이라 상태가 변하지 않는다(at-least-once 흡수).
     */
    override suspend fun applyOutcome(outcome: JudgedOutcome): Submission? {
        val row = submissionRepo.findById(outcome.submissionId) ?: return null
        val updated = row.copy(
            result = outcome.result.name,
            execTimeMs = outcome.execTimeMs,
            memoryUsedKb = outcome.memoryUsedKb,
            judgedAt = outcome.judgedAt,
        )
        val saved = submissionRepo.save(updated)

        // 케이스별 결과는 "전부 지우고 다시 넣는다" — 같은 결과가 두 번 와도(at-least-once)
        // 행이 늘어나지 않는 가장 단순한 멱등 구현.
        caseRepo.deleteBySubmissionId(outcome.submissionId)
        if (outcome.cases.isNotEmpty()) {
            caseRepo.saveAll(
                outcome.cases.map {
                    SubmissionCaseEntity(
                        submissionId = outcome.submissionId,
                        no = it.no,
                        result = it.result.name,
                        execTimeMs = it.execTimeMs,
                        memoryUsedKb = it.memoryUsedKb,
                    )
                },
            ).toList()
        }
        val title = problemRepo.findTitles(listOf(saved.problemId)).toList().firstOrNull()?.title
        return saved.toDomain(outcome.cases, title ?: "(삭제된 문제)")
    }

    private fun SubmissionCaseEntity.toDomain(): CaseResult =
        CaseResult(
            no = no,
            result = JudgeResult.fromName(result),
            execTimeMs = execTimeMs,
            memoryUsedKb = memoryUsedKb,
        )

    private fun SubmissionEntity.toDomain(cases: List<CaseResult> = emptyList(), problemTitle: String): Submission =
        Submission(
            id = requireNotNull(id) { "persisted submission must have id" },
            user = username,
            userId = userId,
            problemId = problemId,
            problemTitle = problemTitle,
            // 저장값은 enum name(V6, ADR-0020) — 표시 라벨은 응답 DTO에서 붙는다.
            result = JudgeResult.fromName(result),
            language = Language.fromLabel(language),
            execTimeMs = execTimeMs,
            memoryUsedKb = memoryUsedKb,
            length = length,
            code = code,
            mode = ExecutionMode.fromLabel(mode),
            submittedAt = submittedAt,
            judgedAt = judgedAt,
            cases = cases,
        )

    private fun Submission.toEntity(): SubmissionEntity =
        SubmissionEntity(
            id = null, // 신규 저장 — id는 DB가 발급
            username = user,
            userId = userId,
            problemId = problemId,
            result = result.name,
            language = language.label,
            execTimeMs = execTimeMs,
            memoryUsedKb = memoryUsedKb,
            length = length,
            code = code,
            mode = mode.label,
            submittedAt = submittedAt,
            judgedAt = judgedAt,
        )
}
