# judge — 채점 서비스 (Go)

> 상태: **다언어 채점 + 실행 모드 완비** — executor·Docker 샌드박스·러너 3종(Python·Java·JavaScript) + Kafka 3레인 + MinIO 번들 + api 배선·SSE까지 관통.
> 결정 근거는 [ADR-0009](../decisions/0009-judge-kickoff-async-and-contracts.md)·[ADR-0011](../decisions/0011-codegen-and-kafka-client.md), 이음새 규칙은 [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md). 여기서는 **구조와 그 구조를 택한 판단**을 적는다.

## 1. 책임과 경계

judge는 **제출된 코드를 격리 실행해 판정한다.** 그 외의 것은 하지 않는다:

- **DB에 접근하지 않는다** — 결과는 Kafka 이벤트로만 발행([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)). Go와 Kotlin이 같은 스키마를 이중 소유하면 마이그레이션의 주인이 사라지기 때문.
- **테스트케이스를 DB에서 읽지 않는다** — MinIO 번들을 참조로 받는다(claim-check).
- **문제를 모른다** — 지문·난이도·태그는 judge의 관심사가 아니다. 아는 것은 "소스·제한·케이스 입출력"뿐.
- **실행 모드도 모른다** — run(예제)·submit(히든)의 구분은 api가 하고, judge는 어느 토픽에서 왔는지만 안다. 번들 규약이 하나라서 가능하다([ADR-0014](../decisions/0014-execution-modes-and-case-feedback.md)).

## 1-2. 지원 언어 ([ADR-0013](../decisions/0013-judge-language-expansion.md))

| 언어 | 이미지 | 실행 전 검증 | 메모리 강제 | 시간 배수 |
|---|---|---|---|---|
| Python | `python:3.12-alpine` | `py_compile`(문법 검사) | `RLIMIT_AS` | ×3 |
| Java | `eclipse-temurin:21-jdk-alpine` | `javac` | `-Xmx` | ×2 |
| JavaScript | `node:22-alpine` | `node --check` | `--max-old-space-size` | ×2 |

**메모리 강제 방식이 언어마다 다른 이유**: JVM·V8은 힙과 무관하게 가상주소를 크게 예약해서 `RLIMIT_AS`를 걸면 **정상 코드도 기동조차 못 한다.** 그래서 런타임 자체의 힙 옵션을 쓴다.

**하니스가 Go 단일 바이너리인 이유**: 언어별 하니스는 같은 로직(측정·타임아웃·프로세스 킬)을 복제하고, 파이썬 하니스로 통일하면 Java·Node 이미지에까지 파이썬을 설치해야 한다. 정적 링크된 Go 바이너리는 어느 베이스 이미지에도 그대로 얹힌다.

**미지원 언어는 명시적으로 실패한다** — 이전엔 언어를 무시하고 Python으로 실행해 C++ 제출이 `런타임 에러`로 **오판정**됐다(사용자는 자기 코드를 의심하게 된다).

## 2. 폴더 구조

```
services/judge/
├─ cmd/
│  ├─ judged/             워커 데몬 — Kafka 3레인 소비 → 채점 → 결과 발행
│  ├─ judgecli/           검증용 CLI (전송·저장소 없이 채점 1건 관통)
│  └─ judgeprobe/         개발용 제출 주입기 (번들 업로드 + 제출 발행 + 결과 대기)
├─ internal/
│  ├─ domain/             Task·JudgeResult·Verdict + 포트(Runner)
│  ├─ language/           언어별 실행 명세의 단일 진실원(이미지·소스명·명령·자원 정책)
│  ├─ executor/           채점 오케스트레이션(번들 로드→작업공간→실행→비교→집계)
│  ├─ sandbox/docker/     Runner 포트의 Docker 격리 어댑터
│  ├─ messaging/          Kafka 어댑터(franz-go) — 레인 소비·결과 발행
│  └─ bundle/             MinIO 어댑터 — claim-check 다운로드 + 해시 캐시
├─ gen/judge/v1/          Protobuf 생성 코드(커밋 — 원본은 /contracts)
├─ cmd/harness/           컨테이너 안에서 도는 실행기(Go 정적 바이너리, 전 러너 공용)
└─ runners/{python,java,javascript}/   러너 이미지(멀티스테이지 — 하니스 탑재)
```

**의존 방향**: `cmd → executor → domain ← sandbox/docker`, 그리고 `messaging → domain`(어댑터가 executor를 최소 인터페이스 `Judger`로만 참조). domain은 아무것도 의존하지 않는다(경량 클린).

### 왜 이 구조인가 — 어댑터 경계를 샌드박스에 그은 이유

이 프로젝트에서 확실히 바뀔 것을 하나 꼽으면 **격리 방식**이다(1단계 Docker → 2단계 커널 직접 제어). 반면 채점 절차(케이스 순회·출력 비교·판정 집계)는 격리 방식이 바뀌어도 그대로다. 그래서 **변할 것과 변하지 않을 것 사이**에 인터페이스를 뒀다 — `Runner` 포트. 2단계 전환은 어댑터 하나 추가로 끝나고 executor·domain은 한 줄도 바뀌지 않는다.

반대로 **잘못 그을 뻔한 경계**도 기록해둔다: "언어별로 executor를 따로 두기". 언어가 달라도 채점 절차는 동일하고 다른 것은 실행 방법뿐이다. 언어를 executor 층으로 올렸다면 언어 추가마다 절차가 복제됐을 것이다.

## 3. 채점 파이프라인

```
Task(소스·제한·번들경로)
  → 번들 로드      cases/NN.in + NN.out 읽기
  → 작업공간 준비   임시 디렉토리에 main.py + cases/ + out/ 배치
  → Compile        (Python은 no-op — 언어 추가용 자리)
  → RunCases       컨테이너 1개 기동 → harness가 케이스 루프
  → 집계           출력 비교 + 판정 부여 + 종합 산출
  → JudgeResult
```

### 판단 기록 — 컨테이너를 케이스마다 띄우지 않은 이유

케이스당 컨테이너를 새로 띄우면 격리는 더 깨끗하지만, 컨테이너 기동 비용(수백 ms)이 케이스 수만큼 곱해진다. 100케이스면 실행 시간보다 기동 시간이 압도한다. 그래서 **컨테이너 1개 안에서 harness가 케이스를 순회**하고, 케이스 간 격리는 프로세스 분리(케이스마다 새 프로세스 + `RLIMIT_AS`)로 얻는다. 제출 1건은 코드가 하나라 케이스끼리 서로를 오염시킬 동기가 없다 — 격리의 실익보다 비용이 큰 지점.

### 판단 기록 — 첫 실패에서 멈추지 않고 끝까지 도는 이유

많은 저지가 첫 오답에서 즉시 중단한다(자원 절약). 이 프로젝트는 **끝까지 돌고 케이스별 결과를 전부 남긴다** — 종합 판정만 첫 실패 케이스의 판정으로 정한다. 학습용 플랫폼이라 "몇 번 케이스에서 왜 틀렸나"가 사용자 가치이고, 나중에 배치 레인(problem의 교차검증)에서도 케이스별 분포가 검증 신호가 되기 때문. 대회용 저지라면 반대 선택이 맞다.

### 판단 기록 — 출력 비교 규칙

`normalize()`는 ① CRLF→LF ② 각 줄 후행 공백 제거 ③ 마지막 빈 줄들 무시 후 비교한다. 완전 일치(byte-exact)로 하면 `print()`의 개행 하나로 정답이 오답이 되고, 반대로 모든 공백을 무시하면 출력 형식이 의미 있는 문제(행렬·표)에서 오답을 통과시킨다. **줄 구조는 지키되 눈에 안 보이는 차이는 봐주는** 중간이 표준 저지의 관행.

## 4. 판정(Verdict) 부여 — 러너는 사실만, executor가 판단

harness(러너)는 `exit_code`·`timed_out`·`mem_exceeded`·시간·메모리라는 **관측 사실만** 보고하고, 그것을 Verdict로 번역하는 것은 executor다. 이유는 언어가 늘어날 때 드러난다 — "exit code 1"이 Python에선 런타임 에러지만 다른 언어에선 다른 의미일 수 있고, 판정 정책(예: MLE를 RE로 볼지)은 채점 도메인의 결정이지 실행기의 결정이 아니다. **번역 지점을 한 곳에 모아두면** 언어가 늘어도 정책이 흩어지지 않는다.

판정 우선순위: `TLE > MLE > RE > (출력 비교) AC/WA`. 시간 초과로 죽은 프로세스는 exit code도 비정상이라, 순서를 잘못 두면 TLE가 RE로 오분류된다.

### INTERNAL_ERROR를 별도 판정으로 둔 이유

샌드박스 기동 실패·harness 결과 누락은 **유저 코드의 잘못이 아니다**. 이것을 RE로 뭉뚱그리면 사용자는 자기 코드를 의심하며 시간을 버리고, 운영자는 장애를 못 본다. Go 코드에서도 같은 원칙을 지킨다 — **error는 시스템 장애에만, 유저 귀책은 Verdict로.** 그래서 `Compile()`은 컴파일 실패 시 error를 반환하지 않는다(정상 동작이므로).

## 5. 샌드박스 — 1단계 Docker 격리

남의 코드를 실행한다는 것은 원격 코드 실행을 기능으로 제공한다는 뜻이다. 걸어둔 방어([runner.go](../../services/judge/internal/sandbox/docker/runner.go)):

| 위협 | 방어 | 옵션 |
|---|---|---|
| 무한 루프 | 케이스별 타임아웃 + 전체 예산 초과 시 컨테이너 강제 킬 | harness timeout, `docker kill` |
| 메모리 폭식 | 프로세스 주소공간 상한(정밀) + 컨테이너 상한(backstop) | `RLIMIT_AS`, `--memory`(+`--memory-swap` 동일값으로 스왑 차단) |
| fork bomb | 프로세스 수 상한 | `--pids-limit 64` |
| 외부 통신·유출 | 네트워크 네임스페이스 자체를 없앰 | `--network none` |
| 파일시스템 변조 | 루트 읽기 전용 + 쓰기는 tmpfs만 | `--read-only`, `--tmpfs /tmp:size=16m` |
| 권한 상승 | 비특권 유저 + 신규 권한 획득 차단 + 케이퍼빌리티 전부 제거 | `--user 65534`, `--security-opt no-new-privileges`, `--cap-drop ALL` |
| CPU 독점 | CPU 상한 | `--cpus 1` |

### 판단 기록 — 메모리 한도를 두 겹으로 건 이유

컨테이너 `--memory`만 쓰면 **한도 초과 시 커널 OOM killer가 프로세스를 죽이는데, 그것이 harness일 수도 있다**(컨테이너 전체가 죽어 결과를 못 받음 → INTERNAL_ERROR). 그래서 정밀 한도는 제출 프로세스에만 `RLIMIT_AS`로 걸어 **Python이 `MemoryError`로 스스로 죽게** 하고, 컨테이너 한도는 그보다 여유(+64MB)를 둬 harness의 생존을 보장하는 backstop으로 뒀다. "누가 죽어야 하는가"를 설계한 것.

### 판단 기록 — `docker kill`을 따로 부르는 이유

Go의 `exec.CommandContext`는 컨텍스트 만료 시 **docker CLI(클라이언트 프로세스)만** 죽인다 — 데몬이 띄운 컨테이너는 살아남아 CPU를 계속 태운다. 그래서 예산 초과 시 컨테이너 이름으로 `docker kill`을 명시 호출한다. 프로세스 트리와 데몬 모델이 분리된 시스템에서 흔히 놓치는 지점.

### 알려진 한계 (2단계에서 해소)

- **메모리 측정 정밀도**: `getrusage(RUSAGE_CHILDREN).ru_maxrss`는 자식 전체의 고수위라 케이스 간 단조 증가한다(케이스별 피크가 아님). 정확한 케이스별 피크는 cgroup `memory.peak` 직접 조회(2단계)에서.
- **MLE 판정 방식**: 지금은 `MemoryError` 문자열로 식별한다. 언어 중립적이지 않아 언어 추가 시 재설계 대상(cgroup 이벤트 기반이 정답).
- **시스템콜 제한 없음**: seccomp 프로파일은 도커 기본값에 의존한다. 화이트리스트 방식은 2단계.
- **네트워크 차단의 증상**: `--network none`에서 외부 접속 시도는 즉시 실패가 아니라 **DNS 해석에서 멈춰 TLE로 관측**된다(실증). 차단은 유효하지만 판정이 TLE로 나오는 것은 인지해둘 것.

## 6. 러너 이미지 소유권

언어 러너 이미지(`runners/python`)는 **infra가 아니라 judge가 소유**한다. 인프라(DB·브로커)는 여러 서비스가 공유하는 실행 기반이지만, **어떤 인터프리터 버전으로 채점하느냐는 판정에 직접 영향을 주는 채점의 일부**다(같은 코드가 3.11에선 통과하고 3.13에선 실패할 수 있다). 단일 작성자 원칙의 연장선.

## 7. 검증 — judgecli

Kafka·MinIO 없이 채점 코어만 관통하는 CLI. ADR-0009의 개발 순서("코어를 전송 무관하게 먼저 검증")를 실행하는 도구이자, 어댑터를 붙인 뒤에도 **격리 회귀 테스트**로 남는다.

```bash
go run ./cmd/judgecli -bundle <dir> -source <file.py> -time-ms 1000 -mem-mb 256
```

검증 결과는 [guides/verification.md](../guides/verification.md) 참조 — AC/WA/TLE/MLE/RE 5종 + 보안 2종(네트워크·fork bomb).

## 8. 메시징 — Kafka 어댑터 ([internal/messaging](../../services/judge/internal/messaging/kafka.go))

```
submission.run|submit|batch  ──▶ judged ──▶ (번들 확보) ──▶ 채점 ──▶ submission.result
```

계약은 Protobuf([contracts/](../../contracts/)), 클라이언트는 franz-go, 생성 코드는 `gen/`에 커밋([ADR-0011](../decisions/0011-codegen-and-kafka-client.md)).

### 판단 기록 — 오프셋을 채점 뒤에 커밋하는 이유 (at-least-once)

자동 커밋이면 "커밋 → 채점 중 워커 사망" 순서에서 **제출이 통째로 유실**되고, 사용자 화면은 영원히 "채점 중"에 머문다. 수동 커밋이면 같은 상황에서 다시 채점한다(중복). 즉 **유실 대신 중복을 택했다** — 채점은 순수 함수에 가까워(같은 코드·같은 케이스 → 같은 판정) 중복의 해가 작고, 유실은 사용자에게 직접 보이는 실패다. 중복 제거는 api가 `submission_id` 기준 멱등 저장으로 처리한다.

exactly-once(Kafka 트랜잭션)는 배제했다 — 채점의 부수효과가 외부(Docker 실행)에 있어 트랜잭션이 되돌리지 못한다. 비용만 크고 보장은 불완전.

### 판단 기록 — 레인 우선순위를 폴 배치 내 정렬로 구현

세 레인을 함께 구독하고, 한 번의 폴에서 받은 레코드를 `run < submit < batch`로 **안정 정렬**해 처리한다(같은 레인 내 도착 순서 보존). 대안인 "레인별 전용 워커 풀"은 워커를 3배로 만들고 레인별 유휴 자원이 생긴다.

**한계(명시)**: 이건 *한 폴 안에서의* 우선순위다. batch를 이미 집어 든 뒤 도착한 run은 그 batch가 끝나야 실행된다. 엄밀한 선점이 필요하면 레인별 동시성 슬롯 분리로 확장한다(M2).

### 그 밖의 규칙

- **poison message**: 역직렬화 실패는 재시도해도 같으므로 로그만 남기고 건너뛴다(레인을 막지 않는다). DLQ는 운영 단계 재검토.
- **장애 시에도 결과를 보낸다**: 시스템 장애면 `INTERNAL_ERROR` 결과를 발행한다. **침묵이 최악의 실패 모드** — 결과를 안 보내면 화면이 영구히 "채점 중"이다.
- **결과 토픽 키 = `submission_id`**: 같은 제출의 결과가 같은 파티션으로 가 순서가 보장된다(순서가 필요한 단위는 제출).

## 9. 번들 — claim-check 소비자 ([internal/bundle](../../services/judge/internal/bundle/minio.go))

메시지에 실려 온 참조(오브젝트 키 + sha256)로 MinIO에서 번들을 받아 로컬에 푼다.

- **캐시 키가 경로가 아니라 콘텐츠 해시**다 — 문제를 수정해 번들이 바뀌면 해시가 달라져 자동 재다운로드. 무효화 로직이 필요 없다.
- **`.complete` 마커로 캐시 유효성 판단**: 디렉토리 존재만 보면 다운로드 중 죽은 **반쪽 캐시를 유효로 오인**한다. 해제는 `.staging`에 하고 완료 후 rename(원자적 게시).
- **해시 불일치는 채점 거부**: 발행자가 알린 해시와 실제 내용이 다르면 계약 위반이다. 조용히 채점하면 잘못된 테스트로 판정하게 된다.
- **zip slip 방어**: 아카이브 내부 경로(`../`)를 신뢰하지 않고, 심볼릭 링크는 무시한다 — 테스트 데이터에 필요 없고 캐시 밖으로 쓰는 탈출 경로가 된다.

## 10. 다음 단계

1. **api 배선** — 제출 시 프로듀스(3레인 선택), 결과 소비 → DB 저장(멱등) → SSE 푸시. JVM Protobuf 생성기 확보 방식도 이때 결정([ADR-0011](../decisions/0011-codegen-and-kafka-client.md) 미결).
2. **테스트케이스 발행 경로** — 지금은 judgeprobe가 번들을 올린다. 실제로는 api가 문제 등록 시 번들을 올리고 키·해시를 DB에 보관해야 한다(시드에 히든 케이스 추가 포함).
3. **워커 수평 확장**(M2) — 컨슈머 그룹은 이미 준비됨. 레인별 동시성 슬롯·SSE Redis 전환이 함께.
