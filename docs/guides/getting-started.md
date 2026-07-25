# 시작하기

현재 실행 가능한 것: **web(Next 프론트) · api(Kotlin + Spring Boot API) · Postgres(도커)**. 문제·제출을 실제 DB에서 서빙한다(채점은 stub — Judge 마일스톤 예정).

## 사전 요구

- Node.js 22 LTS + pnpm 10+ (개발 환경 11) — web
- JDK 21 LTS — api (Gradle은 래퍼 `./gradlew` 사용, 별도 설치 불필요)
- Docker + Docker Compose — Postgres 구동 (도커는 인프라 전용, 개발용 세팅)

## 실행

서버 켜는 명령은 **[/RUN.md](../../RUN.md)** 에 한 줄씩 정리돼 있다(인프라 → api → web 순).

- web: http://localhost:3000
- api: http://localhost:4000/api
- 데이터: api가 Postgres에서 서빙(Flyway가 기동 시 스키마·시드 자동 적용). web의 `entities/*/api.ts`가 `HUB_URL`(기본 `localhost:4000`)로 fetch.
- 코드 에디터(Monaco)는 기본 설정상 CDN에서 로드되므로 최초 실행 시 인터넷 연결 필요.

> **pnpm 빌드 스크립트 승인**: 네이티브 의존성(`unrs-resolver`)의 postinstall은 [`services/web/pnpm-workspace.yaml`](../../services/web/pnpm-workspace.yaml)의 `allowBuilds`로 승인돼 있다(누락 시 `ERR_PNPM_IGNORED_BUILDS`).

## 페이지 (web)

| 경로 | 화면 |
|---|---|
| `/` | 홈(대시보드) |
| `/problems` | 문제 목록 |
| `/problems/[id]` | 문제 상세 (통합 split view + 에디터) |
| `/status` | 채점 현황 |

> 문제 지문·목록·제출 현황은 api(실 DB)에서 온다. 단, 에디터의 **실행/제출 채점은 아직 stub**(실제 코드 실행은 Judge 마일스톤).

## 다음 단계

api 후속(인증·랭킹·rate limit) 및 제출→judge(Kafka) 연결 → 이후 마일스톤([TODO](../TODO.md)).
