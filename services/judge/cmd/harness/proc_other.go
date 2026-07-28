//go:build !linux

// 하니스는 **리눅스 컨테이너 안에서만** 도는 프로그램이다(프로세스 그룹 킬·getrusage는
// 리눅스 API). 이 파일은 개발 머신(Windows·macOS)에서 `go build ./...`·`go vet`이
// 통과하도록 두는 대체 구현일 뿐이며, 실행되면 즉시 실패한다.
package main

import "os/exec"

func useProcessGroup(_ *exec.Cmd) {}

func killGroup(_ int) {
	fail("이 하니스는 리눅스 컨테이너 안에서만 동작한다")
}

func maxChildRSS() uint32 { return 0 }
