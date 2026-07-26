// judgecli — 채점 1건을 전송(Kafka)·저장소(MinIO) 없이 로컬에서 실행하는 검증용 CLI.
// judge 코어(executor·sandbox)를 어댑터 없이 관통 테스트하는 용도(ADR-0009의 개발 순서:
// 코어를 전송 무관하게 먼저 검증 → Kafka·MinIO 어댑터는 그 뒤에 부착).
//
// 사용:
//
//	judgecli -bundle <dir> -source <file.py> [-time-ms 1000] [-mem-mb 256]
//
// 번들 레이아웃: <dir>/cases/01.in, 01.out, 02.in, ...
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/rlatkd/cotejs/services/judge/internal/domain"
	"github.com/rlatkd/cotejs/services/judge/internal/executor"
	"github.com/rlatkd/cotejs/services/judge/internal/sandbox/docker"
)

func main() {
	bundle := flag.String("bundle", "", "테스트케이스 번들 디렉토리 (cases/NN.in|out)")
	source := flag.String("source", "", "제출 소스 파일(.py)")
	timeMS := flag.Uint("time-ms", 1000, "시간 제한(ms)")
	memMB := flag.Uint("mem-mb", 256, "메모리 제한(MB)")
	flag.Parse()

	if *bundle == "" || *source == "" {
		flag.Usage()
		os.Exit(2)
	}

	code, err := os.ReadFile(*source)
	if err != nil {
		fmt.Fprintln(os.Stderr, "소스 읽기 실패:", err)
		os.Exit(1)
	}

	task := domain.Task{
		Language:      "python",
		SourceCode:    string(code),
		TimeLimitMS:   uint32(*timeMS),
		MemoryLimitMB: uint32(*memMB),
		BundleDir:     *bundle,
	}

	result, err := executor.New(docker.New()).Judge(context.Background(), task)
	if err != nil {
		fmt.Fprintln(os.Stderr, "채점 장애:", err)
	}

	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	if result.Verdict != domain.VerdictAccepted {
		os.Exit(1)
	}
}
