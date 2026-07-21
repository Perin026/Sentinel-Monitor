"""
Database initialization.

In development, `create_all` is convenient — no need to hand-write a
migration for every schema tweak while the schema is still churning. In
staging/production this is skipped entirely (see the environment guard
below): Alembic migrations (migrations/) are the only supported path once
real data exists, because `create_all` cannot alter existing tables and
gives no history of *how* the schema got to its current shape.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine

from app.config.settings import Settings, get_settings
from app.core.logging import get_logger
from app.database.base import Base
from app.database.session import get_engine

logger = get_logger(__name__)


async def init_db(settings: Settings | None = None, engine: AsyncEngine | None = None) -> None:
    settings = settings or get_settings()
    engine = engine or get_engine()

    if settings.is_production:
        logger.info("database.init_skipped", reason="production uses Alembic migrations, not create_all")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database.init_complete", tables=list(Base.metadata.tables.keys()))
