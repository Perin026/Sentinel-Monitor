"""
WebSocket authentication hook.

A placeholder on purpose: Phase 5.1 builds the *seam* a real check will
plug into later (a token query param, a session cookie, ...), not the
check itself — there's no user/session model yet (see
services/authentication_service.py). Always permitting a connection today
is the honest behavior for a server with no accounts to authenticate
against; this function is what a future phase edits, not the call sites
that use it.
"""
from __future__ import annotations

from fastapi import WebSocket


async def authenticate_websocket(websocket: WebSocket) -> bool:
    """Return True to accept the connection. Called before `.accept()`."""
    return True
