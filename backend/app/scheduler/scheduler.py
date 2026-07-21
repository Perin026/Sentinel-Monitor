"""
Scheduler service — a thin, typed wrapper around APScheduler's
AsyncIOScheduler. Jobs are pluggable: anything (a future plugin's
background task, a retention sweep, a health poll) registers itself via
`add_interval_job()` instead of the scheduler knowing what any job does,
matching the same "core knows nothing about specific work" principle the
plugin system and the frontend's HLM.registries.backgroundTasks follow.

Phase 5.1 ships the framework only — see jobs.py for the (currently empty)
list of jobs actually registered at startup.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.logging import get_logger

logger = get_logger(__name__)

JobFunc = Callable[[], Awaitable[None]]


@dataclass(frozen=True)
class JobInfo:
    id: str
    seconds: float
    next_run: str | None


class SchedulerService:
    def __init__(self):
        self._scheduler = AsyncIOScheduler()
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._scheduler.start()
        self._started = True
        logger.info("scheduler.started")

    def stop(self) -> None:
        if not self._started:
            return
        self._scheduler.shutdown(wait=False)
        self._started = False
        logger.info("scheduler.stopped")

    def add_interval_job(self, job_id: str, func: JobFunc, *, seconds: float) -> None:
        """Registers a coroutine to run every `seconds` seconds. Replaces any
        existing job with the same id, so re-registration is idempotent."""
        self._scheduler.add_job(
            func,
            trigger=IntervalTrigger(seconds=seconds),
            id=job_id,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info("scheduler.job_registered", job_id=job_id, interval_seconds=seconds)

    def remove_job(self, job_id: str) -> bool:
        try:
            self._scheduler.remove_job(job_id)
            return True
        except Exception:  # noqa: BLE001 - APScheduler raises JobLookupError; not worth importing for this
            return False

    def list_jobs(self) -> list[JobInfo]:
        jobs = []
        for job in self._scheduler.get_jobs():
            interval_seconds = job.trigger.interval.total_seconds() if isinstance(job.trigger, IntervalTrigger) else 0.0
            jobs.append(JobInfo(id=job.id, seconds=interval_seconds, next_run=str(job.next_run_time) if job.next_run_time else None))
        return jobs

    @property
    def is_running(self) -> bool:
        return self._started


scheduler_service = SchedulerService()
