"""
Dashboard endpoint tests — this is the one route the frontend's
`ApiProvider` actually polls (see docs/api-contract.md), so its contract
matters more than any other: the shape asserted here is exactly what
`HLM.deviceModel.hydrateFromSnapshot()` on the frontend depends on.
"""
from __future__ import annotations

from httpx import AsyncClient

from app.services.dashboard_service import DEMO_DEVICES


async def test_dashboard_returns_contract_shape(client: AsyncClient) -> None:
    response = await client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()

    # The two top-level keys ApiProvider._hydrateSnapshot() requires.
    assert isinstance(body["devices"], dict)
    assert isinstance(body["timestamp"], int)

    # The demo fleet is seeded on first read, not pre-loaded.
    assert set(body["devices"]) == set(DEMO_DEVICES)


async def test_dashboard_device_shape_matches_hydrator(client: AsyncClient) -> None:
    body = (await client.get("/api/dashboard")).json()
    device = body["devices"]["backend-demo-linux"]

    # Exactly the fields hydrateFromSnapshot() reads — identity + raw
    # numbers, and deliberately NOT thresholds/units/labels (those are the
    # frontend plugin's job; see app/models/device.py's docstring).
    assert device["id"] == "backend-demo-linux"
    assert device["type"] == "linux"
    assert device["hostname"]
    assert device["ip"]
    assert device["status"] == "ok"
    assert device["maintenance"] is False
    assert isinstance(device["booted_at"], int)
    assert isinstance(device["sensors"], dict)
    assert all(isinstance(v, (int, float)) for v in device["sensors"].values())


async def test_dashboard_values_stay_in_range_and_drift(client: AsyncClient) -> None:
    # Each read applies a small random walk (dashboard_service._JITTER),
    # clamped to [0, 100]. Verify both properties across several reads.
    seen: set[float] = set()
    for _ in range(6):
        body = (await client.get("/api/dashboard")).json()
        cpu = body["devices"]["backend-demo-linux"]["sensors"]["cpu"]
        assert 0.0 <= cpu <= 100.0
        seen.add(cpu)
    # Six reads with a continuous random walk should not all land on the
    # same value — proves the snapshot is genuinely recomputed per request,
    # not cached.
    assert len(seen) > 1
