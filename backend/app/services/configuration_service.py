"""Wraps Settings so routes/services depend on ConfigurationService, not
`app.config.settings.get_settings` directly — the same indirection every
other service in this package follows."""
from __future__ import annotations

from app.config.settings import Settings, get_settings


class ConfigurationService:
    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()

    @property
    def settings(self) -> Settings:
        return self._settings

    def as_public_dict(self) -> dict:
        """Settings with the secret fields stripped — safe to expose via
        /api/settings (see api/routes/settings.py)."""
        data = self._settings.model_dump()
        data.pop("secret_key", None)
        return data
