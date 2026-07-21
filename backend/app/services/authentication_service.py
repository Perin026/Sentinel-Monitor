"""
Authentication — deliberately unimplemented.

No user/session/credential model exists yet (that's real business logic
for a later phase). This class, and the WebSocket auth hook it will
eventually back (see websocket/auth.py), are the seams that logic plugs
into. `is_configured` lets callers (and /api/health) distinguish "auth is
off because it isn't built yet" from "auth is broken."
"""
from __future__ import annotations


class AuthenticationService:
    is_configured: bool = False

    async def authenticate(self, credentials: dict) -> bool:
        raise NotImplementedError(
            "AuthenticationService is a Phase 5.1 architectural placeholder — no authentication exists yet."
        )
