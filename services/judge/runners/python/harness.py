# 컨테이너 내부 채점 하니스 — 케이스 루프·시간/메모리 측정·케이스별 한도 강제.
# 판정은 하지 않는다(사실만 보고) — 출력 비교·Verdict 부여는 Go executor의 몫.
#
# 계약(도커 어댑터와 합의):
#   입력  /judge/main.py, /judge/cases/NN.in, env CASE_COUNT·TIME_LIMIT_MS·MEM_LIMIT_MB
#   출력  /judge/out/NN.out(케이스별 stdout), /judge/result.json(케이스별 원시 결과)
#
# 알려진 한계(POC): mem_kb는 getrusage(RUSAGE_CHILDREN)의 고수위라 케이스 간 단조 증가 —
# 케이스별 정밀 피크는 샌드박스 2단계(cgroup 직접 제어)에서. MLE 강제는 RLIMIT_AS로 정확하다.
import json
import os
import resource
import subprocess
import sys
import time

JUDGE_DIR = "/judge"
CASE_COUNT = int(os.environ["CASE_COUNT"])
TIME_LIMIT_MS = int(os.environ["TIME_LIMIT_MS"])
MEM_LIMIT_MB = int(os.environ["MEM_LIMIT_MB"])


def limit_child():
    # 제출 코드에만 거는 케이스별 한도. harness 자신은 제한받지 않는다.
    limit_bytes = MEM_LIMIT_MB * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))


def run_case(no: int) -> dict:
    in_path = os.path.join(JUDGE_DIR, "cases", f"{no:02d}.in")
    out_path = os.path.join(JUDGE_DIR, "out", f"{no:02d}.out")

    with open(in_path, "rb") as stdin, open(out_path, "wb") as stdout:
        started = time.monotonic()
        proc = subprocess.Popen(
            [sys.executable, os.path.join(JUDGE_DIR, "main.py")],
            stdin=stdin,
            stdout=stdout,
            stderr=subprocess.PIPE,
            preexec_fn=limit_child,
        )
        timed_out = False
        try:
            _, stderr = proc.communicate(timeout=TIME_LIMIT_MS / 1000)
        except subprocess.TimeoutExpired:
            timed_out = True
            proc.kill()
            _, stderr = proc.communicate()
        elapsed_ms = int((time.monotonic() - started) * 1000)

    mem_kb = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss  # Linux: KB
    mem_exceeded = (not timed_out) and proc.returncode != 0 and b"MemoryError" in (stderr or b"")

    return {
        "no": no,
        "exit_code": proc.returncode,
        "timed_out": timed_out,
        "mem_exceeded": mem_exceeded,
        "time_ms": min(elapsed_ms, TIME_LIMIT_MS) if timed_out else elapsed_ms,
        "mem_kb": mem_kb,
    }


def main():
    results = [run_case(no) for no in range(1, CASE_COUNT + 1)]
    with open(os.path.join(JUDGE_DIR, "result.json"), "w") as f:
        json.dump(results, f)


if __name__ == "__main__":
    main()
