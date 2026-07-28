//go:build linux

package main

import (
	"os/exec"
	"syscall"
)

// useProcessGroup — 자식을 새 프로세스 그룹의 리더로 만든다.
// 그래야 타임아웃 때 손자까지 한 번에 죽일 수 있다.
func useProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// killGroup — 음수 pid는 "그 프로세스 그룹 전체"를 뜻한다.
func killGroup(pid int) {
	_ = syscall.Kill(-pid, syscall.SIGKILL)
}

// maxChildRSS — 자식 프로세스들의 최대 상주 메모리(KB).
// 알려진 한계: RUSAGE_CHILDREN은 **누적 고수위**라 케이스 간 단조 증가한다
// (케이스별 정밀 피크는 샌드박스 2단계에서 cgroup으로).
func maxChildRSS() uint32 {
	var ru syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_CHILDREN, &ru); err != nil {
		return 0
	}
	return uint32(ru.Maxrss)
}
