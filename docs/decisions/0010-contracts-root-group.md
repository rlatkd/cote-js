# 0010. 루트 `contracts/` 신설 — 언어 중립 IDL 스키마의 거처 (0008 루트 구성 개정)

- **상태**: Accepted
- **일자**: 2026-07-26
- **개정**: [0008](0008-service-naming-and-group.md)의 "루트 = `services / infra / docs` 3개념" 결정 (원문 동결)
- **관련**: [0009](0009-judge-kickoff-async-and-contracts.md)(Protobuf 채택 — 이 결정의 원인)

## 맥락

[0009]에서 api↔judge Kafka 계약을 Protobuf로 확정하자 `.proto` 파일의 거처 문제가 생겼다. IDL 스키마는 성격이 특이하다:

- **한 서비스의 소유물이 아니다.** api(Kotlin)는 프로듀서 코드를, judge(Go)는 컨슈머 코드를 같은 파일에서 생성한다. M3에서 problem/plagiarism(Python)도 같은 방식으로 합류한다. 서비스 사이의 약속이지 누구의 내부 구현이 아니다.
- 그런데 [0008]이 루트를 `services / infra / docs` 3개념으로 확정해놔서, 계약 파일이 들어갈 자연스러운 자리가 없다 — 서비스도, 인프라(실행 기반)도, 문서도 아니다.

## 결정

**루트에 `contracts/`를 신설한다. 루트는 4개념이 된다: `services / infra / docs / contracts`.**

- `contracts/` = **언어 중립 IDL 스키마의 거처**(현재 Protobuf `.proto`). 각 서비스는 여기서 자기 언어로 코드를 생성해 간다(생성물은 각 서비스 안).
- 계약의 실제 성격(공유물·중립 지대)을 구조가 그대로 말한다 — [0008]의 "내용물 직설" 원칙과 정합. judge도 "남의 서비스 폴더"가 아닌 중립 위치에서 가져와 대등하다.
- 코드젠 도구(buf 등)·빌드 연동은 judge 착수 시 확정한다.

### 검토한 대안 — 소유 서비스(api) 안에 두기

루트 3개념은 유지되지만 왜곡이 생겨 배제: ① 계약의 "주인"을 api로 임명하는 셈인데 결과토픽 스키마는 judge가 발행하는 메시지 — api가 주인일 근거가 약함 ② Go 빌드가 남의 서비스 폴더(`services/api/...`)를 참조하게 돼 서비스 경계가 흐려짐. 구조를 지키려고 실체를 왜곡하는 선택.

### 구 `contracts` 패키지(폐기)와의 구분 — 혼동 주의

NestJS 시절의 `platform/contracts`(TS 타입+zod 공유 패키지, [0005])는 **"프론트·백이 같은 언어일 때만 가능한 타입 공유 라이브러리"**였고 Kotlin 전환([0007])으로 폐기됐다. 이번 `contracts/`는 **언어 중립 IDL 스키마 저장소**로, 폐기 사유가 적용되지 않는다 — 오히려 폴리글랏이기 **때문에** 필요하다. 이름만 같고 성격이 다르다.

### 경계 정리 — 무엇이 `contracts/`에 들어가고 무엇이 아닌가

| 계약 | 위치 | 이유 |
|---|---|---|
| api↔judge Kafka 메시지 (Protobuf) | `contracts/` | 손으로 작성하는 공유 스키마 |
| (M3~) api↔AI 경계 IDL | `contracts/` | 〃 |
| web↔api REST | 해당 없음 | api가 스펙을 **생성**(springdoc OpenAPI)하고 web이 타입 codegen — 원본이 api 코드라 거처 문제가 없음([0007] 방식 유지) |

## 파급

- [0008] 상태 줄 갱신(루트 구성 항목 이 ADR로 개정). CLAUDE.md '모노레포 구조'·루트 README·glossary 갱신.
