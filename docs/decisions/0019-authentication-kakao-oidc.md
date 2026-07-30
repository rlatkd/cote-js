# 0019. 인증 — 카카오 OIDC 위임 + 자체 JWT + 직접 WebFilter

- **상태**: Accepted (설계 확정 — 구현은 다음 세션 착수)
- **일자**: 2026-07-30

## 맥락 (Context)

제출·기록이 사용자 없이 쌓이고 있었다(`submission.username`이 자유 문자열, 기본값 "guest"). M3 검수 UI(admin)도 인가를 전제한다. 사용자 결정으로 인증 슬라이스가 확정됐고, 논의 경위(추천이 두 번 다듬어진 과정 포함)는 [engineering-notes](../engineering-notes.md) 2026-07-30 항목에 있다.

## 결정 (Decision)

1. **신원 확인 = 카카오 OIDC 단독 위임** (Authorization Code Flow, 서버 사이드).
   - id_token 검증: JWKS(`kauth.kakao.com/.well-known/jwks.json`) 서명(RS256) + iss·aud·exp·nonce.
   - 이메일 동의항목(비즈앱 필요)은 쓰지 않는다 — `sub`+닉네임으로 충분.
2. **세션 = 자체 JWT** — 짧은 access + refresh 회전, **httpOnly 쿠키** 운반.
3. **구현 = Spring Security 미채택, 직접 WebFilter(코루틴)** — 암호 원시 연산(HMAC·RSA 검증)만 JDK 내장(`javax.crypto`/`java.security`) 사용. OAuth 단독이라 비밀번호 저장·해시 자체가 없다.
4. **접근 정책**: 문제 열람·채점 현황 조회·SSE = 공개 / **제출(run·submit 모두) = 로그인 필수**.
5. **스키마(V5, 초안 작성 후 코드 배선 전이라 되돌림 — 다음 세션에 코드와 함께 재도입)**:
   - `users(id, provider, provider_id, nickname, role, created_at)` + `UNIQUE(provider, provider_id)`. `provider_id` = OIDC `sub`.
   - `role` = USER | ADMIN (M3 검수 UI 대비 선반영).
   - `submission.user_id BIGINT NOT NULL REFERENCES users` — 기존 픽스처 제출은 **시드 유저 귀속**(provider='seed', username별 1행 — 사용자 결정 (a)). 운영(빈 DB)에는 시드 유저를 만들지 않는다.
   - 시드(R__dev_seed)도 seed 유저 upsert + `user_id` 조인으로 갱신.
6. **엔드포인트(안)**: `GET /api/auth/login/kakao`(302) → `GET /api/auth/callback/kakao`(state 검증→코드 교환→id_token 검증→upsert→쿠키 발급→web 리다이렉트) / `POST /api/auth/refresh`(회전) / `POST /api/auth/logout` / `GET /api/auth/me`. state·nonce는 짧은 수명의 서명 쿠키로(무상태).
7. **web**: 제출은 이미 Server Action 경유([ADR-0018]에서 이전) — 쿠키가 first-party로 유지된다. Server Action·서버 컴포넌트의 api 호출에 요청 쿠키 포워딩 추가.

## 근거 (Rationale)

- **카카오 단독(GitHub 추천 번복)**: "개발자라면 GitHub 계정" 논거는 국내 타깃에서 카카오 도달률의 부분집합이라 무의미(사용자 지적으로 재대조). 카카오는 표준 OIDC 완비(2022.03~)라 **OIDC 학습(discovery·JWKS·id_token 검증)이 첫 슬라이스로 앞당겨진다**. 국내 실무 직결 경험이기도 하다.
- **JWT+쿠키**: SSE(`EventSource`)가 커스텀 헤더 불가 → 쿠키 운반이 사실상 강제. M2 다중 인스턴스 예정 → stateless 이점 실재. 세션+Redis는 실무(Spring Security 세션) 겹침.
- **직접 WebFilter**: 보호 대상이 JWT 검증+경로 매칭으로 작아 프레임워크 없이 적합, 필터 체인·컨텍스트 전파 직접 구현의 학습 가치. "보안 직접 구현 금지" 통념은 암호 원시 연산에 해당 — 그건 JDK 내장 사용.

## 검토한 대안 (Alternatives)

- **자체 이메일/비번 가입**: 사용자 결정으로 배제(OAuth 진행). 비밀번호 취급 자체가 사라지는 부수 이득.
- **GitHub (최초 추천)**: 표준 OIDC 미구현(id_token 없음, access token+`/user` API 방식). **후속 옵션 보류** — 추가 시 멀티 프로바이더 추상화 + "표준 OIDC vs 비표준 OAuth2" 대비 학습. 뒤집히는 조건: 글로벌 타깃 전환.
- **자체 Authorization Server(Keycloak 등)**: 퍼스트파티 클라이언트 1개뿐이라 자기 위임 우회로만 남는 과설계. 뒤집히는 조건: 멀티 클라이언트 SSO·서드파티 API 개방.
- **Spring Security(Reactive)**: 실무 스택 겹침 + 이 범위엔 과함. 뒤집히는 조건: 인가 매트릭스가 커져 경로·역할 조합이 프레임워크 수준으로 복잡해질 때.
- **네이버**: OIDC 지원 확인 안 됨. **Google**: OIDC 동등하나 카카오 대비 추가 이점 없음(국내 타깃).

## 결과 (Consequences)

- 이점: 비밀번호 무보유(공격면 축소), OIDC 표준 구현 학습, M2·M3 전제(무상태 세션·role) 선확보.
- 감수: ① access 수명 내 탈취 토큰 즉시 무효화 불가(수명 단축으로 수용 — 뒤집히는 조건: 강제 로그아웃·차단 요구 시 블랙리스트/세션 재검토) ② 카카오 장애 = 로그인 불가(신원 위임의 본질적 종속) ③ localhost 개발에서 web(3000)·api(4000) 쿠키는 host 기준이라 공유되나, 배포 시 도메인 전략 필요.
- **사용자 액션 필요**: Kakao Developers 앱 등록 → 카카오 로그인+OIDC 활성화 → Redirect URI `http://localhost:4000/api/auth/callback/kakao` 등록 → REST API 키·Client Secret 전달(.env).
- 후속: 구현(다음 세션 — V5 재도입+도메인·어댑터·필터·web 배선), OpenAPI 재생성(`gen:api`), JWT 코덱·id_token 검증 단위 테스트(선별적 TDD 대상), refresh 자동화 web 배선.
