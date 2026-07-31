package com.cotejs.api.adapter.inbound.web

import com.cotejs.api.domain.port.inbound.AuthFlows
import org.springframework.core.Ordered
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilter
import org.springframework.web.server.WebFilterChain
import reactor.core.publisher.Mono

/**
 * 인증 WebFilter(ADR-0019) — Spring Security 미채택, 필터 하나가 두 가지만 한다:
 *   1. access 쿠키 검증 → principal을 exchange 속성으로 전파(모든 요청)
 *   2. 보호 경로(제출)에 비로그인 요청이 오면 401
 *
 * JWT 검증은 순수 연산(DB·I/O 없음)이라 리액티브 체인을 막지 않는다 —
 * 이 성질 덕에 필터가 suspend 없이 단순해진다.
 */
@Component
class AuthenticationFilter(private val auth: AuthFlows) : WebFilter, Ordered {

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE + 100

    override fun filter(exchange: ServerWebExchange, chain: WebFilterChain): Mono<Void> {
        val token = exchange.request.cookies.getFirst("access_token")?.value
        val principal = auth.authenticate(token)
        if (principal != null) {
            exchange.attributes[PRINCIPAL_ATTR] = principal
        }

        if (principal == null && requiresLogin(exchange)) {
            val response = exchange.response
            response.statusCode = HttpStatus.UNAUTHORIZED
            response.headers.contentType = MediaType.APPLICATION_JSON
            val body = """{"message":"로그인이 필요합니다"}""".toByteArray(Charsets.UTF_8)
            return response.writeWith(Mono.just(response.bufferFactory().wrap(body)))
        }
        return chain.filter(exchange)
    }

    /**
     * 로그인 필수 경계 — 제출(run·submit 공통 엔드포인트)만. 조회·SSE는 공개(ADR-0019).
     * 화이트리스트가 아닌 블랙리스트인 이유: 이 서비스의 기본은 공개 열람이고,
     * 보호가 예외이기 때문(반대 기본값이면 새 공개 API마다 구멍이 아니라 차단이 생긴다).
     */
    private fun requiresLogin(exchange: ServerWebExchange): Boolean {
        val request = exchange.request
        return request.method == HttpMethod.POST && request.path.value() == "/api/submissions"
    }

    companion object {
        /** 컨트롤러가 principal을 꺼내는 exchange 속성 키. */
        const val PRINCIPAL_ATTR = "cotejs.auth.principal"
    }
}
