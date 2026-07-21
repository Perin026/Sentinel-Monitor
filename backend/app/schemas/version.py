from __future__ import annotations

from pydantic import BaseModel


class VersionResponse(BaseModel):
    app_name: str
    app_version: str
    api_version: str
    environment: str
