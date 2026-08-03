# problem — AI 문제 생성·검증 파이프라인 (Python)

> 착수: 2026-08-01 ([ADR-0022](../decisions/0022-m3-kickoff-problem-service.md)). 이 문서는 구현 진행에 따라 갱신한다.

## 책임

**문제 제작 공정** — 생성(LLM)·검증(자동)·후보 발행까지. 게시는 하지 않는다(검수·게시는 api admin — [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)). 코어 DB 접근 금지.

핵심 원리(learning-notes 'AI 플랫폼에서 AI는 런타임 경로에 없다'): AI의 산출물은 검증을 거쳐 **데이터로 물화**되고, 유저 채점 경로에는 LLM이 없다.

## 경계 (Kafka 배선 완료 — [ADR-0023](../decisions/0023-problem-kafka-wiring.md), 2026-08-03)

| 방향 | 수단 | 내용 |
|---|---|---|
| api → problem | Kafka `problem.generate` (Protobuf [problem/v1](../../contracts/proto/problem/v1/generation.proto)) | 생성 요청(난이도·태그·지시). 소비=그룹 `problem-workers`·**수동 커밋 at-least-once**(후보 발행 후 커밋) |
| problem → api | Kafka `problem.candidate` ([candidate.proto](../../contracts/proto/problem/v1/candidate.proto)) | 검증 리포트 포함 후보. VALIDATED=검수 큐 대상, REJECTED=성공률 관측용, **파이프라인 실패=failure(Error)** — 반려와 구분(지표 오염 방지) |
| problem → judge | Kafka `submission.batch` ([judge/v1](../../contracts/proto/judge/v1/submission.proto)) | 독립 풀이 실채점 — batch 레인이 검증 트래픽 자리(ADR-0006). **음수 submission_id** 공간(코어 DB와 무충돌, api는 미지 id 스킵) |
| judge → problem | Kafka `submission.result` (judge/v1) | 결과 상관 수집 — **그룹 없음·latest**(작업 분배가 아니라 pub/sub: 그룹이면 다중 워커에서 자기 결과를 놓친다). 출력 동일성은 `CaseResult.output_sha256`(정규화 출력 해시 — 원문 비노출) |
| problem → MinIO | `testdata` 버킷 `bundles/<sha256>.tgz` | 예제 번들 claim-check 발행 — api와 같은 레이아웃(`cases/NN.in|out`)·결정적 패킹·콘텐츠 주소 키 |

## 내부 구조 (처리 단계 네이밍 — ADR-0008)

```
src/problem/
├─ domain/        # GenerationParams · ProblemDraft(생성 초안, pydantic) · SolutionRun(동일성 식별자)
├─ llm/           # 프로바이더 격리 — init_chat_model 팩토리. 개발=저가(Gemini 무료 티어),
│                 # 주력은 품질 단계 재결정(사용자 확정 2026-08-01). 다변화(탈상관) 대비 주입 구조
├─ generation/    # 생성 체인 v0: 프롬프트 | 모델 | PydanticOutputParser
├─ validation/    # solver(독립 풀이 — 지문만 노출, solution_sketch 차단)
│                 # + normalize(judge 비교 규칙 미러 + 출력 동일성 식별자 sha256)
│                 # + bundle(결정적 tar.gz 패킹 + MinIO 발행)
│                 # + judge_runner(batch 발행·result 상관 수집 — 무격리 실행기 대체, ADR-0023)
│                 # + consensus(순수 판정 — 식별자를 값으로 받음, '풀이 간 합의 vs 초안 일치' 분리 진단)
│                 # 2차 예정: brute-force 앵커·히든 케이스 생성(출력 원문 필요 — ADR-0023 한계)·stress testing
├─ workflow/      # pipeline: 생성→독립 풀이→실채점→합의→후보 (지휘자=problem, 엔진 미도입 — ADR-0006)
├─ messaging/     # config(환경변수·토픽 상수) · translate(proto↔내부 모델 ACL·추적 자식 스팬)
│                 # · worker(problem-worker 데몬 — judged 대응물) · probe(problem-probe 주입기)
├─ v1/ ‥ ../common/ ../judge/   # 생성 전용(buf.gen.python.yaml, 커밋) — 직접 수정 금지
├─ cli.py         # 수동 트리거: uv run problem-generate
├─ validate_cli.py# 수동 검증(judge 실채점 경유): problem-validate [--solutions 파일…]
└─ app.py         # FastAPI — 현재 /health만
```

- 도구: Python 3.13 + **uv**(lock이 버전 진실원) + LangChain 1.x + **aiokafka**(순수 파이썬 asyncio — franz-go의 cgo 회피와 같은 계열 근거) + **minio-py** + pytest.
- 테스트: 페이크·순수 값으로 배관 불변식만(합의 판정·정규화=judge 규칙·JudgeResult 매핑·번들 결정성·경계 번역) — LLM 품질·Kafka 왕복은 테스트 대상 아님(ADR-0016, 왕복은 verification 절차 11).
- 코드젠: `buf.gen.problem.yaml`(api용 Java) + **`buf.gen.python.yaml`**(problem용 — judge/common 소비자라 전체 proto, 생성 루트=`src/`가 import 루트). CI 드리프트 검사 3템플릿.
- 추적: GenerationRequest.trace → 자식 스팬(`translate.child_trace`) → judge 제출·후보에 전파, 로그에 `trace_id` 병기. OTel SDK(스팬 발행)는 미도입 — 필요 시 ADR-0018 계열로.

## 지문 생성 규칙 (프롬프트에 강제, ADR-0021 연동)

기존 문제 복제·번안 금지 / 정답 유일 출력 설계(special judge 회피) / 제약 수치 명시 + 전수탐색 변별력 / few-shot 예시는 라이선스 실확인 후 도입.
