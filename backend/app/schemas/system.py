from __future__ import annotations

from pydantic import BaseModel


class SystemInfoResponse(BaseModel):
    """Placeholder system information — Phase 5.1 is architecture only, so
    every field here is either static or trivially derivable, not the
    result of a real collector (that's a later phase)."""

    app_name: str
    app_version: str
    environment: str
    scheduler_running: bool
    active_websocket_connections: int
    plugins_loaded: int
