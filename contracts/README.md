# contracts — 언어 중립 IDL 스키마 ([ADR-0010](../docs/decisions/0010-contracts-root-group.md))

서비스 사이를 오가는 메시지의 **계약 원본**. 각 서비스는 여기서 자기 언어로 코드를 생성해 간다(생성물은 각 서비스 안에, 원본은 여기만).

- 현재: api↔judge Kafka 메시지 (Protobuf, [ADR-0009](../docs/decisions/0009-judge-kickoff-async-and-contracts.md))
- 예정: api↔AI(problem·plagiarism) 경계 (M3~)
- **해당 없음**: web↔api REST — api가 OpenAPI 스펙을 생성하고 web이 codegen하는 방식([ADR-0007](../docs/decisions/0007-backend-kotlin-return.md))이라 원본이 api 코드다.

> 구 `platform/contracts`(TS 타입 공유 패키지, 폐기)와 이름만 같고 다른 것 — 그건 동일 언어 전제의 라이브러리, 이건 폴리글랏 전제의 IDL 저장소.

## 구조

```
contracts/
└─ proto/
   └─ judge/v1/            # api↔judge 채점 이음새 (버전 = 패키지에 포함)
      ├─ submission.proto  # 실행 요청 (api·problem → judge)
      └─ result.proto      # 판정 결과 (judge → api)
```

## 토픽 ↔ 메시지 매핑 ([ADR-0009](../docs/decisions/0009-judge-kickoff-async-and-contracts.md) 결정 4)

| Kafka 토픽 | 메시지 | 방향 |
|---|---|---|
| `submission.run` | `judge.v1.Submission` | api → judge (예제 실행, 저지연 레인) |
| `submission.submit` | `judge.v1.Submission` | api → judge (정식 제출 레인) |
| `submission.batch` | `judge.v1.Submission` | problem → judge (교차검증 대량 실행, 최저 우선 레인) |
| `submission.result` | `judge.v1.JudgeResult` | judge → api |

테스트 데이터는 메시지에 싣지 않는다 — MinIO 번들 참조(키+해시)만 실어 나르는 **claim-check** 패턴([ADR-0009] 결정 2).

## 상태

**초안(Draft).** 필드 구성은 judge 구현 착수 시 실코드로 검증하며 확정한다(특히 보류 결정 3건 — 샌드박스·언어 범위·SSE — 의 확정에 따라 조정 여지). 코드젠 도구(buf 등)·빌드 연동도 그때 확정.

## 스키마 진화 규칙 (Protobuf)

- 필드 번호는 재사용 금지 — 제거 시 `reserved` 처리.
- 기존 필드의 번호·타입 변경 금지. 추가는 새 번호로.
- 호환성이 깨지는 변경은 패키지 버전을 올린다(`judge.v1` → `judge.v2`).
