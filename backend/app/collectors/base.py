from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class CollectorResult:
    value: float
    meta: dict[str, Any] = field(default_factory=dict)


class Collector(Protocol):
    """A future plugin implements this and registers it via
    `ctx.register_collector()`. Mirrors the frontend's sensor provider
    contract exactly (`poll(seed, sensor_def) -> {value, meta}`) so a
    collector's shape is already familiar to anyone who's written a
    frontend sensor provider."""

    async def poll(self, target: dict, config: dict) -> CollectorResult: ...
