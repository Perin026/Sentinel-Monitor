from __future__ import annotations

from httpx import AsyncClient


async def test_list_plugins_empty_by_default(client: AsyncClient) -> None:
    # Phase 5.1 ships the loading framework only — no real plugins register
    # themselves yet (see plugins/manager.py's load_all()).
    response = await client.get("/api/plugins")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_unknown_plugin_returns_404(client: AsyncClient) -> None:
    response = await client.get("/api/plugins/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error_code"] == "not_found"
