# 아키텍처 문서

시스템이 **어떻게 생겼는지**(구조·데이터 흐름·컴포넌트 책임)를 설명한다. "무엇을 왜 정했는지"는 [decisions/](../decisions/)(ADR), 여기서는 그 결정이 반영된 실제 구조를 다룬다.

## 문서

| 문서 | 내용 |
|---|---|
| [system-overview.md](system-overview.md) | 전체 시스템 구성·서비스·데이터 흐름 |
| [frontend.md](web.md) | web(프론트) 내부 아키텍처 (Active) |
| [web-design-system.md](web-design-system.md) | 프론트 디자인 시스템 — 색 토큰·서체·표면 위계·모션·접근성 (Active) |
| [api.md](api.md) | api(Kotlin + Spring 백엔드) 아키텍처 — Hexagonal·코루틴·OpenAPI 계약 (Active) |
| [judge.md](judge.md) | judge(Go 채점) 아키텍처 — 포트/어댑터·판정 체계·샌드박스 격리·설계 판단 (Active) |
| [data-model.md](data-model.md) | 데이터 모델 — ERD·스키마 소유권([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md))·부채 기록 (Active) |
| [_template.md](_template.md) | 서비스 아키텍처 문서 템플릿 |

## 방침

- 서비스별 상세 아키텍처 문서는 **해당 서비스를 착수할 때** 생성한다(빈 껍데기 미리 만들지 않음).
- 예정: `problem.md`, `plagiarism.md` (서비스 네이밍은 [ADR-0008](../decisions/0008-service-naming-and-group.md), tester는 problem 내부 모듈로 병합 — [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)).
- **"왜"를 얕게 쓰지 않는다**: 구조 문서에도 그 구조를 택한 판단(검토한 대안·배제 이유·알려진 한계)을 함께 적는다. 결정 자체는 ADR, 일반화된 교훈은 [learning-notes](../learning-notes.md), 진행 중 고민은 [engineering-notes](../engineering-notes.md)로 흐른다.
