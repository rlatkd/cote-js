package com.cotejs.api.application.auth

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * 자체 JWT(HS256) — 세션의 진위가 전부 이 검증에 걸려 있으므로 실패 경로를 전부 고정한다
 * ([ADR-0016] 선별적 TDD: 정책·보안 규칙은 테스트 먼저, [ADR-0019]).
 */
class JwtCodecTest {

    private val json = jacksonObjectMapper()
    private val now: Instant = Instant.parse("2026-07-31T12:00:00Z")
    private val clock: Clock = Clock.fixed(now, ZoneOffset.UTC)
    private val codec = JwtCodec("test-secret-0123456789", json, clock)

    @Test
    fun `발급한 토큰은 주체와 부가 클레임까지 왕복된다`() {
        val token = codec.issue("access", "42", Duration.ofHours(1), mapOf("nick" to "상훈", "role" to "USER"))
        val claims = assertNotNull(codec.verify(token, "access"))
        assertEquals("42", claims.subject)
        assertEquals("상훈", claims.extra["nick"])
        assertEquals("USER", claims.extra["role"])
    }

    @Test
    fun `만료된 토큰은 무효다`() {
        val token = codec.issue("access", "42", Duration.ofMinutes(10))
        val later = JwtCodec("test-secret-0123456789", json, Clock.fixed(now.plusSeconds(601), ZoneOffset.UTC))
        assertNull(later.verify(token, "access"), "만료 후에는 거부해야 한다")
        assertNotNull(codec.verify(token, "access"), "만료 전에는 유효해야 한다")
    }

    @Test
    fun `페이로드를 변조하면 무효다`() {
        val token = codec.issue("access", "42", Duration.ofHours(1))
        val parts = token.split(".")
        val forged = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"sub":"1","typ":"access","iat":0,"exp":9999999999}""".toByteArray())
        assertNull(codec.verify("${parts[0]}.$forged.${parts[2]}", "access"), "서명이 다른 페이로드는 거부")
    }

    @Test
    fun `다른 비밀키로 서명한 토큰은 무효다`() {
        val other = JwtCodec("another-secret", json, clock)
        assertNull(codec.verify(other.issue("access", "42", Duration.ofHours(1)), "access"))
    }

    @Test
    fun `토큰 종류가 다르면 무효다 - refresh로 access 흉내 금지`() {
        val refresh = codec.issue("refresh", "42", Duration.ofDays(14))
        assertNull(codec.verify(refresh, "access"), "refresh 토큰이 access 자리에서 통하면 수명 정책이 무너진다")
    }

    @Test
    fun `깨진 입력은 전부 무효다`() {
        listOf(null, "", "abc", "a.b", "a.b.c.d", "..", "a.%%%.c").forEach {
            assertNull(codec.verify(it, "access"), "거부해야 한다: $it")
        }
    }
}
