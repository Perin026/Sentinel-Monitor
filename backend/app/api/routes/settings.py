from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ConfigurationServiceDep
from app.schemas.settings import SettingsResponse

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings_view(config_service: ConfigurationServiceDep) -> SettingsResponse:
    return SettingsResponse(values=config_service.as_public_dict())
