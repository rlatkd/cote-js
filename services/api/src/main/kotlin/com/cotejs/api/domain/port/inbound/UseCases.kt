package com.cotejs.api.domain.port.inbound

import com.cotejs.api.domain.model.AuthPrincipal
import com.cotejs.api.domain.model.JudgedOutcome
import com.cotejs.api.domain.model.LoginStart
import com.cotejs.api.domain.model.NewSubmission
import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.Submission
import com.cotejs.api.domain.model.TokenPair

// 인바운드 포트 — 웹 어댑터가 호출하는 유스케이스 계약.

interface ProblemQueries {
    suspend fun all(): List<Problem>

    /** @throws com.cotejs.api.domain.model.ProblemNotFoundException */
    suspend fun byId(id: Long): Problem
}

interface SubmissionQueries {
    suspend fun all(): List<Submission>
}

interface SubmitCode {
    suspend fun submit(command: NewSubmission): Submission
}

/** 채점 결과 반영 — 인바운드 메시징 어댑터(Kafka 결과 토픽)가 호출한다. */
interface ApplyJudgeOutcome {
    suspend fun apply(outcome: JudgedOutcome)
}

/** 인증 유스케이스(ADR-0019) — 웹 어댑터(AuthController·AuthenticationFilter)가 호출한다. */
interface AuthFlows {
    /** 카카오 로그인 시작 — 인가 URL + state 토큰(CSRF·nonce를 콜백까지 잇는 서명 쿠키). */
    fun beginLogin(): LoginStart

    /**
     * 콜백 처리: state 검증 → 코드 교환 → id_token 검증 → 사용자 upsert → 세션 토큰 발급.
     * @throws com.cotejs.api.domain.model.AuthException 어느 단계든 실패 시
     */
    suspend fun completeLogin(code: String, state: String, stateToken: String?): TokenPair

    /** refresh 회전 — 새 쌍 발급. null = 무효·만료(재로그인 필요). */
    suspend fun refresh(refreshToken: String?): TokenPair?

    /** access 토큰 → 요청 주체. null = 무효(비로그인 취급). DB를 거치지 않는다. */
    fun authenticate(accessToken: String?): AuthPrincipal?
}
