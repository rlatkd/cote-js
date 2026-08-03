import datetime

from google.protobuf import timestamp_pb2 as _timestamp_pb2
from common.v1 import error_pb2 as _error_pb2
from common.v1 import trace_pb2 as _trace_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Verdict(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    VERDICT_UNSPECIFIED: _ClassVar[Verdict]
    VERDICT_ACCEPTED: _ClassVar[Verdict]
    VERDICT_WRONG_ANSWER: _ClassVar[Verdict]
    VERDICT_COMPILE_ERROR: _ClassVar[Verdict]
    VERDICT_RUNTIME_ERROR: _ClassVar[Verdict]
    VERDICT_TIME_LIMIT_EXCEEDED: _ClassVar[Verdict]
    VERDICT_MEMORY_LIMIT_EXCEEDED: _ClassVar[Verdict]
    VERDICT_INTERNAL_ERROR: _ClassVar[Verdict]
VERDICT_UNSPECIFIED: Verdict
VERDICT_ACCEPTED: Verdict
VERDICT_WRONG_ANSWER: Verdict
VERDICT_COMPILE_ERROR: Verdict
VERDICT_RUNTIME_ERROR: Verdict
VERDICT_TIME_LIMIT_EXCEEDED: Verdict
VERDICT_MEMORY_LIMIT_EXCEEDED: Verdict
VERDICT_INTERNAL_ERROR: Verdict

class CaseResult(_message.Message):
    __slots__ = ("no", "verdict", "exec_time_ms", "memory_used_kb", "output_sha256")
    NO_FIELD_NUMBER: _ClassVar[int]
    VERDICT_FIELD_NUMBER: _ClassVar[int]
    EXEC_TIME_MS_FIELD_NUMBER: _ClassVar[int]
    MEMORY_USED_KB_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_SHA256_FIELD_NUMBER: _ClassVar[int]
    no: int
    verdict: Verdict
    exec_time_ms: int
    memory_used_kb: int
    output_sha256: str
    def __init__(self, no: _Optional[int] = ..., verdict: _Optional[_Union[Verdict, str]] = ..., exec_time_ms: _Optional[int] = ..., memory_used_kb: _Optional[int] = ..., output_sha256: _Optional[str] = ...) -> None: ...

class JudgeResult(_message.Message):
    __slots__ = ("submission_id", "verdict", "exec_time_ms", "memory_used_kb", "cases", "error_message", "judged_at", "failure", "trace")
    SUBMISSION_ID_FIELD_NUMBER: _ClassVar[int]
    VERDICT_FIELD_NUMBER: _ClassVar[int]
    EXEC_TIME_MS_FIELD_NUMBER: _ClassVar[int]
    MEMORY_USED_KB_FIELD_NUMBER: _ClassVar[int]
    CASES_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    JUDGED_AT_FIELD_NUMBER: _ClassVar[int]
    FAILURE_FIELD_NUMBER: _ClassVar[int]
    TRACE_FIELD_NUMBER: _ClassVar[int]
    submission_id: int
    verdict: Verdict
    exec_time_ms: int
    memory_used_kb: int
    cases: _containers.RepeatedCompositeFieldContainer[CaseResult]
    error_message: str
    judged_at: _timestamp_pb2.Timestamp
    failure: _error_pb2.Error
    trace: _trace_pb2.TraceContext
    def __init__(self, submission_id: _Optional[int] = ..., verdict: _Optional[_Union[Verdict, str]] = ..., exec_time_ms: _Optional[int] = ..., memory_used_kb: _Optional[int] = ..., cases: _Optional[_Iterable[_Union[CaseResult, _Mapping]]] = ..., error_message: _Optional[str] = ..., judged_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., failure: _Optional[_Union[_error_pb2.Error, _Mapping]] = ..., trace: _Optional[_Union[_trace_pb2.TraceContext, _Mapping]] = ...) -> None: ...
