from __future__ import annotations

from pydantic import BaseModel


class PluginResponse(BaseModel):
    id: str
    name: str
    version: str
    author: str
    description: str
    status: str
    error: str | None = None
