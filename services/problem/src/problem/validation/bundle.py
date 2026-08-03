"""테스트 번들 발행 — claim-check(ADR-0009)의 발행자 측(Python판).

api의 MinioBundleStore와 같은 규약: `cases/NN.in`·`cases/NN.out` 레이아웃의
tar.gz를 **결정적으로** 패킹하고(같은 케이스 집합 → 같은 바이트 → 같은 해시 →
judge 로컬 캐시 적중), 키는 콘텐츠 해시(`bundles/<sha256>.tgz`)로 오브젝트를
불변으로 만든다. 발행자 간(코틀린·파이썬) 바이트 동일성은 요구하지 않는다 —
각자 자기 산출물을 콘텐츠 주소화할 뿐이고, judge는 키+해시로만 소비한다.
"""

import gzip
import hashlib
import io
import tarfile

from minio import Minio
from minio.error import S3Error

from problem.domain.models import IoPair


def pack_bundle(cases: list[IoPair]) -> bytes:
    """결정적 tar.gz 패킹 — mtime·mode·uid·포맷을 고정한다(기본값은 호출 시각이
    끼어들어 같은 내용도 매번 다른 바이트가 된다)."""
    raw = io.BytesIO()
    # USTAR 고정: 기본 PAX 포맷은 확장 헤더에 부동소수 mtime 등이 끼어들 수 있다.
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for no, case in enumerate(cases, start=1):
            for ext, content in (("in", case.input), ("out", case.output)):
                data = content.encode()
                info = tarfile.TarInfo(name=f"cases/{no:02d}.{ext}")
                info.size = len(data)
                info.mode = 0o644
                info.mtime = 0
                tar.addfile(info, io.BytesIO(data))

    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode="wb", mtime=0) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()


def bundle_ref(archive: bytes) -> tuple[str, str]:
    """(key, sha256) — api와 같은 키 규약: bundles/<sha256>.tgz"""
    sha = hashlib.sha256(archive).hexdigest()
    return f"bundles/{sha}.tgz", sha


class BundleStore:
    """MinIO 업로드(동기 클라이언트 — 호출자가 스레드로 감싼다)."""

    def __init__(
        self, endpoint: str, access_key: str, secret_key: str, bucket: str, secure: bool = False
    ) -> None:
        self._client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self._bucket = bucket

    def publish(self, archive: bytes) -> tuple[str, str]:
        """번들을 올리고 (key, sha256)을 돌려준다. 키가 콘텐츠 주소라 이미 있으면 생략."""
        key, sha = bundle_ref(archive)
        try:
            self._client.stat_object(self._bucket, key)
            return key, sha  # 동일 콘텐츠가 이미 있다 — 업로드 생략
        except S3Error as e:
            if e.code != "NoSuchKey":
                raise
        self._client.put_object(
            self._bucket, key, io.BytesIO(archive), length=len(archive),
            content_type="application/gzip",
        )
        return key, sha
