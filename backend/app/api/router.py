"""
Aggregates every route module under one `/api` prefix. This is the only
place that assembles the API surface — `core/application.py` includes
this single router, nothing else, so adding an endpoint never means
touching the application factory.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import dashboard, health, plugins, settings, system, version

api_router = APIRouter(prefix="/api")
api_router.include_router(system.router)
api_router.include_router(health.router)
api_router.include_router(version.router)
api_router.include_router(plugins.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router)
