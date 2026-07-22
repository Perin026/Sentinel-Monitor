from __future__ import annotations

from pydantic import BaseModel


class SystemInfoResponse(BaseModel):
    """
    Self-monitoring — "Sentinel should monitor itself before monitoring
    anything else" (Phase 5.2). cpu_percent/memory_percent/uptime_seconds
    are real host/process metrics (via psutil); the rest are exact counts
    from the actual registries and services, not estimates.

    `collector_count` is always 0 right now — the collector registry
    exists (`app/collectors/`) but Phase 5.2 explicitly ships no real
    collectors. Reported honestly rather than omitted.
    """

    app_name: str
    app_version: str
    environment: str

    cpu_percent: float
    memory_percent: float
    uptime_seconds: float

    database_healthy: bool
    scheduler_running: bool
    plugins_loaded: int
    collector_count: int
    connected_websocket_clients: int
