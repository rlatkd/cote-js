package com.cotejs.api.application.auth

import com.cotejs.api.domain.model.AuthException
import java.security.Signature
import java.security.interfaces.RSAPublicKey
import java.time.Clock
import java.util.Base64
import tools.jackson.databind.ObjectMapper

/**
 * OIDC id_token(RS256) 검증 — 순수 로직. 키 조달(JWKS)은 포트(OidcProvider) 뒤의 I/O고,
 * 여기는 "주어진 키로 이 토큰이 진짜인가"만 답한다(ADR-0019).
 *
 * JwtCodec과 달리 실패가 **예외**다 — 로그인 절차 도중의 실패는 원인(만료/위조/설정 오류)을
 * 로그로 구분해야 운영이 가능하기 때문. (세션 검증의 null과 대비되는 의도적 차이)
 */
class IdTokenVerifier(
    private val json: ObjectMapper,
    private val clock: Clock = Clock.systemUTC(),
) {
    data class Identity(val subject: String, val nickname: String?)

    fun verify(
        idToken: String,
        keys: Map<String, RSAPublicKey>,
        issuer: String,
        audience: String,
        nonce: String,
    ): Identity {
        val parts = idToken.split(".")
        if (parts.size != 3) throw AuthException("id_token 형식 오류")

        val header = parseJson(parts[0], "헤더")
        // 알고리즘은 우리가 고정한다 — 헤더의 alg를 믿으면 "none"/HS256 바꿔치기 공격에 뚫린다.
        if (header["alg"] != "RS256") throw AuthException("지원하지 않는 서명 알고리즘: ${header["alg"]}")
        val key = keys[header["kid"]] ?: throw AuthException("알 수 없는 서명 키: kid=${header["kid"]}")

        val signature = Signature.getInstance("SHA256withRSA").apply {
            initVerify(key)
            update("${parts[0]}.${parts[1]}".toByteArray(Charsets.UTF_8))
        }
        val valid = runCatching { signature.verify(Base64.getUrlDecoder().decode(parts[2])) }.getOrDefault(false)
        if (!valid) throw AuthException("id_token 서명 불일치")

        val claims = parseJson(parts[1], "클레임")
        if (claims["iss"] != issuer) throw AuthException("발급자 불일치: ${claims["iss"]}")
        // aud는 스펙상 배열일 수도 있다 — 카카오는 단일 문자열이지만 방어적으로 둘 다 받는다.
        val audOk = when (val aud = claims["aud"]) {
            is String -> aud == audience
            is List<*> -> audience in aud
            else -> false
        }
        if (!audOk) throw AuthException("수신자(aud) 불일치 — 다른 앱의 토큰")
        val exp = (claims["exp"] as? Number)?.toLong() ?: throw AuthException("만료(exp) 클레임 없음")
        if (clock.instant().epochSecond >= exp) throw AuthException("id_token 만료")
        // nonce: 우리가 인가 요청에 실어 보낸 값이 그대로 돌아와야 한다(리플레이 차단).
        if (claims["nonce"] != nonce) throw AuthException("nonce 불일치 — 리플레이 의심")

        val subject = claims["sub"] as? String ?: throw AuthException("sub 클레임 없음")
        return Identity(subject = subject, nickname = claims["nickname"] as? String)
    }

    private fun parseJson(b64: String, what: String): Map<*, *> =
        runCatching { json.readValue(Base64.getUrlDecoder().decode(b64), Map::class.java) }
            .getOrElse { throw AuthException("id_token $what 파싱 실패", it) }
}
