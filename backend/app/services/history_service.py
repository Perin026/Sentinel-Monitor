"""
Historical sensor data storage — deliberately unimplemented.

This is monitoring business logic (what Phase 5.1's brief explicitly
excludes), not architecture. The frontend already has an equivalent
concept (js/engine/history-engine.js's timestamped rolling buffers); this
class is the seam a future phase will implement against — likely backed
by SystemSetting-style tables or a time-series-oriented schema, added via
an Alembic migration once the shape is known. Raising rather than
returning an empty result is deliberate: an empty list would silently lie
about there being no history, versus honestly saying "not built yet."
"""
from __future__ import annotations


class HistoryNotImplementedError(NotImplementedError):
    pass


class HistoryService:
    async def get_history(self, entity_id: str, metric: str, *, since=None, limit: int = 100):
        raise HistoryNotImplementedError(
            "HistoryService is a Phase 5.1 architectural placeholder — no history storage exists yet."
        )
