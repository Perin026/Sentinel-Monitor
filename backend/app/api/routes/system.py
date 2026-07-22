from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ConfigurationServiceDep, DatabaseServiceDep, PluginServiceDep, WebSocketServiceDep
from app.core.runtime import get_process_cpu_percent, get_process_memory_percent, get_uptime_seconds
from app.plugins.registries import plugin_registries
from app.scheduler.scheduler import scheduler_service
from app.schemas.system import SystemInfoResponse

router = APIRouter(prefix="/system", tags=["system"])


@router.get("", response_model=SystemInfoResponse)
async def get_system_info(
    config_service: ConfigurationServiceDep,
    plugin_service: PluginServiceDep,
    websocket_service: WebSocketServiceDep,
    database_service: DatabaseServiceDep,
) -> SystemInfoResponse:
    settings = config_service.settings
    return SystemInfoResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        environment=settings.environment,
        cpu_percent=get_process_cpu_percent(),
        memory_percent=get_process_memory_percent(),
        uptime_seconds=get_uptime_seconds(),
        database_healthy=await database_service.health_check(),
        scheduler_running=scheduler_service.is_running,
        plugins_loaded=len(plugin_service.list_plugins()),
        collector_count=len(plugin_registries.collectors.list()),
        connected_websocket_clients=websocket_service.connection_count,
    )
