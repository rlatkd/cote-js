# Python 채점 러너 — judge 소유(ADR-0009: 어떤 런타임 버전으로 채점하느냐는 채점의 일부).
# 버전 정책: 안정판(3.13이 아닌 3.12 — 패치 축적 마이너).
#
# 빌드 컨텍스트는 services/judge (하니스 소스가 필요하다):
#   docker build -f runners/python/Dockerfile -t cotejs-judge-python:3.12 .
#
# 격리 옵션(네트워크 차단·자원 상한·비특권 유저 등)은 이미지가 아니라 실행 시점에
# 도커 어댑터가 건다(internal/sandbox/docker).

FROM golang:1.25-alpine AS harness
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/harness ./cmd/harness
# 정적 링크(CGO_ENABLED=0) — 어느 베이스 이미지에도 그대로 얹히게.
RUN CGO_ENABLED=0 go build -o /out/harness ./cmd/harness

FROM python:3.12-alpine
COPY --from=harness /out/harness /opt/judge/harness
ENTRYPOINT ["/opt/judge/harness"]
