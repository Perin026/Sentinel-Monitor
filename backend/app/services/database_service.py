"""Wraps database session/engine access. `health_check()` is real (a live
`SELECT 1`), because a database up/down signal is infrastructure, not the
kind of business logic this phase defers."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger(__name__)


class DatabaseService:
    def __init__(self, session: AsyncSession):
        self._session = session

    @property
    def session(self) -> AsyncSession:
        return self._session

    async def health_check(self) -> bool:
        try:
            await self._session.execute(text("SELECT 1"))
            return True
        except Exception as exc:  # noqa: BLE001 - health checks must never raise
            logger.warning("database.health_check_failed", error=str(exc))
            return False
