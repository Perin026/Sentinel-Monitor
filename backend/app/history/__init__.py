"""Historical data storage interface. HistoryService (services/) is the
seam; `HistoryRepository` documents the contract a real time-series-backed
implementation will satisfy once the storage shape is decided."""
from app.history.base import HistoryRepository

__all__ = ["HistoryRepository"]
