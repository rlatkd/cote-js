# 0020. 데이터 부채 상환 — 스타터 템플릿 분리·결과 코드화·비정규화 제거 (V6)

- **상태**: Accepted
- **일자**: 2026-07-31

## 맥락 (Context)

[data-model](../architecture/data-model.md)에 기록된 부채 3건이 남아 있었다: ⑥ 스타터 코드가 문제×언어로 곱해짐(보류했던 재결정 — [ADR-0013](0013-judge-language-expansion.md)) ② `submission.problem_title` 비정규화 ④ `result` 한국어 리터럴 저장. 사용자 지시("AI 제외 전부 진행")로 일괄 상환.

## 결정 (Decision)

1. **스타터 코드 = 언어별 공용 템플릿 + 문제별 오버라이드.** `starter_template(language PK, code)` 신설(api 소유), `problem.starter_code`(JSONB)는 **nullable 오버라이드**로 강등. 유효 스타터 = 오버라이드 ?: 템플릿 — 병합은 api가 하고 **API 응답 계약(starterCode 맵)은 불변**(web 무변경).
2. **템플릿의 소유자는 api다 — judge 언어 레지스트리에 넣지 않는다.** 레지스트리는 "채점 지식"(이미지·실행·자원 강제)의 진실원이고, 스타터는 "서빙/편집 지식"이다. 같은 '언어별'이라도 **바뀌는 이유가 다르면 다른 진실원**이 맞다(템플릿 문구 수정에 judge 배포가 따라오면 안 됨). 언어 추가 시 접점은 늘지 않는다 — 어차피 api enum 추가가 필요했고, 그 마이그레이션에 템플릿 한 줄이 얹힐 뿐.
3. **`submission.result`·`submission_case.result`는 enum name('ACCEPTED'…)으로 저장.** 표시 라벨("맞았습니다")은 API 응답 경계에서만 붙인다. 한국어 문구는 UI 카피라 바뀔 수 있는데, 저장값이 문구면 카피 수정이 데이터 마이그레이션이 된다 — 저장은 불변 식별자, 표시는 경계 번역.
4. **`submission.problem_title` 컬럼 제거.** 목록·반영 조회 시 problem 조인(제목 프로젝션)으로 대체. 응답 계약(problemTitle)은 불변.

## 근거·대안 (Rationale / Alternatives)

- 템플릿을 judge 레지스트리에: 배제 — 채점기가 UI 문구의 주인이 되는 소유권 왜곡(2절).
- 템플릿을 코드 상수로: 배제 — 문제별 오버라이드(DB)와 진실원이 갈라지고, 수정에 배포가 필요.
- result 라벨 저장 유지: 배제 — "저장된 과거 데이터를 못 읽는" 위험을 라벨 왕복 테스트로 막아왔지만, 근본은 문구·데이터 결합. 단, **응답 계약까지 코드로 바꾸는 것은 배제**(web 표시 로직 연쇄 수정 — 이번 이득 없음).
- problem_title 유지(조인 회피): 배제 — 문제 제목 수정 시 과거 제출이 옛 제목을 보이는 실제 버그 소지. 조인 비용은 목록당 프로젝션 1회로 미미.

## 결과 (Consequences)

- V6 마이그레이션: 테이블 신설·기존 JSONB 오버라이드 비우기(현 데이터는 전부 공용 템플릿과 동일)·result 값 매핑·컬럼 드롭. 시드 개편.
- enum **name이 저장 계약**이 됨 — 이름 변경은 데이터 마이그레이션 동반(테스트로 이름 집합 고정).
- 언어 추가 절차 문서화: judge 레지스트리 → api `Language` enum → `starter_template` 행(같은 마이그레이션).
