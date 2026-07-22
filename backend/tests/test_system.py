from __future__ import annotations

from httpx import AsyncClient


async def test_system_info(client: AsyncClient) -> None:
    response = await client.get("/api/system")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "Sentinel Core Server"
    assert body["plugins_loaded"] == 0
    assert body["collector_count"] == 0
    assert body["database_healthy"] is True
    # The real lifespan (which warms up psutil, see core/runtime.py) never
    # runs in this fixture — see conftest.py — so these read their honest
    # "not started" defaults rather than a live measurement. That's the
    # correct thing to assert here, not a workaround.
    assert body["cpu_percent"] == 0.0
    assert body["uptime_seconds"] == 0.0
    assert body["memory_percent"] >= 0.0


async def test_settings_endpoint_hides_secret_key(client: AsyncClient) -> None:
    response = await client.get("/api/settings")
    assert response.status_code == 200
    assert "secret_key" not in response.json()["values"]
