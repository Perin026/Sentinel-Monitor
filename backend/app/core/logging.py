"""
Structured logging — every log line is a structured event (key=value
pairs), not a free-text sentence, so logs stay machine-parseable once this
runs anywhere that isn't a developer's terminal (a container's stdout
shipped to a log aggregator, for instance).

`log_format: console` renders human-friendly, colorized output for local
development; `log_format: json` renders one JSON object per line for
staging/production. Both share the same event data — only the renderer
changes, controlled entirely by Settings.
"""
from __future__ import annotations

import logging
import sys

import structlog

from app.config.settings import Settings


def configure_logging(settings: Settings) -> None:
    """Call once, during application startup, before any other module logs."""
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=settings.log_level.upper(),
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    renderer: structlog.types.Processor
    if settings.log_format == "json":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*shared_processors, structlog.processors.format_exc_info, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Thin, discoverable wrapper — callers do `get_logger(__name__)`, never
    touch structlog directly, so the logging backend can change in one file."""
    return structlog.get_logger(name)
