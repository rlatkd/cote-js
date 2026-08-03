"""출력 정규화·동일성 식별자 — judge의 비교 규칙을 그대로 미러링한다.

judge/v1 CaseResult.output_sha256의 소비자 측 재현 규칙(계약 주석 참조):
CRLF→LF, 각 줄 후행 공백·탭 제거, 말미 빈 줄 제거 후 sha256(hex).
초안의 기대 출력에 같은 규칙을 적용하면 judge가 보낸 해시와 원문 노출 없이
동일성을 비교할 수 있다. 이 규칙이 judge(executor.go normalize)와 어긋나면
합의 검증 전체가 조용히 무너지므로 테스트로 고정한다.
"""

import hashlib


def normalize_output(text: str) -> str:
    text = text.replace("\r\n", "\n")
    lines = [line.rstrip(" \t") for line in text.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def output_identity(text: str) -> str:
    """정규화된 출력의 sha256(hex) — judge의 outputDigest와 동일한 값."""
    return hashlib.sha256(normalize_output(text).encode()).hexdigest()
