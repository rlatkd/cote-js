package com.cotejs.api.adapter.inbound.web

import com.cotejs.api.domain.model.ProblemNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.bind.support.WebExchangeBindException
import org.springframework.web.server.ServerWebInputException

// 도메인/입력 예외 → HTTP 상태 매핑. 응답 형태는 {statusCode, message}.

data class ErrorResponse(val statusCode: Int, val message: String)

@RestControllerAdvice
class GlobalErrorHandler {
    @ExceptionHandler(ProblemNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun notFound(e: ProblemNotFoundException) =
        ErrorResponse(404, e.message ?: "not found")

    /** 검증 실패(@Valid)·본문 파싱 실패·잘못된 enum 라벨 → 400 */
    @ExceptionHandler(
        WebExchangeBindException::class,
        ServerWebInputException::class,
        IllegalArgumentException::class,
    )
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun badRequest(e: Exception) =
        ErrorResponse(400, e.message ?: "bad request")
}
