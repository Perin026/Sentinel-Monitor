"""
Declarative base + shared mixins.

`Base` is the one declarative root every ORM model must inherit from — it's
what Alembic's autogenerate (see migrations/env.py) diffs against to build
migrations. `TimestampMixin` is the only cross-cutting concern common
enough to bake in here; anything domain-specific belongs on the model
itself, not on this shared base.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Root of every ORM model. No columns of its own."""


class TimestampMixin:
    """`created_at`/`updated_at`, defaulted and maintained by the database
    itself — not application code, so they stay correct regardless of which
    code path writes the row."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
