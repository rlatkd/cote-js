package com.cotejs.api.application

import com.cotejs.api.application.auth.IdTokenVerifier
import com.cotejs.api.application.auth.JwtCodec
import com.cotejs.api.config.AuthProperties
import com.cotejs.api.domain.model.AuthException
import com.cotejs.api.domain.model.AuthPrincipal
import com.cotejs.api.domain.model.LoginStart
import com.cotejs.api.domain.model.Role
import com.cotejs.api.domain.model.TokenPair
import com.cotejs.api.domain.model.User
import com.cotejs.api.domain.port.inbound.AuthFlows
import com.cotejs.api.domain.port.outbound.OidcProvider
import com.cotejs.api.domain.port.outbound.UserRepository
import java.security.SecureRandom
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

/**
 * 인증 유스케이스(ADR-0019) — 카카오 OIDC 위임 + 자체 JWT 세션.
 *
 * state·nonce는 서버 저장 없이 **서명 쿠키(state 토큰)**로 콜백까지 잇는다:
 * state = CSRF 방어(우리가 시작한 로그인인가), nonce = id_token 리플레이 방어.
 * 위조하려면 JWT 서명을 깨야 하므로 저장소 없이도 무결성이 성립한다.
 */
@Service
class AuthService(
    private val users: UserRepository,
    private val oidc: OidcProvider,
    private val jwt: JwtCodec,
    private val idTokens: IdTokenVerifier,
    private val props: AuthProperties,
) : AuthFlows {
    private val log = LoggerFactory.getLogger(javaClass)
    private val random = SecureRandom()

    override fun beginLogin(): LoginStart {
        val state = randomToken()
        val nonce = randomToken()
        val stateToken = jwt.issue("state", state, props.jwt.stateTtl, mapOf("nonce" to nonce))
        return LoginStart(oidc.authorizeUrl(state, nonce), stateToken, props.jwt.stateTtl)
    }

    override suspend fun completeLogin(code: String, state: String, stateToken: String?): TokenPair {
        val claims = jwt.verify(stateToken, "state")
            ?: throw AuthException("로그인 절차가 만료되었거나 시작된 적이 없다 — 다시 시도")
        if (claims.subject != state) throw AuthException("state 불일치 — CSRF 의심")
        val nonce = claims.extra["nonce"] ?: throw AuthException("state 토큰에 nonce 없음")

        val idToken = oidc.exchangeCode(code)
        val identity = idTokens.verify(
            idToken = idToken,
            keys = oidc.signingKeys(),
            issuer = props.kakao.issuer,
            audience = props.kakao.clientId,
            nonce = nonce,
        )
        // 닉네임 동의를 거부해도 로그인은 성립한다 — 신원은 sub만으로 충분(ADR-0019).
        val user = users.upsert(
            provider = "kakao",
            providerId = identity.subject,
            nickname = identity.nickname ?: "사용자${identity.subject.takeLast(4)}",
        )
        log.info("로그인: user={} provider=kakao", user.id)
        return issuePair(user)
    }

    override suspend fun refresh(refreshToken: String?): TokenPair? {
        val claims = jwt.verify(refreshToken, "refresh") ?: return null
        // DB를 거친다 — 토큰 수명(14일) 동안 닉네임·역할이 바뀌었을 수 있다.
        val user = users.findById(claims.subject.toLongOrNull() ?: return null) ?: return null
        return issuePair(user)
    }

    override fun authenticate(accessToken: String?): AuthPrincipal? {
        val claims = jwt.verify(accessToken, "access") ?: return null
        return AuthPrincipal(
            userId = claims.subject.toLongOrNull() ?: return null,
            nickname = claims.extra["nick"] ?: return null,
            role = claims.extra["role"]?.let { runCatching { Role.fromName(it) }.getOrNull() } ?: return null,
        )
    }

    /** access에는 표시·인가에 필요한 최소(닉네임·역할)를 실어 매 요청 DB 조회를 없앤다. */
    private fun issuePair(user: User): TokenPair = TokenPair(
        access = jwt.issue(
            "access", user.id.toString(), props.jwt.accessTtl,
            mapOf("nick" to user.nickname, "role" to user.role.name),
        ),
        accessTtl = props.jwt.accessTtl,
        refresh = jwt.issue("refresh", user.id.toString(), props.jwt.refreshTtl),
        refreshTtl = props.jwt.refreshTtl,
    )

    private fun randomToken(): String =
        ByteArray(16).also(random::nextBytes).joinToString("") { "%02x".format(it) }
}
