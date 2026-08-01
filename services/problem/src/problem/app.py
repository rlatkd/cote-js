"""FastAPI 앱 — 지금은 헬스체크만.

problem의 주 업무는 Kafka 컨슈머 워커(배선 슬라이스에서)이고, HTTP는 운영
확인용 최소 표면으로 시작한다. 파이프라인 상태 조회 등은 필요해질 때 늘린다.
"""

from fastapi import FastAPI

app = FastAPI(title="problem", docs_url=None, redoc_url=None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
