from __future__ import annotations

from datetime import datetime
from typing import Protocol


class HistorySample(Protocol):
    timestamp: datetime
    value: float


class HistoryRepository(Protocol):
    """Mirrors the shape js/engine/history-engine.js already established on
    the frontend (timestamped samples, capped rolling buffers) — a future
    implementation should keep the same `{timestamp, value}` shape so the
    frontend's history rendering doesn't need to change when it starts
    reading from here instead of local buffers."""

    async def append(self, entity_id: str, metric: str, value: float) -> None: ...

    async def query(self, entity_id: str, metric: str, *, since: datetime | None = None, limit: int = 100) -> list[HistorySample]: ...
