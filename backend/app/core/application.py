"""
Application factory — the only place a `FastAPI()` instance is
constructed. `create_app()` returns a fully wired app; `main.py` and
`tests/conftest.py` are the only two callers, so app construction stays
identical between "run for real" and "run under pytest" except for
whatever Settings a test overrides.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config.settings import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import register_middleware
from app.database.init_db import init_db
from app.database.session import dispose_engine, init_engine
from app.plugins.manager import plugin_manager
from app.scheduler.jobs import register_jobs
from app.scheduler.scheduler import scheduler_service
from app.websocket.router import router as websocket_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings)
    logger.info("startup.begin", app=settings.app_name, version=settings.app_version, environment=settings.environment)

    init_engine(settings)
    await init_db(settings)

    plugin_manager.load_all()  # no plugins ship yet — see plugins/manager.py

    if settings.scheduler_enabled:
        register_jobs(scheduler_service)
        scheduler_service.start()

    logger.info("startup.complete")
    yield

    logger.info("shutdown.begin")
    scheduler_service.stop()
    plugin_manager.unload_all()
    await dispose_engine()
    logger.info("shutdown.complete")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Sentinel Core Server — the backend foundation for Sentinel Monitor. "
            "Designed to run independently of any one client: the web dashboard, "
            "a future desktop app, mobile app, or CLI all consume the same API."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_middleware(app)
    register_exception_handlers(app)

    app.include_router(api_router)
    app.include_router(websocket_router)

    @app.get("/", tags=["root"])
    async def root() -> dict:
        return {"name": settings.app_name, "version": settings.app_version, "docs": "/docs"}

    @app.get("/health", tags=["root"])
    async def liveness() -> dict:
        """Pure liveness probe — always `ok` if the process can respond at
        all, with no dependency checks. See /api/health for a readiness
        check that verifies the database, scheduler, and plugins."""
        return {"status": "ok"}

    return app
