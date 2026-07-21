from __future__ import annotations

from typing import Protocol


class AuthBackend(Protocol):
    """The contract a future authentication backend (local accounts, OIDC/
    SSO, API keys for the future CLI) implements. AuthenticationService
    (services/) will delegate to whichever backend is configured once one
    exists — see its docstring for why none does yet."""

    async def authenticate(self, credentials: dict) -> bool: ...
