"""
Plugin Manager — the single entry point for plugin lifecycle, mirroring
js/plugins/plugin-manager.js. Core code never imports a plugin module
directly; everything goes through here so lifecycle, isolation, and status
reporting stay centralized in one place.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.core.logging import get_logger
from app.plugins.base import Plugin, PluginContext
from app.plugins.registries import PluginRegistries, plugin_registries

logger = get_logger(__name__)

# Bumped when the plugin-facing API shape changes in a breaking way, mirroring
# the frontend's HLM.pluginManager.CORE_API_VERSION.
CORE_API_VERSION = "0.1.0"


class PluginStatus(StrEnum):
    LOADED = "loaded"
    ENABLED = "enabled"
    DISABLED = "disabled"
    FAILED = "failed"
    INCOMPATIBLE = "incompatible"
    MISSING_DEPENDENCY = "missing-dependency"


@dataclass
class PluginRecord:
    plugin: Plugin
    status: PluginStatus
    error: str | None = None
    ctx: PluginContext | None = None


def _parse_version(v: str) -> tuple[int, int, int]:
    parts = (v.split(".") + ["0", "0", "0"])[:3]
    return tuple(int(p) if p.isdigit() else 0 for p in parts)  # type: ignore[return-value]


def _version_satisfies(have: str, need: str) -> bool:
    """True if `have` is greater than or equal to `need`."""
    return _parse_version(have) >= _parse_version(need)


class PluginManager:
    def __init__(self, registries: PluginRegistries | None = None):
        self._registries = registries or plugin_registries
        self._plugins: dict[str, PluginRecord] = {}

    def register(self, plugin: Plugin) -> PluginRecord:
        """Registers and immediately loads+enables a plugin. Never raises —
        failures are captured in the returned record instead (isolation)."""
        manifest = plugin.manifest
        if manifest.id in self._plugins:
            record = PluginRecord(plugin=plugin, status=PluginStatus.FAILED, error=f'Plugin "{manifest.id}" is already registered')
            self._plugins[manifest.id] = record
            return record

        record = PluginRecord(plugin=plugin, status=PluginStatus.LOADED, ctx=PluginContext(manifest.id, self._registries))
        self._plugins[manifest.id] = record

        if not _version_satisfies(CORE_API_VERSION, manifest.min_core_version):
            record.status = PluginStatus.INCOMPATIBLE
            record.error = f"Requires core >= {manifest.min_core_version}, running {CORE_API_VERSION}"
            return record

        missing = self._missing_dependencies(manifest.dependencies)
        if missing:
            record.status = PluginStatus.MISSING_DEPENDENCY
            record.error = f"Missing dependencies: {', '.join(missing)}"
            return record

        self._run_isolated(record, lambda: plugin.setup(record.ctx))
        if record.status == PluginStatus.LOADED:
            record.status = PluginStatus.ENABLED
        return record

    def disable(self, plugin_id: str) -> bool:
        record = self._plugins.get(plugin_id)
        if record is None or record.status != PluginStatus.ENABLED:
            return False
        self._run_isolated(record, lambda: record.plugin.teardown(record.ctx))
        for registry in vars(self._registries).values():
            registry.unregister_all_by(plugin_id)
        if record.status != PluginStatus.FAILED:
            record.status = PluginStatus.DISABLED
        return True

    def enable(self, plugin_id: str) -> bool:
        record = self._plugins.get(plugin_id)
        if record is None or record.status != PluginStatus.DISABLED:
            return False
        self._run_isolated(record, lambda: record.plugin.setup(record.ctx))
        if record.status != PluginStatus.FAILED:
            record.status = PluginStatus.ENABLED
        return True

    def unload(self, plugin_id: str) -> bool:
        record = self._plugins.get(plugin_id)
        if record is None:
            return False
        if record.status == PluginStatus.ENABLED:
            self.disable(plugin_id)
        del self._plugins[plugin_id]
        return True

    def load_all(self, plugins: list[Plugin] | None = None) -> None:
        """Called once at application startup. Phase 5.1 ships no real
        plugins — an empty list is the correct, honest default."""
        for plugin in plugins or []:
            self.register(plugin)

    def unload_all(self) -> None:
        for plugin_id in list(self._plugins.keys()):
            self.unload(plugin_id)

    def get_status(self, plugin_id: str) -> PluginRecord | None:
        return self._plugins.get(plugin_id)

    def list(self) -> list[PluginRecord]:
        return list(self._plugins.values())

    def _missing_dependencies(self, dependencies: tuple[str, ...]) -> list[str]:
        return [dep for dep in dependencies if self._plugins.get(dep, None) is None or self._plugins[dep].status != PluginStatus.ENABLED]

    def _run_isolated(self, record: PluginRecord, fn) -> None:
        """Runs a plugin hook, catching any exception and recording it as a
        failure — never propagates, so one broken plugin cannot take down
        the server. Mirrors runIsolated() in plugin-manager.js."""
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 - intentional: isolate any plugin failure
            record.status = PluginStatus.FAILED
            record.error = str(exc)
            logger.error("plugin.lifecycle_error", plugin_id=record.plugin.manifest.id, error=str(exc), exc_info=exc)


plugin_manager = PluginManager()
