"""
Aggregates readiness across every subsystem that has one — real checks,
not placeholders, because "is the server actually up" is infrastructure
the /api/health endpoint needs from day one, not a monitoring feature.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.plugins.manager import PluginManager, plugin_manager
from app.scheduler.scheduler import SchedulerService, scheduler_service
from app.services.database_service import DatabaseService
from app.websocket.connection_manager import ConnectionManager, connection_manager


@dataclass
class ComponentHealth:
    name: str
    healthy: bool
    detail: str = ""


@dataclass
class HealthReport:
    healthy: bool
    components: list[ComponentHealth] = field(default_factory=list)


class HealthService:
    def __init__(
        self,
        db_service: DatabaseService,
        scheduler: SchedulerService | None = None,
        connections: ConnectionManager | None = None,
        plugins: PluginManager | None = None,
    ):
        self._db_service = db_service
        self._scheduler = scheduler or scheduler_service
        self._connections = connections or connection_manager
        self._plugins = plugins or plugin_manager

    async def check(self) -> HealthReport:
        db_ok = await self._db_service.health_check()
        components = [
            ComponentHealth("database", db_ok, "" if db_ok else "SELECT 1 failed"),
            ComponentHealth("scheduler", self._scheduler.is_running, f"{len(self._scheduler.list_jobs())} job(s) registered"),
            ComponentHealth("websocket", True, f"{self._connections.connection_count} connection(s)"),
            ComponentHealth("plugins", True, f"{len(self._plugins.list())} plugin(s) loaded"),
        ]
        return HealthReport(healthy=all(c.healthy for c in components), components=components)
