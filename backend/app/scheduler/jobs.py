"""
Job registration — called once at startup (see core/application.py's
lifespan). Deliberately empty for Phase 5.1: the scheduler framework is
architecture, real jobs (collector polling, retention sweeps, ...) are
later-phase business logic. A future job registers itself here, e.g.:

    async def sweep_expired_sessions() -> None:
        ...

    def register_jobs(scheduler: SchedulerService) -> None:
        scheduler.add_interval_job("sweep-expired-sessions", sweep_expired_sessions, seconds=3600)
"""
from __future__ import annotations

from app.scheduler.scheduler import SchedulerService


def register_jobs(scheduler: SchedulerService) -> None:
    """No jobs yet — intentionally a no-op. See module docstring."""
    return None
