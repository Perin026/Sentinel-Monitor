"""
HTTP middleware, registered once by the application factory.

Kept to two, deliberately: a request-id so any log line or error response
can be traced back to one HTTP call, and a request-log so every call is
observable without every route handler logging it manually. Anything
route-specific (auth, rate limiting) belongs in a dependency (see
api/deps.py), not here — middleware runs for *every* request, so it should
stay generic.
"""
from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger

logger = get_logger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER, str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            request_id=getattr(request.state, "request_id", None),
        )
        return response


def register_middleware(app: FastAPI) -> None:
    # Starlette applies middleware in reverse of add order, so RequestID
    # (added last) runs outermost and its id is available to the logger.
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestIDMiddleware)
