"""
The `/api/dashboard` contract — the payload `ApiProvider`
(js/engine/data-provider.js) polls. Deliberately mirrors the shape
`SimulationProvider._toSnapshotDevice()` already produces on the frontend,
minus everything that's frontend plugin configuration (labels, units,
thresholds, icons, group) rather than backend-owned fact. See
`app/models/device.py`'s docstring and `docs/api-contract.md` for the full
reasoning.
"""
from __future__ import annotations

from pydantic import BaseModel


class DeviceSchema(BaseModel):
    id: str
    name: str
    type: str
    hostname: str
    ip: str
    status: str
    maintenance: bool
    booted_at: int  # epoch ms — see DashboardResponse.timestamp
    sensors: dict[str, float]

    model_config = {"from_attributes": True}


class DashboardResponse(BaseModel):
    devices: dict[str, DeviceSchema]
    timestamp: int  # epoch ms when the backend built this snapshot.
    # ApiProvider overwrites this with its own Date.now() on receipt
    # (avoids client/server clock-skew feeding into `lastTick` arithmetic)
    # — it's carried here for logging/latency-debugging, not correctness.
