"""Wraps `get_logger` for the rare case a class-based service (rather than
a module-level `logger = get_logger(__name__)`) needs a logger via DI."""
from __future__ import annotations

import structlog

from app.core.logging import get_logger


class LoggingService:
    def get_logger(self, name: str) -> structlog.stdlib.BoundLogger:
        return get_logger(name)
