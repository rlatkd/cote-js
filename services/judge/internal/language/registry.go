// Package language — 언어별 "실행 방법" 명세의 단일 진실원.
//
// 여기 없는 지식이 다른 곳에 흩어지면 언어 추가가 여러 파일 수정으로 번진다.
// executor는 소스 파일명을, 샌드박스 어댑터는 이미지·명령을 이 명세에서 가져간다.
package language

import "fmt"

// MemoryMode — 메모리 한도를 **무엇으로 강제하는가**. 언어마다 다르다.
type MemoryMode string

const (
	// 프로세스 주소공간 상한(RLIMIT_AS). 인터프리터가 할당 실패로 스스로 죽는다.
	MemoryRlimit MemoryMode = "rlimit"
	// 런타임 자체의 힙 옵션. JVM·V8은 힙과 무관하게 가상주소를 크게 예약하므로
	// RLIMIT_AS를 걸면 **정상 코드도 기동조차 못 한다** — 그래서 -Xmx 같은 옵션을 쓴다.
	MemoryRuntimeFlag MemoryMode = "flag"
)

// MemPlaceholder — RunCmd 안에서 실제 메모리 한도(MB)로 치환되는 토큰.
const MemPlaceholder = "{MEM_MB}"

type Spec struct {
	ID string
	// 러너 이미지 — judge 소유(runners/). 컴파일러·런타임 버전이 판정을 바꾸므로 고정한다.
	Image string
	// 제출 소스가 저장될 파일명. Java는 public class 이름과 같아야 해서 Main.java 고정.
	SourceFile string
	// 실행 전 검증 단계. 컴파일 언어는 컴파일, 인터프리터 언어는 **문법 검사**를 넣는다
	// — 문법 오류를 케이스마다 런타임 에러로 반복 보고하는 대신 COMPILE_ERROR로 한 번에 알린다.
	CompileCmd []string
	RunCmd     []string
	MemoryMode MemoryMode
	// 런타임이 메모리 고갈 시 stderr에 남기는 문구(MLE 식별용).
	OOMSignature string
	// 시간 한도 배수 — 문제의 제한값은 통상 C/C++ 기준이라 느린 런타임엔 보정이 필요하다.
	// (온라인 저지의 일반 관행. 보정 없이는 정상 풀이도 TLE가 난다)
	TimeFactor float64
	// 런타임 상주 메모리 여유분 — 인터프리터·VM 자체가 쓰는 몫.
	MemoryMarginMB uint32
}

// 지원 언어. 프로토타입 범위는 3종(사용자 결정 2026-07-28) — C++·Go 등은 러너를 얹으면 된다.
var registry = map[string]Spec{
	"python": {
		ID:         "python",
		Image:      "cotejs-judge-python:3.12",
		SourceFile: "main.py",
		// 문법 오류를 컴파일 에러로 승격(py_compile은 실행 없이 파싱만 한다).
		CompileCmd:     []string{"python3", "-m", "py_compile", "main.py"},
		RunCmd:         []string{"python3", "main.py"},
		MemoryMode:     MemoryRlimit,
		OOMSignature:   "MemoryError",
		TimeFactor:     3.0,
		MemoryMarginMB: 32,
	},
	"java": {
		ID:         "java",
		Image:      "cotejs-judge-java:21",
		SourceFile: "Main.java",
		CompileCmd: []string{"javac", "-encoding", "UTF-8", "Main.java"},
		// SerialGC — 짧은 단일 코어 실행에선 병렬 GC의 스레드 기동이 손해다.
		RunCmd: []string{
			"java", "-Xmx" + MemPlaceholder + "m", "-Xss64m",
			"-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Dfile.encoding=UTF-8", "Main",
		},
		MemoryMode:     MemoryRuntimeFlag,
		OOMSignature:   "OutOfMemoryError",
		TimeFactor:     2.0,
		MemoryMarginMB: 96, // JVM은 힙 외(메타스페이스·스택·GC 구조체)에도 상당히 쓴다
	},
	"javascript": {
		ID:         "javascript",
		Image:      "cotejs-judge-node:22",
		SourceFile: "main.js",
		// --check: 실행 없이 파싱만 — 문법 오류를 COMPILE_ERROR로.
		CompileCmd:     []string{"node", "--check", "main.js"},
		RunCmd:         []string{"node", "--max-old-space-size=" + MemPlaceholder, "main.js"},
		MemoryMode:     MemoryRuntimeFlag,
		OOMSignature:   "heap out of memory",
		TimeFactor:     2.0,
		MemoryMarginMB: 64,
	},
}

// Lookup — 미지원 언어는 **명시적으로 실패**시킨다. 예전처럼 조용히 Python으로 실행하면
// 다른 언어 제출이 런타임 에러로 오판정된다(사용자가 자기 코드를 의심하게 된다).
func Lookup(id string) (Spec, error) {
	spec, ok := registry[id]
	if !ok {
		return Spec{}, fmt.Errorf("지원하지 않는 언어: %q (지원: %v)", id, Supported())
	}
	return spec, nil
}

func Supported() []string {
	ids := make([]string, 0, len(registry))
	for id := range registry {
		ids = append(ids, id)
	}
	return ids
}
