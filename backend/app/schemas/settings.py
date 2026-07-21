from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class SettingsResponse(BaseModel):
    """Public (secret-stripped) view of the running configuration — see
    ConfigurationService.as_public_dict()."""

    values: dict[str, Any]
