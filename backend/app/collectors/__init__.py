"""
Collector interface — the backend mirror of the frontend's Sensor
Provider (js/plugins/builtin/core-monitoring.js's `{ poll(seed, sensorDef) }`
contract from Phase 4). A collector polls one metric on its own schedule;
nothing here decides *when* that happens (see scheduler/) or *what* a
metric means (that's monitoring business logic, out of scope for this
phase). Only the interface exists — no built-in collectors ship yet.
"""
from app.collectors.base import Collector, CollectorResult

__all__ = ["Collector", "CollectorResult"]
