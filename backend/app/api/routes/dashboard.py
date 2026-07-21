from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DashboardServiceDep
from app.schemas.dashboard import DashboardResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(dashboard_service: DashboardServiceDep) -> DashboardResponse:
    """The payload `ApiProvider` (js/engine/data-provider.js) polls. See
    docs/api-contract.md for the full contract and
    app/services/dashboard_service.py for why the data is synthetic
    demo values rather than real collector output in this phase."""
    return await dashboard_service.get_snapshot()
