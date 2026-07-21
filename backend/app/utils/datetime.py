"""UTC-aware datetime helpers. Never use naive `datetime.utcnow()` /
`datetime.now()` elsewhere in this codebase — every timestamp the server
produces should carry explicit timezone info."""
from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
