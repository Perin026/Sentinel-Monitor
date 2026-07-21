"""Wraps PluginManager for route/service consumers (see api/routes/plugins.py)."""
from __future__ import annotations

from app.plugins.manager import PluginManager, PluginRecord, plugin_manager


class PluginService:
    def __init__(self, manager: PluginManager | None = None):
        self._manager = manager or plugin_manager

    def list_plugins(self) -> list[PluginRecord]:
        return self._manager.list()

    def get_plugin(self, plugin_id: str) -> PluginRecord | None:
        return self._manager.get_status(plugin_id)

    def enable(self, plugin_id: str) -> bool:
        return self._manager.enable(plugin_id)

    def disable(self, plugin_id: str) -> bool:
        return self._manager.disable(plugin_id)
