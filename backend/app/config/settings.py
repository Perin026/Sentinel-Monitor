"""
Settings — the single source of truth for configuration.

Precedence (highest wins first), matching standard 12-factor practice:
  1. Environment variables (SENTINEL_*)
  2. .env file (git-ignored, machine-specific)
  3. config/config.local.yaml / config.local.json (git-ignored overrides)
  4. config/config.yaml / config.json (checked in, environment defaults)
  5. Field defaults declared on this class

Secrets (secret_key, future API tokens, DB credentials) should only ever
come from environment variables or a real secrets manager in staging/
production — never from a checked-in config file. `.env.example` documents
every variable without holding real values.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

from app.config.loader import JsonConfigSource, YamlConfigSource

# backend/app/config/settings.py -> parents: config/ -> app/ -> backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_DIR = BACKEND_DIR / "config"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SENTINEL_",
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---------- Application ----------
    app_name: str = "Sentinel Core Server"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    # ---------- Server ----------
    host: str = "0.0.0.0"
    port: int = 8000

    # ---------- CORS ----------
    # The frontend is a client, not part of the server — every origin it
    # could be served from (dev server, static host, future desktop/mobile
    # wrapper) must be listed explicitly, never wildcarded in production.
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
    )

    # ---------- Database ----------
    database_url: str = "sqlite+aiosqlite:///./data/sentinel.db"
    database_echo: bool = False

    # ---------- Logging ----------
    log_level: str = "INFO"
    log_format: Literal["console", "json"] = "console"

    # ---------- Secrets ----------
    secret_key: str = "change-me-in-production"

    # ---------- Scheduler ----------
    scheduler_enabled: bool = True

    # ---------- WebSocket ----------
    websocket_heartbeat_interval_seconds: int = 30

    # ---------- Plugins ----------
    plugin_directories: list[str] = Field(default_factory=lambda: ["app/plugins/builtin"])

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Order = precedence, first source to return a value for a field wins.
        return (
            env_settings,
            dotenv_settings,
            YamlConfigSource(settings_cls, CONFIG_DIR / "config.local.yaml"),
            JsonConfigSource(settings_cls, CONFIG_DIR / "config.local.json"),
            YamlConfigSource(settings_cls, CONFIG_DIR / "config.yaml"),
            JsonConfigSource(settings_cls, CONFIG_DIR / "config.json"),
            init_settings,
            file_secret_settings,
        )


@lru_cache
def get_settings() -> Settings:
    """Process-wide cached singleton — Settings() only reads/validates once."""
    return Settings()
