package com.cotejs.api.domain

import com.cotejs.api.domain.model.TraceContext
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull

/**
 * W3C traceparent 파싱 — 브라우저·프록시를 거쳐 온 **외부 입력**이라 형식 검증이 곧 정책이다.
 * 깨진 값을 관대하게 받으면 오염된 추적 id가 로그 전 구간에 퍼진다([ADR-0017]).
 */
class TraceContextTest {

    private val valid = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"

    @Test
    fun `유효한 traceparent를 파싱한다`() {
        val t = TraceContext.parse(valid)
        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", t?.traceId)
        assertEquals("00f067aa0ba902b7", t?.spanId)
        assertNull(t?.parentSpanId)
    }

    @Test
    fun `깨진 traceparent는 버린다 - 새 추적으로 시작해야 한다`() {
        listOf(
            null,
            "",
            "not-a-trace",
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7", // 플래그 누락
            "00-4bf92f3577b34da6a3ce929d0e0e47-00f067aa0ba902b7-01", // trace-id 길이 미달
            "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01", // 대문자(스펙상 소문자만)
            "00-00000000000000000000000000000000-00f067aa0ba902b7-01", // all-zero trace-id
            "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01", // all-zero span-id
            "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", // 무효 버전
        ).forEach { header ->
            assertNull(TraceContext.parse(header), "파싱을 거부해야 한다: $header")
        }
    }

    @Test
    fun `child는 같은 추적을 잇고 부모 span을 기록한다`() {
        val parent = TraceContext.parse(valid)!!
        val child = parent.child()
        assertEquals(parent.traceId, child.traceId, "추적 id는 전 구간에서 같아야 한다")
        assertEquals(parent.spanId, child.parentSpanId, "부모 관계가 끊기면 구간을 이을 수 없다")
        assertNotEquals(parent.spanId, child.spanId, "구간마다 span은 새로 딴다")
    }
}
