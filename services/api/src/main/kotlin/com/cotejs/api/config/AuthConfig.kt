package com.cotejs.api.config

import com.cotejs.api.application.auth.IdTokenVerifier
import com.cotejs.api.application.auth.JwtCodec
import java.time.Duration
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.ObjectMapper

/** 인증 설정(ADR-0019) — 비밀값은 환경변수(.env, 커밋 금지)로 주입된다. */
@ConfigurationProperties("cotejs.auth")
data class AuthProperties(
    /** 로그인 완료 후 돌아갈 web 오리진. */
    val webOrigin: String,
    val jwt: Jwt,
    val kakao: Kakao,
) {
    data class Jwt(
        val secret: String,
        val accessTtl: Duration,
        val refreshTtl: Duration,
        val stateTtl: Duration,
    )

    data class Kakao(
        val clientId: String,
        val clientSecret: String,
        val redirectUri: String,
        val authorizeUrl: String = "https://kauth.kakao.com/oauth/authorize",
        val tokenUrl: String = "https://kauth.kakao.com/oauth/token",
        val jwksUrl: String = "https://kauth.kakao.com/.well-known/jwks.json",
        val issuer: String = "https://kauth.kakao.com",
    )
}

@Configuration
@EnableConfigurationProperties(AuthProperties::class)
class AuthConfig {
    @Bean
    fun jwtCodec(props: AuthProperties, json: ObjectMapper): JwtCodec =
        JwtCodec(props.jwt.secret, json)

    @Bean
    fun idTokenVerifier(json: ObjectMapper): IdTokenVerifier = IdTokenVerifier(json)
}
