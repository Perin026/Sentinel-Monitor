from __future__ import annotations

from httpx import AsyncClient


async def test_system_info(client: AsyncClient) -> None:
    response = await client.get("/api/system")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "Sentinel Core Server"
    assert body["plugins_loaded"] == 0


async def test_settings_endpoint_hides_secret_key(client: AsyncClient) -> None:
    response = await client.get("/api/settings")
    assert response.status_code == 200
    assert "secret_key" not in response.json()["values"]
