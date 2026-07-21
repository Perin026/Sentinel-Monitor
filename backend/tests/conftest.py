"""
Shared fixtures.

Each test gets its own in-memory SQLite database (fast, isolated, no
leftover state between tests) via a `get_session` dependency override —
the exact mechanism api/deps.py's docstring describes. The app's real
lifespan (which starts the scheduler and loads plugins) is deliberately
not run here: these are route-level smoke tests, not integration tests
of startup/shutdown, so keeping fixtures fast and dependency-light beats
wiring up a full ASGI lifespan for tests that don't need it.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.application import create_app
from app.database.base import Base
from app.database.session import get_session

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
def app(test_session: AsyncSession) -> FastAPI:
    application = create_app()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield test_session

    application.dependency_overrides[get_session] = override_get_session
    return application


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
