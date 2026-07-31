package com.cotejs.api.application.auth

import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import tools.jackson.databind.ObjectMapper

/**
 * 자체 세션 JWT(HS256) 발급·검증 — 프레임워크 없이 직접 구현(ADR-0019).
 * 암호 원시 연산(HMAC)은 JDK 내장(javax.crypto)만 쓴다 — "직접 구현 금지" 통념이
 * 가리키는 위험은 원시 연산의 자작이지, 형식(base64url 3분절)의 조립이 아니다.
 *
 * 검증은 실패 사유를 구분하지 않고 null을 돌려준다 — 세션 무효는 예외 상황이 아니라
 * 일상 경로(만료)라서, 호출자는 "비로그인"으로만 취급하면 된다.
 */
class JwtCodec(
    secret: String,
    private val json: ObjectMapper,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val key = SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256")

    data class Claims(val subject: String, val extra: Map<String, String>)

    /** [type]은 용도 분리(access/refresh/state) — 검증 시 같은 값이어야 한다. */
    fun issue(type: String, subject: String, ttl: Duration, extra: Map<String, String> = emptyMap()): String {
        val now = clock.instant()
        val payload = buildMap {
            put("sub", subject)
            put("typ", type)
            put("iat", now.epochSecond)
            put("exp", now.plus(ttl).epochSecond)
            extra.forEach { (k, v) -> put(k, v) }
        }
        val head = b64(json.writeValueAsBytes(mapOf("alg" to "HS256", "typ" to "JWT")))
        val body = b64(json.writeValueAsBytes(payload))
        return "$head.$body.${b64(hmac("$head.$body"))}"
    }

    fun verify(token: String?, type: String): Claims? {
        if (token.isNullOrBlank()) return null
        val parts = token.split(".")
        if (parts.size != 3) return null

        // 서명 확인이 항상 먼저다 — 서명이 깨진 페이로드는 파싱할 가치도 없다.
        // 비교는 상수 시간(타이밍으로 서명을 유추하는 공격 차단).
        val expected = b64(hmac("${parts[0]}.${parts[1]}"))
        if (!MessageDigest.isEqual(expected.toByteArray(), parts[2].toByteArray())) return null

        val payload = runCatching {
            json.readValue(Base64.getUrlDecoder().decode(parts[1]), Map::class.java)
        }.getOrNull() ?: return null

        if (payload["typ"] != type) return null // refresh가 access 자리에서 통하면 수명 정책이 무너진다
        val exp = (payload["exp"] as? Number)?.toLong() ?: return null
        if (clock.instant().epochSecond >= exp) return null
        val subject = payload["sub"] as? String ?: return null

        val reserved = setOf("sub", "typ", "iat", "exp")
        val extra = payload.entries
            .filter { it.key !in reserved }
            .associate { it.key.toString() to it.value.toString() }
        return Claims(subject, extra)
    }

    // Mac 인스턴스는 스레드 안전하지 않다 — 호출마다 생성(경합 대신 소량 할당을 택함).
    private fun hmac(data: String): ByteArray =
        Mac.getInstance("HmacSHA256").apply { init(key) }.doFinal(data.toByteArray(Charsets.UTF_8))

    private fun b64(bytes: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
}
