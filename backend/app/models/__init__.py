"""
SQLAlchemy ORM models.

`system_setting.py` is generic key/value infrastructure (backs
ConfigurationService's future persistence and /api/settings). `device.py`
(Phase 5.2) is the first real domain model — deliberately minimal, see
its own docstring for what it intentionally does *not* store.

Every model module must be imported here so Alembic's autogenerate (see
migrations/env.py) sees the full metadata.
"""
from app.models.device import Device
from app.models.system_setting import SystemSetting

__all__ = ["Device", "SystemSetting"]
