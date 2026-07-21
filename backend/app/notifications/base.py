from __future__ import annotations

from typing import Protocol

from app.services.notification_service import Notification


class NotificationProvider(Protocol):
    """Anything registered via `ctx.register_notification_provider()` must
    implement this. A `Protocol`, not an ABC — structural typing matches
    the frontend's duck-typed `{ send(notification) }` provider shape more
    closely than requiring explicit inheritance."""

    async def send(self, notification: Notification) -> None: ...
