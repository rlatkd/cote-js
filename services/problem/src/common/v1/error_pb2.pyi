from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FaultOrigin(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FAULT_ORIGIN_UNSPECIFIED: _ClassVar[FaultOrigin]
    FAULT_ORIGIN_CALLER: _ClassVar[FaultOrigin]
    FAULT_ORIGIN_PROVIDER: _ClassVar[FaultOrigin]
FAULT_ORIGIN_UNSPECIFIED: FaultOrigin
FAULT_ORIGIN_CALLER: FaultOrigin
FAULT_ORIGIN_PROVIDER: FaultOrigin

class Error(_message.Message):
    __slots__ = ("code", "message", "origin", "retryable", "detail")
    CODE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    ORIGIN_FIELD_NUMBER: _ClassVar[int]
    RETRYABLE_FIELD_NUMBER: _ClassVar[int]
    DETAIL_FIELD_NUMBER: _ClassVar[int]
    code: str
    message: str
    origin: FaultOrigin
    retryable: bool
    detail: str
    def __init__(self, code: _Optional[str] = ..., message: _Optional[str] = ..., origin: _Optional[_Union[FaultOrigin, str]] = ..., retryable: _Optional[bool] = ..., detail: _Optional[str] = ...) -> None: ...
