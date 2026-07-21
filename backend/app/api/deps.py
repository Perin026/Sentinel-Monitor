"""
Dependency-injection providers — every route depends on a service through
one of these `Annotated` aliases, never by importing a singleton directly.
That indirection is what makes swapping a real dependency for a test
double (see tests/conftest.py) a FastAPI `dependency_overrides` entry
instead of monkeypatching an import.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import Settings, get_settings
from app.database.session import get_session
from app.services.authentication_service import AuthenticationService
from app.services.configuration_service import ConfigurationService
from app.services.database_service import DatabaseService
from app.services.health_service import HealthService
from app.services.notification_service import NotificationService
from app.services.plugin_service import PluginService
from app.services.task_service import TaskService
from app.services.websocket_service import WebSocketService

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_configuration_service(settings: SettingsDep) -> ConfigurationService:
    return ConfigurationService(settings)


def get_database_service(session: SessionDep) -> DatabaseService:
    return DatabaseService(session)


def get_health_service(db_service: Annotated[DatabaseService, Depends(get_database_service)]) -> HealthService:
    return HealthService(db_service)


def get_plugin_service() -> PluginService:
    return PluginService()


def get_task_service() -> TaskService:
    return TaskService()


def get_websocket_service() -> WebSocketService:
    return WebSocketService()


def get_notification_service() -> NotificationService:
    return NotificationService()


def get_authentication_service() -> AuthenticationService:
    return AuthenticationService()


ConfigurationServiceDep = Annotated[ConfigurationService, Depends(get_configuration_service)]
DatabaseServiceDep = Annotated[DatabaseService, Depends(get_database_service)]
HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
PluginServiceDep = Annotated[PluginService, Depends(get_plugin_service)]
TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]
WebSocketServiceDep = Annotated[WebSocketService, Depends(get_websocket_service)]
NotificationServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
AuthenticationServiceDep = Annotated[AuthenticationService, Depends(get_authentication_service)]
