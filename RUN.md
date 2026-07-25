# 로컬 실행

현재 구현된 것: **Postgres(도커) · hub(Kotlin + Spring Boot) · arena(Next 프론트)**

> 도커는 **인프라만** 담는다(개발용 세팅). 앱은 호스트에서 네이티브 실행 — 핫리로드·디버거를 위해.

## 사전 요구

- Docker + Docker Compose
- JDK 21 (LTS) — hub
- Node 22 LTS + pnpm — arena

## 서버 켜기 (순서대로)

```bash
# 1) 인프라 (Postgres :5432)
cd infra && docker compose up -d

# 2) hub (:4000) — 기동 시 Flyway가 스키마·시드 자동 적용
cd platform/hub && ./gradlew bootRun

# 3) arena (:3000) — 최초 1회 pnpm install
cd platform/arena && pnpm install && pnpm dev   # 브라우저 자동 오픈
```

- hub: http://localhost:4000/api · arena: http://localhost:3000

## 끄기

```bash
cd infra && docker compose down    # DB 중지 (데이터 유지. 초기화하려면 -v)
# hub · arena 는 각 터미널에서 Ctrl+C
```

## 확인용

```bash
curl http://localhost:4000/api/problems       # 문제 목록(JSON, 시드 7문제)
curl http://localhost:4000/api/submissions    # 제출 목록(JSON)
```

## API 계약 타입 재생성 (hub 응답 계약이 바뀌었을 때)

```bash
cd platform/arena && pnpm gen:api   # hub 기동 상태에서. schema.d.ts 갱신 → 커밋
```
