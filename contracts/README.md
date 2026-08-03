# contracts — 서비스 간 **공표 언어(Published Language)**

*([ADR-0010](../docs/decisions/0010-contracts-root-group.md) 거처 · [ADR-0017](../docs/decisions/0017-published-language.md) 격상)*

서비스 사이를 오가는 메시지의 **계약 원본**. 각 서비스는 여기서 자기 언어로 코드를 생성해 간다(생성물은 각 서비스 안에, 원본은 여기만).

**이 폴더의 목적은 "메시지 정의"가 아니라 "규약의 강제"다.** 시간·실패·추적처럼 여러 서비스가 공유하는 개념을 여기 타입으로 두면, 규약이 문서가 아니라 **각 언어의 타입**이 되어 어길 수 없게 된다. 서로 다른 서비스가 각자 번역(ACL)만 하면 N×N으로 해석이 갈라지지만, 공표 언어가 있으면 번역이 얇아진다.

- 현재: api↔judge Kafka 메시지 (Protobuf, [ADR-0009](../docs/decisions/0009-judge-kickoff-async-and-contracts.md)) · api↔problem 생성 파이프라인 (`problem/v1`, [ADR-0022](../docs/decisions/0022-m3-kickoff-problem-service.md))
- 예정: api↔plagiarism 경계 (M4~)
- **해당 없음**: web↔api REST — api가 OpenAPI 스펙을 생성하고 web이 codegen하는 방식([ADR-0007](../docs/decisions/0007-backend-kotlin-return.md))이라 원본이 api 코드다.

> 구 `platform/contracts`(TS 타입 공유 패키지, 폐기)와 이름만 같고 다른 것 — 그건 동일 언어 전제의 라이브러리, 이건 폴리글랏 전제의 IDL 저장소.

## 구조

```
contracts/
├─ buf.gen.yaml            # Go(judge)+Java(api) — proto/problem 제외
├─ buf.gen.problem.yaml    # Java(api) — proto/problem만
├─ buf.gen.python.yaml     # Python(problem) — 전체(problem은 judge·common의 소비자, ADR-0023)
└─ proto/
   ├─ common/v1/           # 모든 서비스가 공유하는 개념 (ADR-0017)
   │  ├─ trace.proto       #   상관관계 컨텍스트 — 흐름을 잇는 실(W3C Trace Context 형식)
   │  └─ error.proto       #   실패 표현 — 귀책(누구 잘못)·재시도 가능 여부를 발신자가 명시
   ├─ judge/v1/            # api·problem↔judge 채점 이음새 (버전 = 패키지에 포함)
   │  ├─ submission.proto  #   실행 요청 (api·problem → judge. 검증 트래픽=음수 id 공간)
   │  └─ result.proto      #   판정 결과 (judge → api·problem. 출력 동일성 해시 포함)
   └─ problem/v1/          # api↔problem 생성 파이프라인 (ADR-0022)
      ├─ generation.proto  #   생성 요청 (api → problem)
      └─ candidate.proto   #   검증 리포트 포함 후보 (problem → api)
```

## 공통 규약 (여기 타입이 곧 규칙)

| 관심사 | 규약 | 강제 방식 |
|---|---|---|
| 시간 | UTC 절대시각 (`google.protobuf.Timestamp`) — 존 없는 타입 금지 | 타입 자체 + DB `timestamptz` ([ADR-0015](../docs/decisions/0015-cross-service-time-contract.md)) |
| 실패 | `common.v1.Error` — `origin`(귀책)·`retryable`을 **발신자가 명시** | 수신자가 문자열을 추측하지 않게 |
| 추적 | `common.v1.TraceContext` — 흐름 시작점에서 생성, 이후 **이어받기만** | 로그에 같은 `trace_id`가 남는다 |

## 토픽 ↔ 메시지 매핑 ([ADR-0009](../docs/decisions/0009-judge-kickoff-async-and-contracts.md) 결정 4)

| Kafka 토픽 | 메시지 | 방향 |
|---|---|---|
| `submission.run` | `judge.v1.Submission` | api → judge (예제 실행, 저지연 레인) |
| `submission.submit` | `judge.v1.Submission` | api → judge (정식 제출 레인) |
| `submission.batch` | `judge.v1.Submission` | problem → judge (교차검증 대량 실행, 최저 우선 레인. [ADR-0023](../docs/decisions/0023-problem-kafka-wiring.md)) |
| `submission.result` | `judge.v1.JudgeResult` | judge → api·problem (problem은 그룹 없이 자기 검증 제출만 상관 수집) |
| `problem.generate` | `problem.v1.GenerationRequest` | api → problem (생성 요청, [ADR-0022](../docs/decisions/0022-m3-kickoff-problem-service.md)) |
| `problem.candidate` | `problem.v1.ProblemCandidate` | problem → api (검증 후보 — VALIDATED/REJECTED/파이프라인 실패) |

테스트 데이터는 메시지에 싣지 않는다 — MinIO 번들 참조(키+해시)만 실어 나르는 **claim-check** 패턴([ADR-0009] 결정 2).

## 상태

- `judge/v1`·`common/v1`: **실코드 검증 완료** — api·judge·problem 세 소비자가 실전에서 쓴다.
- `problem/v1`: **초안(Draft)** — 필드 구성은 api 검수 큐(candidate 컨슈머) 구현 시 마저 확정.

## 스키마 진화 규칙 (Protobuf)

- 필드 번호는 재사용 금지 — 제거 시 `reserved` 처리.
- 기존 필드의 번호·타입 변경 금지. 추가는 새 번호로.
- 호환성이 깨지는 변경은 패키지 버전을 올린다(`judge.v1` → `judge.v2`).
