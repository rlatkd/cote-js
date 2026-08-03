import datetime

from google.protobuf import timestamp_pb2 as _timestamp_pb2
from common.v1 import trace_pb2 as _trace_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Submission(_message.Message):
    __slots__ = ("submission_id", "problem_id", "language", "source_code", "time_limit_ms", "memory_limit_mb", "test_bundle_key", "test_bundle_sha256", "submitted_at", "trace")
    SUBMISSION_ID_FIELD_NUMBER: _ClassVar[int]
    PROBLEM_ID_FIELD_NUMBER: _ClassVar[int]
    LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    SOURCE_CODE_FIELD_NUMBER: _ClassVar[int]
    TIME_LIMIT_MS_FIELD_NUMBER: _ClassVar[int]
    MEMORY_LIMIT_MB_FIELD_NUMBER: _ClassVar[int]
    TEST_BUNDLE_KEY_FIELD_NUMBER: _ClassVar[int]
    TEST_BUNDLE_SHA256_FIELD_NUMBER: _ClassVar[int]
    SUBMITTED_AT_FIELD_NUMBER: _ClassVar[int]
    TRACE_FIELD_NUMBER: _ClassVar[int]
    submission_id: int
    problem_id: int
    language: str
    source_code: str
    time_limit_ms: int
    memory_limit_mb: int
    test_bundle_key: str
    test_bundle_sha256: str
    submitted_at: _timestamp_pb2.Timestamp
    trace: _trace_pb2.TraceContext
    def __init__(self, submission_id: _Optional[int] = ..., problem_id: _Optional[int] = ..., language: _Optional[str] = ..., source_code: _Optional[str] = ..., time_limit_ms: _Optional[int] = ..., memory_limit_mb: _Optional[int] = ..., test_bundle_key: _Optional[str] = ..., test_bundle_sha256: _Optional[str] = ..., submitted_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., trace: _Optional[_Union[_trace_pb2.TraceContext, _Mapping]] = ...) -> None: ...
