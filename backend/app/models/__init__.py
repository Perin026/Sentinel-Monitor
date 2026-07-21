"""
SQLAlchemy ORM models.

Deliberately near-empty for Phase 5.1 — this phase builds the foundation
(engine, sessions, migrations, repository pattern), not the application's
actual tables. `system_setting.py` exists only because a generic
key/value settings store is foundation-level infrastructure itself (it
backs ConfigurationService's future persistence and /api/settings), not a
monitoring feature.

Every model module must be imported here so Alembic's autogenerate (see
migrations/env.py) sees the full metadata.
"""
from app.models.system_setting import SystemSetting

__all__ = ["SystemSetting"]
