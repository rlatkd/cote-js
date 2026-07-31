package com.cotejs.api.adapter.outbound.redis

import com.cotejs.api.domain.port.outbound.RateLimiter
import java.time.Duration
import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.ReactiveStringRedisTemplate
import org.springframework.stereotype.Component

/**
 * Redis 고정 창 카운터 — INCR + 첫 증가에만 EXPIRE.
 * 다중 인스턴스에서도 카운터가 하나라 한도가 전역으로 성립한다(인메모리 카운터와의 차이).
 */
@Component
class RedisRateLimiter(
    private val redis: ReactiveStringRedisTemplate,
) : RateLimiter {
    private val log = LoggerFactory.getLogger(javaClass)

    override suspend fun tryAcquire(key: String, limit: Int, window: Duration): Boolean = try {
        val redisKey = "ratelimit:$key"
        val count = redis.opsForValue().increment(redisKey).awaitSingle()
        if (count == 1L) {
            // 창의 시작 — 만료를 걸어 창이 끝나면 카운터가 사라진다(정리 작업 불요).
            redis.expire(redisKey, window).awaitSingle()
        }
        count <= limit
    } catch (e: Exception) {
        // fail-open: 한도 장치가 죽었다고 제출까지 막으면 부수 기능이 핵심 기능을 인질로 잡는다.
        log.warn("rate limit 저장소 장애 — 통과 처리(fail-open): {}", e.message)
        true
    }
}
