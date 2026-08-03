"""경계 설정 — 환경변수(기본값은 로컬 인프라)와 토픽 상수.

환경변수 이름은 judge(cmd/judged)와 같은 것을 쓴다 — 같은 인프라를 가리키는
설정이 서비스마다 다른 이름이면 개발 머신에서 두 벌을 관리하게 된다.
토픽 이름은 계약(proto 주석)이 진실원이고 여기는 상수로 고정한다(설정 아님 —
바꿀 수 있는 값이 아니라 계약의 일부다. judge의 messaging 상수와 같은 취급).
"""

import os

# Kafka — judge와 동일한 환경변수
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")

# MinIO(claim-check) — judge와 동일한 환경변수
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "cotejs")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "cotejs-dev")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "testdata")

# problem 파이프라인 파라미터
SOLVER_COUNT = int(os.environ.get("PROBLEM_SOLVERS", "3"))  # 독립 풀이 수 N
JUDGE_TIMEOUT_S = float(os.environ.get("PROBLEM_JUDGE_TIMEOUT_S", "180"))

# 토픽(계약의 일부 — problem/v1·judge/v1 proto 주석 참조)
TOPIC_GENERATE = "problem.generate"
TOPIC_CANDIDATE = "problem.candidate"
TOPIC_SUBMISSION_BATCH = "submission.batch"
TOPIC_SUBMISSION_RESULT = "submission.result"

# 컨슈머 그룹 — 생성 요청은 작업 분배(그룹), 결과 수집은 pub/sub(그룹 없음, judge_runner 참조)
GROUP_GENERATE = "problem-workers"
