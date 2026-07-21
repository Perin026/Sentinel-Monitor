"""Wraps ConnectionManager for route/service consumers."""
from __future__ import annotations

from app.websocket.connection_manager import ConnectionManager, connection_manager


class WebSocketService:
    def __init__(self, connections: ConnectionManager | None = None):
        self._connections = connections or connection_manager

    async def broadcast(self, message: dict) -> int:
        return await self._connections.broadcast(message)

    @property
    def connection_count(self) -> int:
        return self._connections.connection_count
