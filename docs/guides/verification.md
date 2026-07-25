# 검증 체크리스트 (Verification)

> **이 프로젝트가 살아있음을 확인하는 절차.** [RUN.md](../../RUN.md)가 "켜는 법"이라면 이 문서는 "확인하는 법"이다. Claude는 구현 작업 후 이 절차로 검증하고, **서비스·기능이 추가되어 절차가 바뀌면 이 문서를 같은 흐름에서 갱신한다**(갱신 시 아래 이력에 날짜·시각 기입).

## 현재 절차 (M1 슬라이스: contracts + hub + arena)

### 0. 사전
```bash
cd infra && docker compose up -d          # Postgres :5432
cd platform && pnpm install               # (의존성 변경 시)
```

### 1. contracts — 공유 타입 빌드
```bash
cd platform && pnpm build:contracts       # tsc 에러 0
```

### 2. hub — API 스모크 (:4000)
```bash
cd platform && pnpm dev:hub               # 기동 로그에 에러 없음
curl -s localhost:4000/api/problems | head -c 200          # 200, JSON 배열(seed 7문제)
curl -s localhost:4000/api/problems/1000 | head -c 200     # 200, 단건
curl -s -o /dev/null -w "%{http_code}" localhost:4000/api/problems/999999   # 404
curl -s localhost:4000/api/submissions | head -c 200       # 200, JSON 배열
curl -s -X POST localhost:4000/api/submissions -H "content-type: application/json" \
  -d '{"problemId":1000,"language":"Python","code":"print(1)"}'             # 201
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" -d '{}'                              # 400 (zod)
```

### 3. arena — 빌드 + 실렌더 (:3000)
```bash
cd platform && pnpm dev:arena
# 5라우트 모두 200: / , /problems , /problems/1000 , /status , (404 페이지: /problems/999999 → 404)
for p in / /problems /problems/1000 /status; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" http://localhost:3000$p; done
# 홈 HTML에 hub 데이터가 반영되는지(문제 제목 등 seed 값 존재) 확인
```
- 눈 확인(주요 UI 변경 시): 라이트/다크 토글, split view 리사이즈, Monaco 로딩, 제출 시 stub 결과 표시.

### 4. 품질 게이트
```bash
cd platform && pnpm -r lint               # ESLint(레이어 의존 규칙 포함) 통과
cd platform/arena && pnpm build           # next build 통과 (프론트 변경 시)
```

## 추가 예정 (해당 마일스톤 착수 시 이 문서에 절차 추가)

- **Judge**: Kafka 제출→채점→결과토픽 왕복, QoS 3레인(run/submit/batch) 격리 확인, 샌드박스 제한(시간/메모리 초과·네트워크 차단) 케이스
- **SSE**: 제출 후 arena가 폴링 없이 결과 수신
- **setter/scout**: 파이프라인 상태 전이, 유사도 질의 왕복
- **테스트 스위트**: hub 유닛/E2E 도입 시 `pnpm test`를 게이트에 추가

## 갱신 이력

- 2026-07-25 12:48 — 문서 신설. M1 슬라이스(contracts/hub/arena) 절차 정리.
