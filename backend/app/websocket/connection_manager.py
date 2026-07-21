"""
Connection manager — tracks every live WebSocket client and is the only
thing in the app allowed to touch a raw `WebSocket` object. Nothing else
(services, routes) holds a socket reference directly; they call
`connection_manager.broadcast(...)` and don't need to know who, or how
many clients, are listening — the same "producer doesn't know about
consumers" separation `HLM.store` enforces on the frontend.

Phase 5.1 wires the transport (connect, disconnect, broadcast, heartbeat)
with no monitoring data flowing over it yet — that starts once a real
DataProvider-equivalent exists on the backend (later phase).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ConnectionInfo:
    connection_id: str
    websocket: WebSocket
    metadata: dict = field(default_factory=dict)


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, ConnectionInfo] = {}

    async def connect(self, websocket: WebSocket, *, metadata: dict | None = None) -> str:
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        self._connections[connection_id] = ConnectionInfo(connection_id, websocket, metadata or {})
        logger.info("websocket.connected", connection_id=connection_id, total=len(self._connections))
        return connection_id

    def disconnect(self, connection_id: str) -> None:
        if connection_id in self._connections:
            del self._connections[connection_id]
            logger.info("websocket.disconnected", connection_id=connection_id, total=len(self._connections))

    async def send_personal(self, connection_id: str, message: dict) -> bool:
        info = self._connections.get(connection_id)
        if info is None:
            return False
        try:
            await info.websocket.send_json(message)
            return True
        except Exception:  # noqa: BLE001 - a dead socket shouldn't break the caller
            self.disconnect(connection_id)
            return False

    async def broadcast(self, message: dict) -> int:
        """Sends to every connected client, gracefully dropping any that
        fail (client closed without a clean disconnect). Returns the
        number of clients the message actually reached."""
        delivered = 0
        for connection_id in list(self._connections.keys()):
            if await self.send_personal(connection_id, message):
                delivered += 1
        return delivered

    async def heartbeat_all(self) -> None:
        """Intended to be scheduled periodically (see scheduler/jobs.py and
        Settings.websocket_heartbeat_interval_seconds) so dead connections
        get pruned even if a client disappears without a close frame."""
        await self.broadcast({"type": "ping"})

    @property
    def connection_count(self) -> int:
        return len(self._connections)


connection_manager = ConnectionManager()
