# CoteJS 문서

AI 기반 알고리즘 문제 생성·검증 + 온라인 코딩 테스트 플랫폼 프로젝트의 문서 허브.

> **살아있는 문서.** 이 프로젝트는 장기 진행되며, 이 문서들은 언제든 추가·개선·재구성된다. Claude는 진행하면서 필요한 문서·개선을 스스로 제안하고 도입한다.

## 문서 지도

| 문서 | 용도 |
|---|---|
| [worklog.md](worklog.md) | **작업 일지** — 세션별 한 일·검증·중단점·다음 (세션 간 연속성) |
| [learning-notes.md](learning-notes.md) | **학습 노트** — 구현·설계에서 배운 것 축적 (면접 대비 자산) |
| [engineering-notes.md](engineering-notes.md) | 진행 중 고민·검토·아이디어·열린 질문 (사고 과정) |
| [TODO.md](TODO.md) | 로드맵(마일스톤) + 작업 백로그 |
| [glossary.md](glossary.md) | 도메인·기술 용어집 |
| [decisions/](decisions/) | ADR — 아키텍처 결정 기록(확정 결정의 정식 문서) |
| [architecture/](architecture/) | 시스템 전체 + 서비스별 아키텍처 상세 + 데이터 모델 |
| [guides/](guides/) | 개발 가이드 (시작하기·컨벤션·검증 체크리스트) |

> 살아있는 문서(worklog·learning-notes·verification·data-model)는 기록 추가 시 **날짜+시각**을 기입한다.

## 문서 역할 분리

혼선을 막기 위해 어디에 무엇을 쓰는지 고정한다.

- **[/README.md](../README.md)** — **시스템 설계 문서**(전체 구성·서비스·스택). 의사결정으로 큰 틀·세부가 바뀌면 함께 갱신한다.
- **[/CLAUDE.md](../CLAUDE.md)** — Claude 작업 지침 + **확정 제약 요약**. 짧게.
- **[decisions/](decisions/) (ADR)** — 확정된 결정 1건당 1문서. 배경·대안·결과 포함. 결정의 **정식 기록**.
- **[engineering-notes.md](engineering-notes.md)** — 아직 확정 안 된 **논의·근거·아이디어**.
- **[TODO.md](TODO.md)** — 해야 할 일.
- **[architecture/](architecture/)** — "무엇을 정했나"가 아니라 "어떻게 생겼나"(구조·흐름).

## 앞으로 추가 예정 (착수 시점에 생성)

빈 문서를 미리 만들지 않는다. 실제 착수할 때 만든다.

- **폴리글랏 경계 계약 (IDL — Kafka 토픽/OpenAPI)** — Judge Kafka 연결 시
- **보안 노트 (샌드박스 격리)** — Judge 착수 시
- **테스트 전략** — hub 테스트 스위트 도입 시
- **배포/인프라 런북** — K8s 이관 시

(데이터 모델은 [architecture/data-model.md](architecture/data-model.md)로 생성됨 — 2026-07-25)
