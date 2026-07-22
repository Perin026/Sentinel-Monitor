<div align="center">

# Sentinel Core Server

**The backend foundation for Sentinel Monitor.** A FastAPI service designed
to run independently of any one client — the web dashboard is a consumer
of this API, not part of it. A future desktop app, mobile app, or CLI
could talk to the same endpoints without this server knowing they exist.

</div>

---

## Status

**Phase 5.1 — architectural foundation.** This is the backend equivalent
of the frontend's Phase 1: application shell, configuration, database
layer, plugin bootstrap, API skeleton, WebSocket transport, and scheduler
— all real and running, none of it wired to actual monitoring data yet.
See [`../PROJECT_STATE.md`](../PROJECT_STATE.md) for the full picture and
[`../docs/architecture.md`](../docs/architecture.md#sentinel-core-server-phase-51)
for the design rationale.

## Quick start (local, no Docker)

Requires Python 3.12+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS/Linux

pip install -r requirements.txt
cp .env.example .env               # adjust if needed — defaults work as-is

python main.py                     # http://localhost:8000, auto-reloads
```

Then visit:
- **http://localhost:8000/docs** — Swagger UI
- **http://localhost:8000/redoc** — ReDoc
- **http://localhost:8000/health** — liveness probe
- **http://localhost:8000/api/health** — readiness (database, scheduler, websocket, plugins)

## Quick start (Docker)

```bash
cd backend
docker compose up --build
```

Same endpoints, at the same `localhost:8000`. Data persists in a named
volume (`sentinel-data`) between restarts. See `docker-compose.yml` for
how to switch from the default SQLite to PostgreSQL later — the app code
doesn't change, only `SENTINEL_DATABASE_URL`.

## Running tests

```bash
python -m pytest -v
```

Every test gets its own in-memory SQLite database (see `tests/conftest.py`)
— fast, isolated, no shared state between test runs.

## Database migrations

```bash
# after changing a model in app/models/
python -m alembic revision --autogenerate -m "describe the change"
python -m alembic upgrade head
```

## Project structure

```
backend/
├── app/
│   ├── api/            Routers + dependency-injection providers
│   ├── authentication/ Auth backend contract (no implementation yet)
│   ├── collectors/     Per-metric collector interface (mirrors the frontend's Sensor Provider)
│   ├── config/         Settings: env vars + .env + YAML/JSON + defaults
│   ├── core/           App factory, logging, middleware, exception handlers
│   ├── database/       Async engine/session, Base model, repository pattern
│   ├── history/        Historical-data storage interface (no implementation yet)
│   ├── models/         SQLAlchemy ORM models
│   ├── notifications/  Notification provider interface (no implementation yet)
│   ├── plugins/        Registry + Plugin Manager (mirrors js/plugins/)
│   ├── providers/      Whole-data-source interface (mirrors the frontend's DataProvider)
│   ├── scheduler/      Pluggable background-job framework
│   ├── schemas/        Pydantic request/response contracts
│   ├── services/       The layer routes depend on, not infrastructure directly
│   ├── utils/          Small shared helpers
│   └── websocket/      Connection manager, heartbeat, auth hook
├── config/              Checked-in config.yaml (+ git-ignored *.local.yaml overrides)
├── migrations/           Alembic
├── tests/
├── main.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Why this shape

Every folder above has exactly one job, and the dependency direction only
ever points one way: routes depend on services, services depend on
infrastructure (database/scheduler/websocket/plugins), never the reverse.
This is the same layering discipline the frontend's
[`docs/architecture.md`](../docs/architecture.md) already established —
UI depends on the store, the store doesn't know the UI exists; here, a
route depends on a service, a service doesn't know which route called it.

Two extension points are deliberate mirrors of the frontend's plugin
system (`js/plugins/`): a generic `Registry` (not a bespoke class per
extension point) and a `PluginManager` that isolates a failing plugin's
`setup()` so it can't take the whole server down — see
`app/plugins/registry.py` and `app/plugins/manager.py`.

## What's real vs. a documented seam

| Real today | Seam for a later phase |
|---|---|
| App factory, DI, middleware, structured logging, global exception handling | Real plugins (collectors, notification providers) — `app/plugins/manager.py`'s `load_all()` loads none by default |
| Config system (env/`.env`/YAML/JSON/defaults, validated) | Authentication — `app/services/authentication_service.py` raises `NotImplementedError` on purpose |
| Async SQLAlchemy engine, sessions, repository pattern, Alembic migrations | Historical data storage — `app/services/history_service.py` raises `NotImplementedError` on purpose |
| `/api/system` (real self-monitoring — process CPU/memory via `psutil`, uptime, live DB/scheduler status), `/api/health`, `/api/version`, `/api/plugins`, `/api/settings` | Monitoring data over WebSocket — the transport exists (`app/websocket/`), nothing streams over it yet |
| `/api/dashboard` — the snapshot the frontend's `ApiProvider` polls (Phase 5.2). Serves a few **synthetic** demo devices whose values drift slightly per read | Real collectors feeding `/api/dashboard` — `app/collectors/base.py` is the contract, no implementations ship; the demo devices are placeholders, not real hosts |
| WebSocket connect/disconnect/broadcast/heartbeat | Authentication on any endpoint — `app/websocket/auth.py` / `authentication_service.py` are seams |
| APScheduler-backed job framework | Actual scheduled jobs — `app/scheduler/jobs.py`'s `register_jobs()` registers none by default |

Raising `NotImplementedError` rather than silently returning empty data
is deliberate throughout: an empty result would quietly lie about there
being nothing to report, versus honestly saying "not built yet."
