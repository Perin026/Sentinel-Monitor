from __future__ import annotations

from typing import Protocol


class DataProvider(Protocol):
    """Lifecycle contract for a whole external data source — start it once,
    stop it on shutdown, ask it to refresh out-of-cycle. Mirrors the
    three-method shape of the frontend's `DataProvider` class
    (start/stop/refresh) so the same mental model applies on both sides."""

    async def start(self) -> None: ...

    async def stop(self) -> None: ...

    async def refresh(self) -> None: ...
