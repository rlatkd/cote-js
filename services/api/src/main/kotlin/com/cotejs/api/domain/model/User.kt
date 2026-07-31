package com.cotejs.api.domain.model

/**
 * 사용자 — 카카오 OIDC로 확인된 신원(ADR-0019). 비밀번호는 존재하지 않는다.
 * (provider, providerId)가 신원의 진실원이고, 닉네임은 로그인 시점 표시값이다.
 */
data class User(
    val id: Long,
    val provider: String,
    val providerId: String,
    val nickname: String,
    val role: Role,
)

/** USER | ADMIN — admin은 M3 검수 UI에서 쓴다(선반영). DB에는 name 문자열로 저장. */
enum class Role {
    USER, ADMIN;

    companion object {
        fun fromName(name: String): Role =
            entries.firstOrNull { it.name == name }
                ?: throw IllegalArgumentException("알 수 없는 역할: $name")
    }
}

/** 인증 필터가 확인한 요청 주체 — 컨트롤러는 이것만 본다(토큰 형식과 무관). */
data class AuthPrincipal(
    val userId: Long,
    val nickname: String,
    val role: Role,
)

/** 인증 실패(만료·위조·프로바이더 오류 등). 어댑터가 401/로그인 실패 리다이렉트로 번역. */
class AuthException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/** 로그인 시작 — 사용자를 보낼 인가 URL + 콜백까지 절차를 잇는 서명된 state 토큰(쿠키 운반). */
data class LoginStart(
    val authorizeUrl: String,
    val stateToken: String,
    val stateTtl: java.time.Duration,
)

/** 자체 세션 토큰 쌍(ADR-0019) — 짧은 access + 회전하는 refresh. 운반은 httpOnly 쿠키. */
data class TokenPair(
    val access: String,
    val accessTtl: java.time.Duration,
    val refresh: String,
    val refreshTtl: java.time.Duration,
)
