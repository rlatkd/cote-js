# 로컬 실행

현재 구현된 것: **인프라(도커: Postgres·Kafka·MinIO) · api(Kotlin + Spring Boot) · web(Next 프론트)**

> 도커는 **인프라만** 담는다(개발용 세팅). 앱은 호스트에서 네이티브 실행 — 핫리로드·디버거를 위해.

## 사전 요구

- Docker + Docker Compose
- JDK 21 (LTS) — api
- Node 22 LTS + pnpm — web
- Go 1.25 — judge (계약 코드젠은 `buf` + `protoc-gen-go`, 아래 참조)

## 서버 켜기 (순서대로)

```bash
# 1) 인프라 — Postgres :5432, Kafka :9092(토픽 자동 init), MinIO :9000(API)/:9001(콘솔, cotejs/cotejs-dev)
cd infra && docker compose up -d

# 2) api (:4000) — 기동 시 Flyway가 스키마(V1)+dev 시드(R__) 자동 적용
cd services/api && ./gradlew bootRun

# 3) web (:3000) — 최초 1회 pnpm install
cd services/web && pnpm install && pnpm dev   # 브라우저 자동 오픈
```

- api: http://localhost:4000/api · web: http://localhost:3000
- **실채점을 보려면 judge 워커도 켠다**: `cd services/judge && go run ./cmd/judged` (아래 참조). 워커가 없으면 제출이 "채점 중"에 머문다.

## 끄기

```bash
cd infra && docker compose down    # DB 중지 (데이터 유지. 초기화하려면 -v)
# api · web 는 각 터미널에서 Ctrl+C
```

## 확인용

```bash
curl http://localhost:4000/api/problems       # 문제 목록(JSON, 시드 7문제)
curl http://localhost:4000/api/submissions    # 제출 목록(JSON)
docker exec cotejs-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list   # 토픽 4종
curl -s http://localhost:9000/minio/health/live -o /dev/null -w "%{http_code}\n"                   # MinIO 200
```

## judge 채점

사전: 러너 이미지 빌드(최초 1회) — `cd services/judge/runners/python && docker build -t cotejs-judge-python:3.12 .`

```bash
# A) 워커 — Kafka 3레인 소비 → 채점 → 결과 토픽 발행 (api 배선 전까지는 이게 소비자)
cd services/judge && go run ./cmd/judged

# B) 제출 주입(개발용) — 번들을 MinIO에 올리고 제출 발행 후 결과 대기
go run ./cmd/judgeprobe -bundle <번들dir> -source <풀이.py> -lane submit -submission 9001

# C) 채점 코어만 — Kafka·MinIO 없이 로컬에서 1건
go run ./cmd/judgecli -bundle <번들dir> -source <풀이.py> -time-ms 1000 -mem-mb 256
```

번들 레이아웃: `<번들dir>/cases/01.in, 01.out, 02.in, ...`

## problem (AI 문제 생성 — M3, uv 필요: macOS `brew install uv` / Windows `irm https://astral.sh/uv/install.ps1 | iex`)

```bash
cd services/problem
uv sync                      # 최초 1회 (이후 uv run이 알아서 동기화)
uv run pytest -q             # 배관 테스트(LLM·Kafka 불필요 — 페이크·순수 값)
uv run --env-file .env problem-generate --difficulty Silver --tags BFS   # 실생성 (.env에 GOOGLE_API_KEY)
uv run uvicorn problem.app:app --port 8000               # /health

# Kafka 배선(ADR-0023) — 사전: 인프라 + judged(batch 실채점에 필요)
uv run --env-file .env problem-worker                    # 워커: problem.generate 소비 → 후보 발행
uv run problem-probe --difficulty Silver --tags BFS      # 개발용 주입기: 요청 발행 + 후보 대기(exit 0=VALIDATED)
uv run --env-file .env problem-validate draft.json --n 3               # 수동 검증(judge 실채점 경유)
uv run problem-validate draft.json --solutions s1.py s2.py s3.py       # LLM 없이 실행 경로만(수제 풀이)
```

## 계약(Protobuf) 코드 재생성 (`contracts/*.proto`를 바꿨을 때)

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest   # 최초 1회 (buf도: go install github.com/bufbuild/buf/cmd/buf@latest)
# macOS는 brew로도 가능: brew install go buf protobuf / Windows는 protoc 릴리스 zip을 PATH에.
# protoc은 CI pin과 같은 35.x 확인(`protoc --version`) — 다르면 생성물 드리프트로 CI가 깨진다.
cd contracts && buf lint && buf generate && buf generate --template buf.gen.problem.yaml && buf generate --template buf.gen.python.yaml
# → services/judge/gen + services/api/src/main/proto-gen + services/problem/src/{common,judge,problem/v1} 재생성 → 커밋
# (problem/v1 Java는 전용 템플릿 — judge에 Go 생성물을 만들지 않기 위함, ADR-0022.
#  Python은 전체 proto — problem이 judge/common의 소비자이기 때문, ADR-0023)
```

## API 계약 타입 재생성 (api 응답 계약이 바뀌었을 때)

```bash
cd services/web && pnpm gen:api   # api 기동 상태에서. schema.d.ts 갱신 → 커밋
```
