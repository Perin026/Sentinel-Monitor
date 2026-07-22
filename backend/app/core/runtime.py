"""
Process runtime state — start time (for uptime) and a warmed-up psutil
Process handle (for self-monitoring CPU%). Kept separate from
application.py's lifespan itself so anything can read it without
importing the app factory (which would risk a circular import from a
route module).

`psutil.Process.cpu_percent()` returns 0.0 on its first-ever call — it
reports the delta *since the last call*, and there is no "since" yet.
`mark_started()` makes one throwaway call during startup specifically so
every call a route handler makes afterward returns a real, meaningful
number instead of always reading 0.0.
"""
from __future__ import annotations

import os
import time

import psutil

_start_time: float | None = None
_process: psutil.Process | None = None


def mark_started() -> None:
    """Call once, at the start of the lifespan. Idempotent — a second call
    (e.g. a test re-entering startup) doesn't reset the clock or re-warm
    the CPU-percent baseline."""
    global _start_time, _process
    if _start_time is None:
        _start_time = time.monotonic()
    if _process is None:
        _process = psutil.Process(os.getpid())
        _process.cpu_percent(interval=None)  # warm-up call — see module docstring


def get_uptime_seconds() -> float:
    if _start_time is None:
        return 0.0
    return time.monotonic() - _start_time


def get_process_cpu_percent() -> float:
    if _process is None:
        return 0.0
    return _process.cpu_percent(interval=None)


def get_process_memory_percent() -> float:
    if _process is None:
        return 0.0
    return _process.memory_percent()
