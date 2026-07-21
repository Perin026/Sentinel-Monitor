"""
Application exceptions + global handlers.

Every error response the API returns — expected or not — comes back as the
same JSON envelope (see schemas/common.py's ErrorResponse), so a client
never has to special-case "did this fail because of my request, or because
the server broke." Domain code should raise a SentinelError subclass;
anything else (a genuine bug) still gets caught by the unhandled-exception
handler and turned into a safe, generic 500 instead of leaking a traceback.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger
from app.schemas.common import ErrorResponse

logger = get_logger(__name__)


class SentinelError(Exception):
    """Base for every domain-specific error the application raises on purpose."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(SentinelError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "not_found"


class ConfigurationError(SentinelError):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "configuration_error"


class PluginError(SentinelError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "plugin_error"


def _envelope(request: Request, *, error_code: str, message: str, details: dict | None = None) -> ErrorResponse:
    return ErrorResponse(
        error_code=error_code,
        message=message,
        path=request.url.path,
        details=details or {},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SentinelError)
    async def handle_sentinel_error(request: Request, exc: SentinelError) -> JSONResponse:
        logger.warning("request.sentinel_error", error_code=exc.error_code, message=exc.message, path=request.url.path)
        body = _envelope(request, error_code=exc.error_code, message=exc.message, details=exc.details)
        return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.info("request.validation_error", errors=exc.errors(), path=request.url.path)
        body = _envelope(
            request,
            error_code="validation_error",
            message="Request validation failed.",
            details={"errors": exc.errors()},
        )
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=body.model_dump(mode="json"))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        body = _envelope(request, error_code="http_error", message=str(exc.detail))
        return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.error("request.unhandled_exception", error=str(exc), path=request.url.path, exc_info=exc)
        body = _envelope(request, error_code="internal_error", message="An unexpected error occurred.")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body.model_dump(mode="json"))
