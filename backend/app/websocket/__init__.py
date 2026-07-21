"""WebSocket module — connection management and the live-update transport
future monitoring data will stream over. No monitoring data is streamed
yet (see connection_manager.py's module docstring)."""
from app.websocket.connection_manager import ConnectionManager, connection_manager

__all__ = ["ConnectionManager", "connection_manager"]
