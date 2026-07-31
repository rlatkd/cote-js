package com.cotejs.api.adapter.inbound.web

import com.cotejs.api.config.AuthProperties
import com.cotejs.api.domain.model.AuthException
import com.cotejs.api.domain.model.AuthPrincipal
import com.cotejs.api.domain.model.TokenPair
import java.net.URI
import java.time.Duration
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.ResponseStatusException
import com.cotejs.api.domain.port.inbound.AuthFlows

/**
 * 인증 엔드포인트(ADR-0019). 토큰은 응답 본문에 절대 싣지 않는다 — httpOnly 쿠키로만
 * 운반해 XSS로 탈취할 표면 자체를 없앤다.
 *
 * 쿠키 경로 정책: access는 전역(/), refresh·state는 /api/auth 한정 —
 * 수명이 긴 refresh가 매 요청에 실려 다닐 이유가 없다(노출 최소화).
 */
@RestController
@RequestMapping("/auth")
class AuthController(
    private val auth: AuthFlows,
    private val props: AuthProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @GetMapping("/login/kakao")
    fun login(): ResponseEntity<Void> {
        if (props.kakao.clientId.isBlank()) {
            // 설정 없이 죽는 대신 원인을 말한다 — .env(KAKAO_CLIENT_ID) 미주입의 전형적 증상.
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "카카오 로그인 미설정(KAKAO_CLIENT_ID)")
        }
        val start = auth.beginLogin()
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(start.authorizeUrl))
            .header(
                HttpHeaders.SET_COOKIE,
                cookie("oauth_state", start.stateToken, start.stateTtl, path = "/api/auth"),
            )
            .build()
    }

    @GetMapping("/callback/kakao")
    suspend fun callback(
        @RequestParam(required = false) code: String?,
        @RequestParam(required = false) state: String?,
        @RequestParam(required = false) error: String?,
        @CookieValue("oauth_state", required = false) stateToken: String?,
    ): ResponseEntity<Void> {
        // 콜백은 브라우저 최상위 내비게이션이다 — 실패도 JSON이 아니라 화면으로 돌려보낸다.
        if (error != null || code == null || state == null) {
            log.warn("카카오 콜백 거부/오류: error={} code없음={} state없음={}", error, code == null, state == null)
            return redirect("${props.webOrigin}/?login=denied")
        }
        val pair = try {
            auth.completeLogin(code, state, stateToken)
        } catch (e: AuthException) {
            log.warn("로그인 실패: {}", e.message)
            return redirect("${props.webOrigin}/?login=error")
        }
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(props.webOrigin))
            .headers { it.addAll(HttpHeaders.SET_COOKIE, sessionCookies(pair) + clearCookie("oauth_state", "/api/auth")) }
            .build()
    }

    /** access 만료 시 web이 호출 — refresh 회전. 무효면 401(재로그인 필요). */
    @PostMapping("/refresh")
    suspend fun refresh(
        @CookieValue("refresh_token", required = false) refreshToken: String?,
    ): ResponseEntity<Void> {
        val pair = auth.refresh(refreshToken)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .headers { it.addAll(HttpHeaders.SET_COOKIE, expiredSessionCookies()) }
                .build()
        return ResponseEntity.noContent()
            .headers { it.addAll(HttpHeaders.SET_COOKIE, sessionCookies(pair)) }
            .build()
    }

    @PostMapping("/logout")
    fun logout(): ResponseEntity<Void> =
        ResponseEntity.noContent()
            .headers { it.addAll(HttpHeaders.SET_COOKIE, expiredSessionCookies()) }
            .build()

    /** 현재 세션 — 토큰의 클레임만으로 답한다(DB 무접근). 비로그인은 401. */
    @GetMapping("/me")
    fun me(exchange: ServerWebExchange): MeResponse {
        val principal = exchange.attributes[AuthenticationFilter.PRINCIPAL_ATTR] as? AuthPrincipal
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다")
        return MeResponse(id = principal.userId, nickname = principal.nickname, role = principal.role.name)
    }

    private fun sessionCookies(pair: TokenPair): List<String> = listOf(
        cookie("access_token", pair.access, pair.accessTtl, path = "/"),
        cookie("refresh_token", pair.refresh, pair.refreshTtl, path = "/api/auth"),
    )

    private fun expiredSessionCookies(): List<String> =
        listOf(clearCookie("access_token", "/"), clearCookie("refresh_token", "/api/auth"))

    private fun cookie(name: String, value: String, ttl: Duration, path: String): String =
        ResponseCookie.from(name, value)
            .httpOnly(true)          // JS에서 못 읽는다 — XSS 탈취 표면 제거
            .secure(false)           // 로컬 http 개발용 — 배포(https) 시 true로(TODO)
            .sameSite("Lax")         // 최상위 내비게이션(카카오→콜백)은 허용, 크로스사이트 요청은 차단
            .path(path)
            .maxAge(ttl)
            .build().toString()

    private fun clearCookie(name: String, path: String): String =
        ResponseCookie.from(name, "").httpOnly(true).sameSite("Lax").path(path).maxAge(0).build().toString()

    private fun redirect(to: String): ResponseEntity<Void> =
        ResponseEntity.status(HttpStatus.FOUND).location(URI.create(to)).build()
}

data class MeResponse(val id: Long, val nickname: String, val role: String)
