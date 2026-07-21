"""
Fans a notification out to every registered notification provider —
mirrors js/plugins/services.js's NotificationService. Real, working
infrastructure with zero providers registered by default (no plugin ships
one yet); that's the honest state for this phase, not a stub.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.logging import get_logger
from app.plugins.registries import PluginRegistries, plugin_registries

logger = get_logger(__name__)


@dataclass(frozen=True)
class Notification:
    title: str
    message: str = ""
    level: str = "info"


class NotificationService:
    def __init__(self, registries: PluginRegistries | None = None):
        self._registries = registries or plugin_registries

    async def notify(self, notification: Notification) -> int:
        """Delivers to every registered provider, isolated so one failing
        provider can't block the others. Returns how many succeeded."""
        delivered = 0
        for provider_id, entry in self._registries.notification_providers.list():
            try:
                await entry.value.send(notification)
                delivered += 1
            except Exception as exc:  # noqa: BLE001 - one provider's failure must not affect others
                logger.error("notification.provider_failed", provider_id=provider_id, error=str(exc))
        return delivered
