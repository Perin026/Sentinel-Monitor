"""
Custom pydantic-settings sources for YAML and JSON config files, so
Settings (see settings.py) can layer environment variables, a .env file,
and file-based config through one unified precedence chain instead of
hand-rolling a separate merge step.

Missing files are never an error — every layer in the chain is optional;
only field defaults are guaranteed to exist.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml
from pydantic.fields import FieldInfo
from pydantic_settings import PydanticBaseSettingsSource


class FileConfigSource(PydanticBaseSettingsSource):
    """Base for a settings source backed by a single structured file."""

    def __init__(self, settings_cls, path: Path):
        super().__init__(settings_cls)
        self._path = path
        self._data: dict[str, Any] = self._load() if path.exists() else {}

    def _load(self) -> dict[str, Any]:
        raise NotImplementedError

    def get_field_value(self, field: FieldInfo, field_name: str) -> tuple[Any, str, bool]:
        return self._data.get(field_name), field_name, False

    def __call__(self) -> dict[str, Any]:
        return dict(self._data)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"{type(self).__name__}(path={self._path!s}, loaded={bool(self._data)})"


class YamlConfigSource(FileConfigSource):
    def _load(self) -> dict[str, Any]:
        with self._path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}


class JsonConfigSource(FileConfigSource):
    def _load(self) -> dict[str, Any]:
        with self._path.open("r", encoding="utf-8") as fh:
            return json.load(fh) or {}
