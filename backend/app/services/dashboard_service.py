"""
Dashboard service — serves the `/api/dashboard` snapshot `ApiProvider`
polls.

Phase 5.2 explicitly excludes real collectors (Docker/Proxmox/Minecraft/
Ollama/SNMP — later phases). With no collector writing real sensor
values yet, there is nothing honest to serve except: (a) an empty fleet,
or (b) a small set of clearly-synthetic demo devices whose values drift
slightly on each read, proving the full round trip (DB → API → frontend
hydration → Store → widgets) with *some* data flowing rather than an
empty response that can't actually prove the sensor `def`-merge path
works. This service does (b), using device types
(`linux`/`windows`/`nas`) that are generic frontend built-ins
(`js/plugins/builtin/core-devices.js`), not vendor-specific plugins —
nothing here is "Docker monitoring" or "Proxmox monitoring", it's
placeholder numbers shaped like what those generic types expect.

The random walk is intentionally tiny and self-contained — it is not a
collector, a scheduler job, or a simulation engine; see
`docs/api-contract.md` for why this is scoped the way it is.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.device import Device
from app.schemas.dashboard import DashboardResponse, DeviceSchema

logger = get_logger(__name__)

# id -> (name, type, hostname, ip, initial sensor values). Types match
# js/plugins/builtin/core-devices.js exactly so the frontend's existing
# plugin-registered thresholds/labels/icons apply with zero new frontend
# plugin code.
DEMO_DEVICES: dict[str, dict] = {
    "backend-demo-linux": {
        "name": "backend-demo-linux",
        "type": "linux",
        "hostname": "demo-linux.internal",
        "ip": "10.10.0.11",
        "sensors": {"cpu": 32.0, "ram": 48.0, "storage": 41.0, "temp": 52.0},
    },
    "backend-demo-windows": {
        "name": "backend-demo-windows",
        "type": "windows",
        "hostname": "demo-windows.internal",
        "ip": "10.10.0.12",
        "sensors": {"cpu": 27.0, "ram": 55.0, "storage": 63.0, "temp": 48.0},
    },
    "backend-demo-nas": {
        "name": "backend-demo-nas",
        "type": "nas",
        "hostname": "demo-nas.internal",
        "ip": "10.10.0.13",
        "sensors": {"cpu": 12.0, "ram": 30.0, "storage": 71.0, "temp": 39.0},
    },
}

_JITTER = 2.5  # max absolute change per sensor per read — deliberately small/slow


def _to_epoch_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def _ensure_seeded(self) -> None:
        result = await self._session.execute(select(Device.id))
        existing_ids = set(result.scalars().all())
        missing = set(DEMO_DEVICES) - existing_ids
        if not missing:
            return
        for device_id in missing:
            spec = DEMO_DEVICES[device_id]
            self._session.add(
                Device(
                    id=device_id,
                    name=spec["name"],
                    type=spec["type"],
                    hostname=spec["hostname"],
                    ip=spec["ip"],
                    status="ok",
                    maintenance=False,
                    sensors=dict(spec["sensors"]),
                )
            )
        await self._session.flush()
        logger.info("dashboard.seeded_demo_devices", count=len(missing))

    def _jitter_sensors(self, device: Device) -> None:
        updated = dict(device.sensors)
        for key, value in updated.items():
            delta = random.uniform(-_JITTER, _JITTER)
            updated[key] = round(max(0.0, min(100.0, value + delta)), 1)
        device.sensors = updated

    async def get_snapshot(self) -> DashboardResponse:
        await self._ensure_seeded()

        result = await self._session.execute(select(Device))
        devices = list(result.scalars().all())
        for device in devices:
            self._jitter_sensors(device)
        await self._session.flush()

        schemas = {
            device.id: DeviceSchema(
                id=device.id,
                name=device.name,
                type=device.type,
                hostname=device.hostname,
                ip=device.ip,
                status=device.status,
                maintenance=device.maintenance,
                booted_at=_to_epoch_ms(device.booted_at),
                sensors=device.sensors,
            )
            for device in devices
        }
        return DashboardResponse(devices=schemas, timestamp=_to_epoch_ms(datetime.now(timezone.utc)))
