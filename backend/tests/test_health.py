"""
Note: the `client` fixture's app never runs the real startup lifespan (see
conftest.py), so the scheduler component reports not-running here — that's
expected in this lightweight test context, not a bug. These tests assert
the endpoint's *shape* and that the database check (which does run,
against the real test session) is healthy.
"""
from __future__ import annotations

from httpx import AsyncClient


async def test_root_liveness(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_api_health_shape(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    body = response.json()
    assert response.status_code in (200, 503)
    assert "healthy" in body
    assert {c["name"] for c in body["components"]} == {"database", "scheduler", "websocket", "plugins"}


async def test_api_health_database_component_is_healthy(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    body = response.json()
    db_component = next(c for c in body["components"] if c["name"] == "database")
    assert db_component["healthy"] is True
