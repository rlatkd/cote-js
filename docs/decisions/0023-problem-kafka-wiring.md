# 0023. problem Kafka 배선 — judge batch 실채점 대체·출력 해시 계약·Python 클라이언트

- **상태**: Accepted
- **일자**: 2026-08-03

## 맥락 (Context)

validation 1차([worklog 2026-08-01](../worklog.md))는 합의 검증을 E2E로 관통시켰지만 두 가지 임시 상태를 남겼다: ① LLM 생성 코드를 개발 머신 **무격리 subprocess**로 실행(샌드박스 원칙 위반 — 파급 선언됨) ② problem이 Kafka 경계 없이 CLI로만 동작. 이 슬라이스는 problem을 Kafka에 배선하면서(generate 컨슈머·candidate 프로듀서) 검증 실행을 judge batch 레인 실채점으로 대체해 임시 상태를 해소한다.

## 결정 (Decision)

1. **검증 실행 = judge batch 레인 실채점** (무격리 subprocess 제거). problem이 예제(입력+초안 기대 출력)를 claim-check 번들(MinIO, api와 같은 `cases/NN.in|out`·콘텐츠 주소 키 규약)로 발행하고, 풀이마다 `judge/v1.Submission`을 `submission.batch`에 발행, `submission.result`에서 자기 결과를 상관 수집한다. ADR-0006이 batch 레인을 검증 트래픽 자리로 설계한 그대로 — **problem은 judge의 소비자가 되고 신규 실행 인프라는 없다**.
2. **계약 보강: `judge/v1.CaseResult.output_sha256`** (하위 호환 필드 추가). 정규화된 실제 출력의 sha256(hex), 출력이 존재하는 판정(AC·WA)에서만 채움. 합의 검증의 "풀이 간 합의 vs 초안 기대 일치" 분리 진단은 출력 **동일성** 비교가 필요한데, 결과에는 판정(기대와의 일치)만 있었다.
   - **문제 정의**: judge 실채점으로 옮기면 출력 원문이 problem에 오지 않아 1차의 핵심 진단("풀이들이 초안과 다른 값에 합의 → 초안 예제 오류 의심")이 소실된다. 조용히 떨어뜨리면 안 되는 설계 자산.
   - **선택지**: (a) 출력 원문을 결과에 싣기 — 크기(수 MB 가능)·결과 토픽 전체 소비자에 노출, 과함 (b) **해시만 싣기(채택)** — 동일성 판단엔 충분, 원문 불필요 (c) 진단 포기 — 설계 후퇴.
   - **강제**: 정규화 규칙(CRLF→LF·줄 후행 공백 제거·말미 빈 줄 제거)은 judge의 판정 비교와 **같은 코드 경로**에서 해시를 계산해 어긋날 수 없고, problem 측 재현 규칙은 양쪽 테스트로 고정.
   - **뒤집히는 조건**: validation 2차의 히든 케이스 생성은 합의 **출력 원문**을 정답으로 채택해야 한다 — 해시로는 부족. 그때 출력 아티팩트의 claim-check(judge가 출력을 MinIO에 올리고 참조를 결과에 싣기) 재검토.
3. **검증 제출의 id 공간 = 음수** (`submission_id < 0`, 계약 주석으로 명시). 코어 DB 시퀀스(양수)와 구조적으로 충돌 불가, api 결과 컨슈머는 미지 제출을 스킵(기존 규칙·IT로 고정)하므로 별도 분기 없이 공존.
4. **결과 소비 = 컨슈머 그룹 없음 + latest**. 이 소비는 작업 분배가 아니라 "내 요청의 응답 수집"(pub/sub)이다 — 그룹을 쓰면 워커 다중 인스턴스에서 자기 제출의 결과가 다른 인스턴스로 로드밸런싱돼 영영 오지 않는다. 생성 요청 소비는 반대로 작업 분배이므로 그룹(`problem-workers`)+**수동 커밋 at-least-once**(후보 발행 후 커밋, 중복 후보는 api가 request_id로 흡수 예정).
5. **Python Kafka 클라이언트 = aiokafka** / **MinIO = minio-py**. 판단 기준은 judge 때(ADR-0011)와 동일선상: 네이티브 의존 회피 + 스택 일관성.
6. **Python 코드젠 = `buf.gen.python.yaml` 신설**(protoc 내장 python+pyi, 생성물 커밋). problem은 자기 계약만 아니라 judge/v1·common/v1의 소비자라 **전체 proto**가 필요한데, 기존 두 템플릿은 입력이 갈라져 있어 어느 쪽에도 얹을 수 없다(buf v2엔 플러그인별 경로 필터가 없음). 생성 루트는 `services/problem/src` — protoc python 생성물은 proto 경로를 import 경로로 그대로 미러링하므로 생성 루트가 import 루트여야 한다(`src/common`·`src/judge`·`src/problem/v1` = 생성 전용 경로).
7. **파이프라인 실패의 두 층위 분리**: 검증 반려 = `REJECTED` 후보(생성 성공률 관측 대상) / 파이프라인 자체 실패(LLM 오류·judge 불능) = `status UNSPECIFIED + failure(common.v1.Error, retryable)`. 섞으면 성공률 지표가 인프라 장애에 오염된다.

## 검토한 대안 (Alternatives)

- **confluent-kafka-python**: librdkafka(C 확장) 래퍼 — 성능은 최고지만 네이티브 의존(빌드·디버깅 불투명)이 judge에서 cgo를 피한 근거(ADR-0011)와 정면 충돌, 동기 콜백 모델이라 asyncio(FastAPI·대기 다발 워크로드)와 결이 어긋남. 배제.
- **kafka-python**: 순수 파이썬이지만 동기 API + 유지보수 정체. asyncio 통합이 필요한 우리 워커에 부적합. 배제.
- **boto3(S3)**: 범용이지만 무겁다. minio-py는 judge의 minio-go와 대응하는 경량 공식 클라이언트. (api는 AWS SDK async — 논블로킹 요구 때문으로, 여기선 스레드 위임으로 충분.)
- **결과 상관을 위한 전용 응답 토픽**(`problem.validation.result` 등): 계약 표면이 늘고 judge가 발행처를 분기해야 한다. 음수 id+미지 스킵 공존이 계약 변경 없이 같은 효과. 배제 — 단, 검증 트래픽이 유저 결과 소비를 방해할 규모가 되면 재검토.
- **generate 소비를 자동 커밋으로**: LLM 파이프라인 도중 죽으면 요청이 유실된다(재수행 비용 < 유실 비용). 배제.

## 결과 (Consequences)

- **임시 상태 해소**: `validation/executor.py`(무격리 subprocess) 삭제. LLM 생성 코드도 유저 제출과 같은 샌드박스 경계에서 실행된다.
- 파이프라인 관통: `problem.generate` → 생성 → 독립 풀이 N → batch 실채점 → 합의 → `problem.candidate`(VALIDATED/REJECTED/failure). 개발 장비 `problem-probe`(judgeprobe 대응물)로 api 없이 경계 검증 가능.
- 워커의 LLM 호출은 스레드 위임 + `max_poll_interval` 30분 — 파이프라인 1건이 길어도 그룹에서 쫓겨나지 않게.
- 추적: GenerationRequest.trace → 자식 스팬 → judge 제출·후보에 전파(proto 경로). problem의 OTel SDK(스팬 발행)는 미도입 — 로그 `trace_id`만. 필요해지면 ADR-0018 계열로 추가.
- protoc 버전 정렬이 Windows 개발 머신에도 적용됨(33.1→35.1 교체). protobuf 파이썬 런타임 7.35.1(protoc 35.1과 마이너 일치).
- 한계: ① 검증 범위는 여전히 공개 예제뿐(히든·brute-force는 validation 2차) ② candidate 소비자(api 검수 큐)가 아직 없음 — 다음 슬라이스 ③ 결과 대기 타임아웃(기본 180s)은 judge 다운 시 전체 파이프라인 실패로 이어짐(retryable failure로 발행).
