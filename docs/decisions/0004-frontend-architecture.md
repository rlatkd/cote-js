# 0004. 프론트엔드 코드 아키텍처

- **상태**: Accepted
- **일자**: 2026-07-09

## 맥락

프론트엔드 코드 아키텍처 패턴을 정한다. 판단 기준은 포트폴리오 가치 / 학습 가치 / 문제 적합성(구현 난이도 제외). 정형화된 named 아키텍처(FSD 등)와 실무 기업 사례를 폭넓게 조사했다([engineering-notes](../engineering-notes.md) 리서치 1·2).

## 결정

**자체 정의 도메인 레이어드 아키텍처** 채택. 배민(우아한형제들)의 레이어 구조와 Money Forward의 entities/도메인 레이어를 우리 도메인에 맞게 정의한다.

**레이어 (단방향 의존: `app → views → entities → shared`)**

| 레이어 | 역할 |
|---|---|
| `app/` | 라우팅 전용(얇게). route segment·layout·loading/error·(추후 Server Actions). 서버에서 데이터 페칭 후 `views`에 전달 |
| `views/` | 화면(페이지) 단위 UI 조합. `entities`의 ViewModel·데이터 + `shared/ui`를 조합 |
| `entities/` | 도메인별 모듈. `model.ts`(타입/도메인) · `api.ts`(Repository=데이터 소스) · `use-*.ts`(ViewModel=훅) |
| `shared/` | 도메인 무관 공용. `ui/`(프레젠테이셔널 컴포넌트) · `lib/`(유틸) · `hooks/` |

- **의존 규칙**: 상위 → 하위 단방향만. `entities`끼리 직접 참조 금지, 공용은 `shared`로. (추후 ESLint `import/no-restricted-paths`로 강제)
- **MVVM**: 클라이언트 로직은 `entities`의 훅(=ViewModel)으로 추출, `views`는 조합·렌더링.
- **RSC 방침(중요)**: 정적/데이터 화면(홈·목록·지문·현황)은 서버 컴포넌트, 인터랙션 화면(통합 에디터·테마 토글)만 `client island`. **server-first를 교조적으로 적용하지 않는다.**
- **도메인**: `problem`, `submission`, `user` (추후 `ranking`, `contest`).

## 근거

- **실무 대기업의 실제 노선**: 배민·Money Forward 모두 named 폴더 아키텍처를 그대로 베끼지 않고 **도메인에 맞춘 자체 레이어를 정의**하고 내부 가이드로 규칙을 강제. 이 방식이 "정형 패턴 하나 채택"보다 실무에 가깝고 판단력을 보여줌.
- **MVVM + Server Actions**는 Money Forward에서 실전 검증된 조합.
- **RSC 부분 적용**: Artsy는 App Router/RSC를 도입했다 철회(RSC/client 경계 복잡, DX 저하). 우리 핵심 화면(Monaco 통합 에디터)은 인터랙션 덩어리라 교조적 server-first는 위험 → 정적 영역만 RSC로 실용 적용.

## 검토한 대안

- **(A) 경량 feature-based + RSC(Next 네이티브)**: 좋으나 RSC 교조화 위험(Artsy 반례). 본 결정이 이를 흡수하며 RSC를 절제.
- **(B) FSD-on-Next**: 공식 App Router 가이드로 이름 충돌은 해결됨(이전 "충돌로 부적합" 판단은 오류로 정정). 정형화는 강하나 소규모엔 무겁고, 실무 대기업이 그대로 쓰기보다 자체 정의하는 경향과 배치.
- **FSD**: 초기 사용자 제외. "Next와 마찰" 근거는 오류로 정정(공식 가이드 존재). 본 결정이 FSD의 레이어·단방향 의존 아이디어를 경량화해 흡수.
- **Clean/Hexagonal(프론트)**: "백엔드 냄새"로 반려.

## 결과

- `frontend/` 내부를 `app`(얇게) + `views` + `entities` + `shared`로 재배치.
- 상세 구조는 [architecture/web.md](../architecture/web.md).
- 의존성 규칙은 **ESLint(`import/no-restricted-paths`)로 강제 — 구현 완료** (`frontend/.eslintrc.json`, lint 통과). 도메인 전용 UI(뱃지)는 `shared`가 아니라 해당 `entities/*/ui`에 둔다(역방향 참조 방지).
