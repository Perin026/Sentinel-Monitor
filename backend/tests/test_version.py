from __future__ import annotations

from httpx import AsyncClient


async def test_version_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/version")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "Sentinel Core Server"
    assert {"app_version", "api_version", "environment"} <= body.keys()


async def test_root_endpoint(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"
