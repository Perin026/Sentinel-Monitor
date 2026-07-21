from __future__ import annotations

from pydantic import BaseModel


class ComponentHealthSchema(BaseModel):
    name: str
    healthy: bool
    detail: str = ""


class HealthResponse(BaseModel):
    healthy: bool
    components: list[ComponentHealthSchema]
