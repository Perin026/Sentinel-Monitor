"""
Data provider interface — the backend mirror of the frontend's
DataProvider (js/engine/data-provider.js). Where a Collector (collectors/)
polls one metric, a Provider is a whole external data *source* (a future
Prometheus/SNMP/vendor-API integration) that might feed many collectors
at once. Only the interface exists for Phase 5.1 — no providers ship yet.
"""
from app.providers.base import DataProvider

__all__ = ["DataProvider"]
