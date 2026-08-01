"""로컬 파이썬 실행기 — **임시**(파급 선언).

이 프로젝트의 원칙상 신뢰할 수 없는 코드는 샌드박스(judge)에서 실행해야 한다.
여기서는 LLM 생성 코드를 개발 머신에서 무격리 subprocess로 돌린다 — 유저
제출보다 적대성 가정이 낮고 개발 단계 한정이지만, 원칙과 어긋나는 **임시 상태**다.
Kafka 배선 슬라이스에서 judge batch 레인 실채점으로 대체한다(TODO 추적).
"""

import subprocess
import sys

_TIMEOUT_S = 10  # 로컬 검증용 여유값 — 판정용 제한이 아니다(그건 judge의 일)


def run_python(code: str, stdin: str, timeout_s: float = _TIMEOUT_S) -> str | None:
    """코드를 실행해 stdout을 돌려준다. 실패(에러·타임아웃)는 None.

    실패의 종류를 구분하지 않는 이유: 합의 판정에서 실패한 풀이는 종류와
    무관하게 '불일치'로만 취급된다. 상세가 필요해지면 그때 구조화한다.
    """
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def normalize_output(text: str) -> str:
    """judge의 비교 규칙과 동일: 각 줄 후행 공백 제거 + 말미 개행 제거."""
    return "\n".join(line.rstrip() for line in text.rstrip("\n").split("\n"))
