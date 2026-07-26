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

## 계약(Protobuf) 코드 재생성 (`contracts/*.proto`를 바꿨을 때)

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest   # 최초 1회 (buf도: go install github.com/bufbuild/buf/cmd/buf@latest)
cd contracts && buf lint && buf generate    # → services/judge/gen 재생성 → 커밋
```

## API 계약 타입 재생성 (api 응답 계약이 바뀌었을 때)

```bash
cd services/web && pnpm gen:api   # api 기동 상태에서. schema.d.ts 갱신 → 커밋
```
