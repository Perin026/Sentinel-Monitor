from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ConfigurationServiceDep, PluginServiceDep, WebSocketServiceDep
from app.scheduler.scheduler import scheduler_service
from app.schemas.system import SystemInfoResponse

router = APIRouter(prefix="/system", tags=["system"])


@router.get("", response_model=SystemInfoResponse)
async def get_system_info(
    config_service: ConfigurationServiceDep,
    plugin_service: PluginServiceDep,
    websocket_service: WebSocketServiceDep,
) -> SystemInfoResponse:
    settings = config_service.settings
    return SystemInfoResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        environment=settings.environment,
        scheduler_running=scheduler_service.is_running,
        active_websocket_connections=websocket_service.connection_count,
        plugins_loaded=len(plugin_service.list_plugins()),
    )
