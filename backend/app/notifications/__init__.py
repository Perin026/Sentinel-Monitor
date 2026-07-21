"""Notification provider interface. NotificationService (services/) fans a
notification out to whatever implements NotificationProvider below —
mirrors the frontend's notificationProviders registry. No providers ship
yet; this is the contract a future plugin (Discord, ntfy, email, ...)
implements."""
from app.notifications.base import NotificationProvider

__all__ = ["NotificationProvider"]
