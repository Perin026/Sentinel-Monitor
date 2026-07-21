"""Wraps SchedulerService for route/service consumers."""
from __future__ import annotations

from app.scheduler.scheduler import JobInfo, SchedulerService, scheduler_service


class TaskService:
    def __init__(self, scheduler: SchedulerService | None = None):
        self._scheduler = scheduler or scheduler_service

    def list_jobs(self) -> list[JobInfo]:
        return self._scheduler.list_jobs()
