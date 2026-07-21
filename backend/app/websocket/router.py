"""The single `/ws` endpoint — thin by design. All real behavior lives in
ConnectionManager; this just wires the FastAPI protocol handshake to it."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.websocket.auth import authenticate_websocket
from app.websocket.connection_manager import connection_manager

logger = get_logger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    if not await authenticate_websocket(websocket):
        await websocket.close(code=4401)  # 4401: unauthorized (application-defined close code)
        return

    connection_id = await connection_manager.connect(websocket)
    try:
        while True:
            # No inbound message types are handled yet (Phase 5.1 is
            # transport-only) — receiving is only what keeps the connection
            # alive and lets us detect a client-initiated disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - never let one bad frame crash the server
        logger.warning("websocket.error", connection_id=connection_id, error=str(exc))
    finally:
        connection_manager.disconnect(connection_id)
