from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import HealthServiceDep
from app.schemas.health import ComponentHealthSchema, HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def get_health(health_service: HealthServiceDep, response: Response) -> HealthResponse:
    report = await health_service.check()
    # A monitoring platform's own health check has to be honest about its
    # own health — a 200 with `healthy: false` buried in the body is easy
    # for uptime tooling (and Docker's own HEALTHCHECK) to miss.
    response.status_code = status.HTTP_200_OK if report.healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        healthy=report.healthy,
        components=[ComponentHealthSchema(name=c.name, healthy=c.healthy, detail=c.detail) for c in report.components],
    )
