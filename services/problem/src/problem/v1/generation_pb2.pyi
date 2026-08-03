import datetime

from google.protobuf import timestamp_pb2 as _timestamp_pb2
from common.v1 import trace_pb2 as _trace_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GenerationRequest(_message.Message):
    __slots__ = ("request_id", "difficulty", "tags", "instruction", "requested_at", "trace")
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    DIFFICULTY_FIELD_NUMBER: _ClassVar[int]
    TAGS_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTION_FIELD_NUMBER: _ClassVar[int]
    REQUESTED_AT_FIELD_NUMBER: _ClassVar[int]
    TRACE_FIELD_NUMBER: _ClassVar[int]
    request_id: int
    difficulty: str
    tags: _containers.RepeatedScalarFieldContainer[str]
    instruction: str
    requested_at: _timestamp_pb2.Timestamp
    trace: _trace_pb2.TraceContext
    def __init__(self, request_id: _Optional[int] = ..., difficulty: _Optional[str] = ..., tags: _Optional[_Iterable[str]] = ..., instruction: _Optional[str] = ..., requested_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., trace: _Optional[_Union[_trace_pb2.TraceContext, _Mapping]] = ...) -> None: ...
