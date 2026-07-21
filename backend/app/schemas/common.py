"""Shared response envelopes used across every router."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorResponse(BaseModel):
    """The shape of every non-2xx JSON response the API returns (see core/exceptions.py)."""

    error_code: str
    message: str
    path: str
    details: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaginationMeta(BaseModel):
    page: int = 1
    page_size: int = 50
    total: int = 0


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated envelope — any router can respond `PaginatedResponse[SomeSchema]`
    instead of hand-rolling pagination fields per endpoint."""

    items: list[T]
    meta: PaginationMeta
