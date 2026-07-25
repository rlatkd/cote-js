# 검증 체크리스트 (Verification)

> **이 프로젝트가 살아있음을 확인하는 절차.** [RUN.md](../../RUN.md)가 "켜는 법"이라면 이 문서는 "확인하는 법"이다. Claude는 구현 작업 후 이 절차로 검증하고, **서비스·기능이 추가되어 절차가 바뀌면 이 문서를 같은 흐름에서 갱신한다**(갱신 시 아래 이력에 날짜·시각 기입).

## 현재 절차 (M1 슬라이스: api(Kotlin) + web)

### 0. 사전
```bash
cd infra && docker compose up -d          # Postgres :5432 (healthy 대기)
```

### 1. api — 빌드·기동·API 스모크 (:4000)
```bash
cd services/api && ./gradlew compileKotlin      # 컴파일 에러 0
./gradlew bootRun                                # 기동 로그: Flyway 마이그레이션 적용 + Started, ERROR 없음
curl -s localhost:4000/api/problems | head -c 200          # 200, JSON 배열(시드 7문제)
curl -s localhost:4000/api/problems/1000 | head -c 200     # 200, 단건(examples 포함)
curl -s -o /dev/null -w "%{http_code}" localhost:4000/api/problems/999999   # 404
curl -s localhost:4000/api/submissions | head -c 200       # 200, 최신순
curl -s -X POST localhost:4000/api/submissions -H "content-type: application/json" \
  -d '{"problemId":1000,"language":"Python","code":"print(1)"}'             # 201, result="채점 중"
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" -d '{}'                              # 400 (검증)
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" -d '{"problemId":1000,"language":"Rust","code":"x"}'  # 400 (잘못된 언어)
curl -s -o /dev/null -w "%{http_code}" localhost:4000/api/v3/api-docs       # 200 (OpenAPI)
```

### 2. 계약 정합 (api 응답 계약을 바꿨을 때만)
```bash
cd services/web && pnpm gen:api          # schema.d.ts 재생성 → git diff 확인 → 커밋
# contract-check.ts가 모델과 어긋나면 아래 3의 next build가 실패한다(의도된 동작)
```

### 3. web — 빌드 + 실렌더 (:3000)
```bash
cd services/web && pnpm build            # next build 통과(계약 체크 포함)
pnpm dev
for p in / /problems /problems/1000 /status; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" http://localhost:3000$p; done   # 전부 200
# HTML에 api 시드 데이터 반영 확인 (예: "두 수의 합")
```
- 눈 확인(주요 UI 변경 시): 라이트/다크 토글, split view 리사이즈, Monaco 로딩, 제출 시 stub 결과 표시.

### 4. 품질 게이트
```bash
cd services/web && pnpm lint             # ESLint(레이어 의존 규칙 포함)
```

## 추가 예정 (해당 마일스톤 착수 시 이 문서에 절차 추가)

- **api 테스트 스위트**: Kotest + Testcontainers 도입 시 `./gradlew test`를 게이트에 추가
- **Judge**: Kafka 제출→채점→결과토픽 왕복, QoS 3레인 격리, 샌드박스 제한(시간/메모리 초과·네트워크 차단) 케이스
- **SSE**: 제출 후 web가 폴링 없이 결과 수신
- **problem/plagiarism**: 파이프라인 상태 전이, 유사도 질의 왕복

## 갱신 이력

- 2026-07-25 14:07 — api Kotlin 전환([ADR-0007](../decisions/0007-backend-kotlin-return.md)) 반영: contracts 빌드 단계 삭제 → gradle 컴파일·기동 + OpenAPI/계약 정합(gen:api) 단계로 교체.
- 2026-07-25 12:48 — 문서 신설. M1 슬라이스(contracts/api/web) 절차 정리.
