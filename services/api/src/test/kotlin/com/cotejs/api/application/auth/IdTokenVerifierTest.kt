package com.cotejs.api.application.auth

import com.cotejs.api.domain.model.AuthException
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.RSAPublicKey
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * 카카오 id_token(RS256) 검증 — 위조 로그인을 막는 최후의 선이므로 거부 경로를 전부 고정한다.
 * 실제 카카오 대신 자체 RSA 키쌍으로 토큰을 위조/정조해 검증기만 순수하게 시험한다([ADR-0019]).
 */
class IdTokenVerifierTest {

    private val json = jacksonObjectMapper()
    private val now: Instant = Instant.parse("2026-07-31T12:00:00Z")
    private val verifier = IdTokenVerifier(json, Clock.fixed(now, ZoneOffset.UTC))

    private val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val keys: Map<String, RSAPublicKey> = mapOf("kid-1" to keyPair.public as RSAPublicKey)

    private val issuer = "https://kauth.kakao.com"
    private val audience = "test-client-id"

    private fun idToken(
        kid: String = "kid-1",
        alg: String = "RS256",
        iss: String = issuer,
        aud: String = audience,
        exp: Long = now.plusSeconds(600).epochSecond,
        nonce: String? = "nonce-1",
        sub: String = "kakao-sub-123",
        nickname: String? = "상훈",
        signWith: PrivateKey = keyPair.private,
    ): String {
        fun b64(bytes: ByteArray) = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        val header = b64(json.writeValueAsBytes(mapOf("alg" to alg, "kid" to kid)))
        val claims = buildMap<String, Any> {
            put("iss", iss); put("aud", aud); put("exp", exp); put("sub", sub)
            nonce?.let { put("nonce", it) }
            nickname?.let { put("nickname", it) }
        }
        val payload = b64(json.writeValueAsBytes(claims))
        val sig = Signature.getInstance("SHA256withRSA").apply {
            initSign(signWith)
            update("$header.$payload".toByteArray())
        }
        return "$header.$payload.${b64(sig.sign())}"
    }

    @Test
    fun `정상 토큰은 신원을 돌려준다`() {
        val identity = verifier.verify(idToken(), keys, issuer, audience, "nonce-1")
        assertEquals("kakao-sub-123", identity.subject)
        assertEquals("상훈", identity.nickname)
    }

    @Test
    fun `닉네임이 없어도 신원은 성립한다 - 동의 거부 대비`() {
        val identity = verifier.verify(idToken(nickname = null), keys, issuer, audience, "nonce-1")
        assertEquals(null, identity.nickname)
    }

    @Test
    fun `다른 키로 서명한 토큰은 거부한다`() {
        val otherPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        assertFailsWith<AuthException> {
            verifier.verify(idToken(signWith = otherPair.private), keys, issuer, audience, "nonce-1")
        }
    }

    @Test
    fun `모르는 kid는 거부한다`() {
        assertFailsWith<AuthException> { verifier.verify(idToken(kid = "kid-x"), keys, issuer, audience, "nonce-1") }
    }

    @Test
    fun `RS256이 아닌 알고리즘은 거부한다 - alg 바꿔치기 공격 차단`() {
        // "none"·HS256으로 바꿔치는 고전 공격 — 알고리즘은 우리가 고정하고 헤더를 믿지 않는다.
        assertFailsWith<AuthException> { verifier.verify(idToken(alg = "none"), keys, issuer, audience, "nonce-1") }
    }

    @Test
    fun `발급자·수신자·만료·nonce가 어긋나면 거부한다`() {
        assertFailsWith<AuthException>("다른 발급자") {
            verifier.verify(idToken(iss = "https://evil.example"), keys, issuer, audience, "nonce-1")
        }
        assertFailsWith<AuthException>("다른 앱의 토큰") {
            verifier.verify(idToken(aud = "other-app"), keys, issuer, audience, "nonce-1")
        }
        assertFailsWith<AuthException>("만료") {
            verifier.verify(idToken(exp = now.minusSeconds(1).epochSecond), keys, issuer, audience, "nonce-1")
        }
        assertFailsWith<AuthException>("nonce 불일치 = 리플레이 의심") {
            verifier.verify(idToken(nonce = "stolen"), keys, issuer, audience, "nonce-1")
        }
    }
}
