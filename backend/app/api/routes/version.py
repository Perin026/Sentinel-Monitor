from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ConfigurationServiceDep
from app.plugins.manager import CORE_API_VERSION
from app.schemas.version import VersionResponse

router = APIRouter(prefix="/version", tags=["version"])


@router.get("", response_model=VersionResponse)
async def get_version(config_service: ConfigurationServiceDep) -> VersionResponse:
    settings = config_service.settings
    return VersionResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        api_version=CORE_API_VERSION,
        environment=settings.environment,
    )
