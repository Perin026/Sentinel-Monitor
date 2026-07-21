"""
Async engine + session management.

One process-wide engine (and its connection pool), created lazily from
Settings on first use and disposed explicitly on shutdown — not left for
garbage collection, which can leave pooled connections dangling during
tests or hot-reload. Route handlers never touch the engine directly; they
depend on `get_session` (see api/deps.py), which is what makes swapping
the engine out for a test database in `tests/conftest.py` a one-line
dependency override instead of a monkeypatch.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def ensure_sqlite_directory_exists(database_url: str) -> None:
    """SQLite (unlike Postgres) needs its parent directory to already exist
    — it won't create `./data/` on its own. A relative file path like the
    default `sqlite+aiosqlite:///./data/sentinel.db` would otherwise fail
    with an opaque `unable to open database file` on a fresh checkout.

    SQLAlchemy's sqlite URL convention uses slash count to mean relative vs.
    absolute (`sqlite:///rel/path` vs `sqlite:////abs/path`); urlsplit's
    `.path` always carries one extra leading "/" ahead of that, so strip
    exactly one to recover the real path — `lstrip("/")` would over-strip
    the absolute (4-slash) form down to a relative one.
    """
    if not database_url.startswith("sqlite"):
        return
    raw_path = urlsplit(database_url).path
    db_path = raw_path[1:] if raw_path.startswith("/") else raw_path
    if not db_path or db_path == ":memory:":
        return
    Path(db_path).resolve().parent.mkdir(parents=True, exist_ok=True)


def init_engine(settings: Settings | None = None) -> AsyncEngine:
    """Idempotent — safe to call more than once (tests routinely re-init
    with a different database_url between cases)."""
    global _engine, _session_factory
    settings = settings or get_settings()
    ensure_sqlite_directory_exists(settings.database_url)
    _engine = create_async_engine(settings.database_url, echo=settings.database_echo, future=True)
    _session_factory = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)
    logger.info("database.engine_initialized", url=_mask_credentials(settings.database_url))
    return _engine


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        logger.info("database.engine_disposed")
    _engine = None
    _session_factory = None


def get_engine() -> AsyncEngine:
    if _engine is None:
        return init_engine()
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        init_engine()
    assert _session_factory is not None
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — one session per request, always closed, rolled
    back on any unhandled exception so a failed request can't leave a
    half-committed transaction behind."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def _mask_credentials(url: str) -> str:
    """Never log a connection string's password, even at debug level."""
    if "@" not in url:
        return url
    scheme_and_creds, rest = url.rsplit("@", 1)
    scheme = scheme_and_creds.split("://", 1)[0]
    return f"{scheme}://***@{rest}"
