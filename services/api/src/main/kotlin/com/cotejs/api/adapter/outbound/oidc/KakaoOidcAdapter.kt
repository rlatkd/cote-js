package com.cotejs.api.adapter.outbound.oidc

import com.cotejs.api.config.AuthProperties
import com.cotejs.api.domain.model.AuthException
import com.cotejs.api.domain.port.outbound.OidcProvider
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import java.math.BigInteger
import java.security.KeyFactory
import java.security.interfaces.RSAPublicKey
import java.security.spec.RSAPublicKeySpec
import java.time.Duration
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.util.UriComponentsBuilder

/**
 * 카카오 OIDC 어댑터 — 외부 통신(코드 교환·JWKS 조달)만 담당한다.
 * id_token의 진위 판정은 순수 로직(IdTokenVerifier)의 몫(ADR-0019).
 */
@Component
class KakaoOidcAdapter(
    private val props: AuthProperties,
) : OidcProvider {
    private val log = LoggerFactory.getLogger(javaClass)

    // Boot 4는 WebClient.Builder를 자동 구성하지 않는다(모듈 분리) — 직접 생성.
    // 커스터마이징이 필요해지면 그때 빈으로 승격(현재는 기본값으로 충분).
    private val web = WebClient.create()

    override fun authorizeUrl(state: String, nonce: String): String =
        UriComponentsBuilder.fromUriString(props.kakao.authorizeUrl)
            .queryParam("response_type", "code")
            .queryParam("client_id", props.kakao.clientId)
            .queryParam("redirect_uri", props.kakao.redirectUri)
            // openid = OIDC(id_token 발급) 요청. 이메일은 쓰지 않는다(비즈앱 회피 — ADR-0019).
            .queryParam("scope", "openid profile_nickname")
            .queryParam("state", state)
            .queryParam("nonce", nonce)
            .build().encode().toUriString()

    override suspend fun exchangeCode(code: String): String {
        val response = web.post()
            .uri(props.kakao.tokenUrl)
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(
                BodyInserters.fromFormData("grant_type", "authorization_code")
                    .with("client_id", props.kakao.clientId)
                    .with("client_secret", props.kakao.clientSecret)
                    .with("redirect_uri", props.kakao.redirectUri)
                    .with("code", code),
            )
            .exchangeToMono { res ->
                if (res.statusCode().is2xxSuccessful) {
                    res.bodyToMono(TokenResponse::class.java)
                } else {
                    // 카카오의 에러 본문(KOE 코드)을 그대로 실어야 원인(만료 코드·설정 오류)을 알 수 있다.
                    res.bodyToMono(String::class.java).defaultIfEmpty("(빈 응답)").map { body ->
                        throw AuthException("카카오 토큰 교환 실패(${res.statusCode()}): $body")
                    }
                }
            }
            .awaitSingle()
        return response.idToken
            ?: throw AuthException("응답에 id_token이 없음 — 콘솔의 OpenID Connect 활성화를 확인하라")
    }

    // JWKS 캐시 — 카카오 서명키는 자주 안 바뀐다. TTL 6시간, 실패 시 다음 로그인에서 재시도.
    @Volatile
    private var cachedKeys: Pair<Instant, Map<String, RSAPublicKey>>? = null

    override suspend fun signingKeys(): Map<String, RSAPublicKey> {
        cachedKeys?.let { (at, keys) ->
            if (Duration.between(at, Instant.now()) < Duration.ofHours(6)) return keys
        }
        val jwks = web.get().uri(props.kakao.jwksUrl)
            .retrieve().bodyToMono(Jwks::class.java).awaitSingle()
        val keys = jwks.keys
            .filter { it.kty == "RSA" && it.kid != null && it.n != null && it.e != null }
            .associate { it.kid!! to rsaKey(it.n!!, it.e!!) }
        if (keys.isEmpty()) throw AuthException("JWKS에 사용 가능한 RSA 키가 없음")
        cachedKeys = Instant.now() to keys
        log.info("카카오 JWKS 갱신: {}개 키", keys.size)
        return keys
    }

    /** JWK(n·e, base64url) → RSA 공개키. BigInteger(1, ...) = 부호 없는 해석(음수 방지). */
    private fun rsaKey(n: String, e: String): RSAPublicKey {
        val dec = Base64.getUrlDecoder()
        val spec = RSAPublicKeySpec(BigInteger(1, dec.decode(n)), BigInteger(1, dec.decode(e)))
        return KeyFactory.getInstance("RSA").generatePublic(spec) as RSAPublicKey
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class TokenResponse(@param:JsonProperty("id_token") val idToken: String?)

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class Jwks(val keys: List<Jwk> = emptyList())

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class Jwk(
        val kty: String? = null,
        val kid: String? = null,
        val n: String? = null,
        val e: String? = null,
    )
}
