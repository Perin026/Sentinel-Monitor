from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import PluginServiceDep
from app.core.exceptions import NotFoundError
from app.schemas.plugin import PluginResponse

router = APIRouter(prefix="/plugins", tags=["plugins"])


def _to_schema(record) -> PluginResponse:
    return PluginResponse(
        id=record.plugin.manifest.id,
        name=record.plugin.manifest.name,
        version=record.plugin.manifest.version,
        author=record.plugin.manifest.author,
        description=record.plugin.manifest.description,
        status=record.status.value,
        error=record.error,
    )


@router.get("", response_model=list[PluginResponse])
async def list_plugins(plugin_service: PluginServiceDep) -> list[PluginResponse]:
    return [_to_schema(record) for record in plugin_service.list_plugins()]


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin(plugin_id: str, plugin_service: PluginServiceDep) -> PluginResponse:
    record = plugin_service.get_plugin(plugin_id)
    if record is None:
        raise NotFoundError(f'Plugin "{plugin_id}" is not registered.')
    return _to_schema(record)
