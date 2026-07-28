# Java 채점 러너 — JDK 21 LTS(프로젝트 버전 정책과 동일).
#
#   docker build -f runners/java/Dockerfile -t cotejs-judge-java:21 .
#
# 주의: JVM은 힙과 별개로 가상주소를 크게 예약한다 → 메모리 한도를 RLIMIT_AS로 걸면
# 정상 코드도 기동조차 못 한다. 그래서 language 레지스트리가 -Xmx(런타임 옵션) 방식을 쓴다.

FROM golang:1.25-alpine AS harness
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/harness ./cmd/harness
RUN CGO_ENABLED=0 go build -o /out/harness ./cmd/harness

FROM eclipse-temurin:21-jdk-alpine
COPY --from=harness /out/harness /opt/judge/harness
ENTRYPOINT ["/opt/judge/harness"]
