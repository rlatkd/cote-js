package com.cotejs.api.domain.port.outbound

import com.cotejs.api.domain.model.User
import java.security.interfaces.RSAPublicKey

// 인증 아웃바운드 포트(ADR-0019) — 영속(R2DBC)·OIDC 프로바이더(카카오) 어댑터가 구현.

interface UserRepository {
    suspend fun findById(id: Long): User?

    /**
     * (provider, providerId)로 upsert — 처음 로그인이면 생성, 재로그인이면 닉네임만 갱신.
     * 신원의 진실원은 (provider, providerId)이고 닉네임은 로그인 시점 스냅샷이다.
     */
    suspend fun upsert(provider: String, providerId: String, nickname: String): User
}

/**
 * OIDC 프로바이더(현재 카카오 단독) — Authorization Code Flow의 외부 통신 부분.
 * 검증 로직은 여기 두지 않는다: 코드 교환·키 조달(I/O)만 어댑터의 몫이고,
 * id_token의 서명·클레임 검증은 순수 로직(application.auth.IdTokenVerifier)이다.
 */
interface OidcProvider {
    /** 사용자를 보낼 인가 URL. state·nonce는 호출자(AuthService)가 만들어 넘긴다. */
    fun authorizeUrl(state: String, nonce: String): String

    /**
     * 인가 코드 → id_token(JWT 원문) 교환.
     * @throws com.cotejs.api.domain.model.AuthException 교환 실패(만료·위조 코드 등)
     */
    suspend fun exchangeCode(code: String): String

    /** 서명 검증용 공개키(kid → RSA 공개키). 어댑터가 JWKS를 캐시한다. */
    suspend fun signingKeys(): Map<String, RSAPublicKey>
}
