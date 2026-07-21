"""
Authentication primitives — empty on purpose.

No credential storage, token format, or session model has been designed
yet; inventing one now (Phase 5.1 is architecture, not features) would
mean redesigning it once real requirements (which client types need to
authenticate, SSO?, API keys for the future CLI?) are known. What exists
today is the seam: AuthenticationService (services/) and the WebSocket
auth hook (websocket/auth.py) are both already wired to call into this
package once it has something to call, and `AuthBackend` (base.py)
documents the contract a real backend will implement.
"""
from app.authentication.base import AuthBackend

__all__ = ["AuthBackend"]
