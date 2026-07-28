# JavaScript 채점 러너 — Node 22 LTS(프로젝트 버전 정책과 동일).
#
#   docker build -f runners/javascript/Dockerfile -t cotejs-judge-node:22 .
#
# JVM과 같은 이유로 메모리 한도는 --max-old-space-size(V8 힙 옵션)로 건다.

FROM golang:1.25-alpine AS harness
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/harness ./cmd/harness
RUN CGO_ENABLED=0 go build -o /out/harness ./cmd/harness

FROM node:22-alpine
COPY --from=harness /out/harness /opt/judge/harness
ENTRYPOINT ["/opt/judge/harness"]
