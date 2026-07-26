# Python 채점 러너 — judge 소유(ADR-0009: 어떤 인터프리터 버전으로 채점하느냐는 채점의 일부).
# 버전 정책: 안정판(3.13이 아닌 3.12 — 패치 축적 마이너).
# 격리 옵션(네트워크 차단·자원 상한·비특권 유저 등)은 이미지가 아니라 실행 시점에
# 도커 어댑터가 건다(internal/sandbox/docker).
FROM python:3.12-alpine

COPY harness.py /opt/judge/harness.py

ENTRYPOINT ["python3", "/opt/judge/harness.py"]
