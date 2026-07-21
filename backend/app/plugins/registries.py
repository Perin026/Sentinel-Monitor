"""
Instantiates every named registry — the backend mirror of
js/plugins/registries.js. Core code reads from these; plugins write to
them only through a PluginContext (see base.py), never directly.

Adding a new extension point later is a one-line addition here, same as
the frontend.
"""
from __future__ import annotations

from app.plugins.registry import Registry


class PluginRegistries:
    def __init__(self):
        self.collectors: Registry = Registry("collectors")
        self.commands: Registry = Registry("commands")
        self.notification_providers: Registry = Registry("notificationProviders")
        self.routers: Registry = Registry("routers")
        self.background_tasks: Registry = Registry("backgroundTasks")
        self.health_providers: Registry = Registry("healthProviders")


plugin_registries = PluginRegistries()
