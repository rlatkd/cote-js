package com.cotejs.api.domain

import com.cotejs.api.domain.model.Difficulty
import com.cotejs.api.domain.model.ExecutionMode
import com.cotejs.api.domain.model.JudgeResult
import com.cotejs.api.domain.model.Language
import com.cotejs.api.domain.model.TraceContext
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * 도메인 규칙 — 인프라 없이 검증한다([ADR-0016] 선별적 TDD: 정책·규칙은 테스트로 고정).
 *
 * 여기서 잡는 것은 **레이블 왕복**이다: enum의 label은 DB에 문자열로 저장되고 API 응답으로도
 * 나가므로, label이 바뀌면 **저장된 과거 데이터를 못 읽는다**. 조용히 깨지는 종류의 변경이라
 * 테스트로 고정한다.
 */
class DomainRulesTest {

    @Test
    fun `모든 enum은 label로 왕복된다`() {
        Language.entries.forEach { assertEquals(it, Language.fromLabel(it.label)) }
        JudgeResult.entries.forEach { assertEquals(it, JudgeResult.fromLabel(it.label)) }
        ExecutionMode.entries.forEach { assertEquals(it, ExecutionMode.fromLabel(it.label)) }
        Difficulty.entries.forEach { assertEquals(it, Difficulty.fromLabel(it.label)) }
    }

    @Test
    fun `JudgeResult의 name은 저장 계약이다 - 이름을 바꾸면 저장된 행을 못 읽는다`() {
        // V6부터 DB에 enum name이 저장된다(ADR-0020). label(표시 문구)은 바꿔도 되지만
        // name 집합이 바뀌면 데이터 마이그레이션이 함께 가야 한다 — 이 테스트가 그걸 알린다.
        assertEquals(
            setOf(
                "ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT", "MEMORY_LIMIT",
                "RUNTIME_ERROR", "COMPILE_ERROR", "PENDING", "INTERNAL_ERROR",
            ),
            JudgeResult.entries.map { it.name }.toSet(),
        )
        JudgeResult.entries.forEach { assertEquals(it, JudgeResult.fromName(it.name)) }
        assertFailsWith<IllegalArgumentException> { JudgeResult.fromName("맞았습니다") } // 라벨은 저장값이 아니다
    }

    @Test
    fun `알 수 없는 label은 조용히 통과하지 않는다`() {
        // 잘못된 입력이 기본값으로 흡수되면 오판정·오분류가 조용히 퍼진다.
        assertFailsWith<IllegalArgumentException> { Language.fromLabel("C++") }
        assertFailsWith<IllegalArgumentException> { ExecutionMode.fromLabel("batch") }
        assertFailsWith<IllegalArgumentException> { JudgeResult.fromLabel("통과") }
    }

    @Test
    fun `judge가 지원하는 언어만 접수한다`() {
        // web·api·judge의 언어 목록이 어긋나면 채점기 없는 언어를 받아 오판정한다([ADR-0013]).
        assertEquals(
            setOf("Python", "Java", "JavaScript"),
            Language.entries.map { it.label }.toSet(),
        )
    }

    @Test
    fun `채점 시스템 장애는 오답류와 구분되는 판정을 갖는다`() {
        // 유저 귀책이 아닌 실패를 오답으로 기록하면 사용자가 자기 코드를 의심한다.
        assertTrue(JudgeResult.entries.contains(JudgeResult.INTERNAL_ERROR))
        assertNotEquals(JudgeResult.WRONG_ANSWER, JudgeResult.INTERNAL_ERROR)
    }

    @Test
    fun `추적 컨텍스트는 W3C 형식을 따른다`() {
        val trace = TraceContext.start()

        // trace_id 16바이트(32자 hex), span_id 8바이트(16자 hex) — 표준을 어기면
        // 나중에 OpenTelemetry를 얹을 때 우리 값이 그대로 못 들어간다([ADR-0017]).
        assertTrue(trace.traceId.matches(Regex("[0-9a-f]{32}")), "trace_id=${trace.traceId}")
        assertTrue(trace.spanId.matches(Regex("[0-9a-f]{16}")), "span_id=${trace.spanId}")
        assertEquals(null, trace.parentSpanId, "흐름의 시작점은 부모가 없다")
    }

    @Test
    fun `추적 컨텍스트는 매번 새로 만들어진다`() {
        assertNotEquals(TraceContext.start().traceId, TraceContext.start().traceId)
    }
}
