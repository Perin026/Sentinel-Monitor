"""
Plugin manifest + base class — the backend mirror of the frontend's
`HLM.createPlugin({...})` manifest shape (js/plugins/sdk.js) and
`buildContext()` (js/plugins/plugin-manager.js).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.plugins.registries import PluginRegistries


@dataclass(frozen=True)
class PluginManifest:
    id: str
    name: str
    version: str
    author: str = "Unknown"
    license: str = "MIT"
    description: str = ""
    min_core_version: str = "0.1.0"
    dependencies: tuple[str, ...] = field(default_factory=tuple)


class PluginContext:
    """A plugin's only interface to the rest of the app — it never imports
    `PluginManager` or reaches into another plugin's internals directly.
    Every `register_*` call automatically attributes ownership to this
    plugin, which is what lets `disable()` clean up completely."""

    def __init__(self, plugin_id: str, registries: PluginRegistries):
        self.plugin_id = plugin_id
        self.registries = registries

    def register_collector(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.collectors.register(key, value, self.plugin_id, meta)

    def register_command(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.commands.register(key, value, self.plugin_id, meta)

    def register_notification_provider(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.notification_providers.register(key, value, self.plugin_id, meta)

    def register_router(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.routers.register(key, value, self.plugin_id, meta)

    def register_background_task(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.background_tasks.register(key, value, self.plugin_id, meta)

    def register_health_provider(self, key: str, value: object, meta: dict | None = None) -> None:
        self.registries.health_providers.register(key, value, self.plugin_id, meta)


class Plugin:
    """Base class for a backend plugin. Subclasses set `manifest` and
    implement `setup()`; `teardown()` is optional (default no-op) for
    plugins with nothing to release on disable."""

    manifest: PluginManifest

    def setup(self, ctx: PluginContext) -> None:
        raise NotImplementedError

    def teardown(self, ctx: PluginContext) -> None:
        return None
