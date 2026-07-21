"""
Device — deliberately minimal.

Stores only what the *backend* can honestly know: identity (id/name/type/
hostname/ip), reachability (status/maintenance/booted_at), and raw sensor
values. It does NOT store labels, units, warn/critical thresholds, icons,
or which nav group a device belongs to — that's frontend plugin
configuration (`HLM.registries.deviceTypes`, see
js/plugins/builtin/core-devices.js), and duplicating it here would let the
two sides drift out of sync. The frontend's `hydrateFromSnapshot()`
(js/engine/device-model.js) is what merges this raw record with the
plugin's type definition into a fully-presentable device — the same
merge `hydrateDevice()` already does for `config.js`'s static seed list.

`sensors` is a flat `{key: value}` JSON map rather than a normalized
table on purpose — Phase 5.1's guidance was "don't create every
application table yet," and a proper time-series sensor table is Phase 7
(Historical Analytics) territory, not this phase's job.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Device(TimestampMixin, Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    maintenance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    booted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    sensors: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
