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

class CandidateStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    CANDIDATE_STATUS_UNSPECIFIED: _ClassVar[CandidateStatus]
    CANDIDATE_STATUS_VALIDATED: _ClassVar[CandidateStatus]
    CANDIDATE_STATUS_REJECTED: _ClassVar[CandidateStatus]
CANDIDATE_STATUS_UNSPECIFIED: CandidateStatus
CANDIDATE_STATUS_VALIDATED: CandidateStatus
CANDIDATE_STATUS_REJECTED: CandidateStatus

class IoPair(_message.Message):
    __slots__ = ("input", "output")
    INPUT_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_FIELD_NUMBER: _ClassVar[int]
    input: str
    output: str
    def __init__(self, input: _Optional[str] = ..., output: _Optional[str] = ...) -> None: ...

class ValidationReport(_message.Message):
    __slots__ = ("solutions_total", "solutions_agreed", "brute_force_checked", "judge_verified", "notes")
    SOLUTIONS_TOTAL_FIELD_NUMBER: _ClassVar[int]
    SOLUTIONS_AGREED_FIELD_NUMBER: _ClassVar[int]
    BRUTE_FORCE_CHECKED_FIELD_NUMBER: _ClassVar[int]
    JUDGE_VERIFIED_FIELD_NUMBER: _ClassVar[int]
    NOTES_FIELD_NUMBER: _ClassVar[int]
    solutions_total: int
    solutions_agreed: int
    brute_force_checked: bool
    judge_verified: bool
    notes: str
    def __init__(self, solutions_total: _Optional[int] = ..., solutions_agreed: _Optional[int] = ..., brute_force_checked: _Optional[bool] = ..., judge_verified: _Optional[bool] = ..., notes: _Optional[str] = ...) -> None: ...

class ProblemCandidate(_message.Message):
    __slots__ = ("request_id", "status", "title", "description", "input_spec", "output_spec", "difficulty", "tier", "tags", "time_limit_ms", "memory_limit_mb", "examples", "hidden_cases", "validation", "failure", "generated_at", "trace")
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    INPUT_SPEC_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_SPEC_FIELD_NUMBER: _ClassVar[int]
    DIFFICULTY_FIELD_NUMBER: _ClassVar[int]
    TIER_FIELD_NUMBER: _ClassVar[int]
    TAGS_FIELD_NUMBER: _ClassVar[int]
    TIME_LIMIT_MS_FIELD_NUMBER: _ClassVar[int]
    MEMORY_LIMIT_MB_FIELD_NUMBER: _ClassVar[int]
    EXAMPLES_FIELD_NUMBER: _ClassVar[int]
    HIDDEN_CASES_FIELD_NUMBER: _ClassVar[int]
    VALIDATION_FIELD_NUMBER: _ClassVar[int]
    FAILURE_FIELD_NUMBER: _ClassVar[int]
    GENERATED_AT_FIELD_NUMBER: _ClassVar[int]
    TRACE_FIELD_NUMBER: _ClassVar[int]
    request_id: int
    status: CandidateStatus
    title: str
    description: str
    input_spec: str
    output_spec: str
    difficulty: str
    tier: str
    tags: _containers.RepeatedScalarFieldContainer[str]
    time_limit_ms: int
    memory_limit_mb: int
    examples: _containers.RepeatedCompositeFieldContainer[IoPair]
    hidden_cases: _containers.RepeatedCompositeFieldContainer[IoPair]
    validation: ValidationReport
    failure: _error_pb2.Error
    generated_at: _timestamp_pb2.Timestamp
    trace: _trace_pb2.TraceContext
    def __init__(self, request_id: _Optional[int] = ..., status: _Optional[_Union[CandidateStatus, str]] = ..., title: _Optional[str] = ..., description: _Optional[str] = ..., input_spec: _Optional[str] = ..., output_spec: _Optional[str] = ..., difficulty: _Optional[str] = ..., tier: _Optional[str] = ..., tags: _Optional[_Iterable[str]] = ..., time_limit_ms: _Optional[int] = ..., memory_limit_mb: _Optional[int] = ..., examples: _Optional[_Iterable[_Union[IoPair, _Mapping]]] = ..., hidden_cases: _Optional[_Iterable[_Union[IoPair, _Mapping]]] = ..., validation: _Optional[_Union[ValidationReport, _Mapping]] = ..., failure: _Optional[_Union[_error_pb2.Error, _Mapping]] = ..., generated_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., trace: _Optional[_Union[_trace_pb2.TraceContext, _Mapping]] = ...) -> None: ...
