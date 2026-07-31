package com.cotejs.api.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.config.CorsRegistry
import org.springframework.web.reactive.config.WebFluxConfigurer

/**
 * web(Next, :3000) 브라우저 직접 호출(SSE·refresh) 허용.
 * refresh는 쿠키(자격 증명)를 동반하므로 credentials 허용이 필요하고,
 * 그 경우 origin 와일드카드는 표준상·보안상 금지 — web 오리진 하나로 좁힌다(ADR-0019).
 */
@Configuration
class WebConfig(private val auth: AuthProperties) : WebFluxConfigurer {
    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/**")
            .allowedOrigins(auth.webOrigin)
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true)
    }
}
