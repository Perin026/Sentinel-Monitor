# Project State

> **This is a living document**, updated at the end of every phase
> alongside `docs/roadmap.md` and `CLAUDE_CONTEXT.md` — see the
> [Future Development Policy](docs/roadmap.md#future-development-policy).
> If something here doesn't match the code, that's a documentation bug.

## Where things stand

**Current version:** `0.6.0-alpha`
**Last completed phase:** Phase 5.1 — Sentinel Core Server Foundation

A note on numbering, now twice-relevant: the roadmap drafted after
Phase 3.5 originally scoped its *next* phase as "Visualization Framework."
The Phase 4 actually executed was a different brief (a real, pollable
monitoring engine), reordering visualization to later. Then the brief
labeled "Phase 4.5" turned out to be a full visual QA pass, not the
visualization work either — so visualization is now Phase 4.6. Separately,
"Phase 5" was originally scoped as "FastAPI Backend" in full; what actually
shipped under that number is Phase 5.1, an architecture-only foundation —
real monitoring data flowing through the backend is later work (5.2+).
Both reorderings are legitimate (real data before charts of it; a stable
foundation before business logic on top of it), but it means phase numbers
in commit history don't always match what an early draft of the roadmap
called them. `docs/roadmap.md` reflects the numbering actually used.

## What's real vs. simulated right now (frontend)

Two devices in the fleet are genuinely live-polled (see
`js/core/config.js`'s `DEVICES`, entries with `monitored: true`):

| Device | What's real |
|---|---|
| `mc-public-demo` (Hypixel Network) | Player count, online status, MOTD, version — via the public `mcsrvstat.us` API, which speaks real Minecraft Server List Ping server-side |
| `http-demo` (GitHub Status) | HTTP response code/time against `www.githubstatus.com`, and a reachability/latency probe against Cloudflare's `1.1.1.1` |

Every other device in the fleet (the original 20 from Phase 3) is
unchanged and fully simulated. That's deliberate: `monitor` configs exist
on some shared device *types* now (e.g. `minecraft`'s `players` sensor),
but only an instance with `monitored: true` on its config seed actually
gets polled. See `CLAUDE_CONTEXT.md` for why that split exists.

CPU/RAM/Disk sensors are **never** real for any device, including the two
monitored ones — that would require an agent running on the target
machine (the `system` sensor provider exists for this, structurally
complete, but nothing ships an agent yet).

## What exists on the backend right now

`backend/` (Sentinel Core Server) is a real, running FastAPI service —
verified by actually booting it and hitting every endpoint, not just code
review (see "How Phase 5.1 was verified" below). It is **not** wired to
the frontend: `HLM.config.APP.dataProvider` still defaults to
`"simulation"`, and nothing on the frontend has changed. The backend and
frontend are two independently-runnable things right now, on purpose.

What's real: app factory, DI, structured logging, global exception
handling, CORS, the env/YAML/JSON config system, async SQLAlchemy +
Alembic migrations (verified end-to-end), a Plugin Manager + generic
Registry mirroring the frontend's, `/api/system`, `/api/health` (readiness
— db/scheduler/websocket/plugins), `/api/version`, `/api/plugins`,
`/api/settings`, root `/health` (liveness) and `/`, a WebSocket connection
manager with heartbeat and graceful disconnect (verified live), and an
APScheduler-backed job framework.

What's a documented seam, not a stub that quietly does nothing: real
collectors (`app/collectors/base.py`), real notification providers
(`app/notifications/base.py`), history storage
(`app/services/history_service.py`), and authentication
(`app/services/authentication_service.py`) all either have zero
implementations registered or raise `NotImplementedError` on purpose —
see `backend/README.md`'s "What's real vs. a documented seam" table.

## Phase 5.1 — what was built

- **FastAPI application factory** (`backend/app/core/application.py`):
  DI, request-id + request-logging middleware, `structlog`-based
  structured logging (console/JSON, switched by `Settings.log_format`),
  global exception handlers returning one consistent JSON error envelope,
  CORS with an explicit origin allowlist, lifespan-managed startup/
  shutdown, Swagger/ReDoc/OpenAPI.
- **Configuration system** (`app/config/`): a `pydantic-settings` `Settings`
  class layering env vars → `.env` → `config/*.local.yaml`/`.json`
  (git-ignored) → `config/*.yaml`/`.json` (checked in) → field defaults,
  via custom `YamlConfigSource`/`JsonConfigSource` sources. Verified live:
  `/api/settings` reflects values from `config/config.yaml`, not just
  defaults.
- **Database foundation** (`app/database/`): async engine/session
  management, `Base` + `TimestampMixin`, a generic `BaseRepository`
  (deliberately mirroring `js/plugins/registry.js`'s reasoning — one
  generic implementation, not one per model), and Alembic migrations.
  One real model, `SystemSetting` (a generic key/value store — chosen
  because it's infrastructure, not a monitoring feature), with a
  generated-and-applied migration proving the whole chain works.
- **Plugin bootstrap** (`app/plugins/`): `Registry` and `PluginManager`
  mirroring `js/plugins/registry.js`/`plugin-manager.js` almost exactly —
  same manifest shape, same isolate-on-failure guarantee via
  `_run_isolated()`. `load_all()` loads zero plugins by default; none
  exist yet.
- **API skeleton**: `/api/system`, `/api/health`, `/api/version`,
  `/api/plugins`, `/api/settings`, plus a root `/health` liveness probe
  kept deliberately separate from `/api/health`'s readiness check (a
  monitoring platform's own health check has to distinguish "the process
  can respond" from "its dependencies are actually healthy").
- **WebSocket foundation** (`app/websocket/`): `ConnectionManager`
  (connect/disconnect/broadcast/heartbeat), an auth hook seam
  (`websocket/auth.py`, always permits today — no accounts exist to check
  against). Verified live: connection count correctly goes 1 → 0 across a
  real connect/disconnect.
- **Scheduler foundation** (`app/scheduler/`): a typed wrapper around
  APScheduler's `AsyncIOScheduler`; `jobs.py` registers zero jobs by
  default.
- Nine passing `pytest` tests (`backend/tests/`), each against its own
  in-memory SQLite database via a `get_session` dependency override.
- `backend/README.md`, `Dockerfile` (multi-stage, non-root, healthcheck),
  `docker-compose.yml` (SQLite by default, commented Postgres path),
  `.env.example`.

## How Phase 5.1 was verified

No Python was installed in the working environment at the start of this
phase. Rather than ship ~9,000 lines of backend code verified only by
reading it, Python 3.12 was installed (via `winget`, with explicit user
confirmation first — installing software is a system-level action, not a
project-local one) specifically to run it for real. That surfaced two
genuine bugs neither code review nor the test suite alone would have
caught:

1. The default SQLite path (`./data/sentinel.db`) failed with an opaque
   `unable to open database file` because nothing created the `data/`
   directory first. Fixed in `app/database/session.py`.
2. Alembic's `migrations/env.py` builds its own engine rather than going
   through `app/database/session.py`, so it hit the identical bug
   independently and needed the same fix applied there too.

After both fixes: `pytest` (9/9 passing), the server actually booting
(`python main.py`) and every `/api/*` endpoint responding correctly, a
live WebSocket connection with correct connect/disconnect tracking, and a
full Alembic round-trip (`revision --autogenerate` → `upgrade head` →
real `system_settings` table confirmed in the SQLite file) were all
exercised directly, not inferred. Docker itself was **not** available in
this environment, so the `Dockerfile`/`docker-compose.yml` are carefully
written and reviewed but not build-verified — flagged honestly rather
than claimed as tested.

## Known limitations (honesty over polish)

- The backend is not wired to the frontend. This is the single biggest
  remaining gap and the natural next phase (5.2).
- Real monitoring (frontend) is opt-in per device instance and currently
  only configured for two demo devices; no UI exists yet for a user to
  mark their own device `monitored: true` without editing `config.js`
  directly.
- `system` sensor provider (frontend) and any future backend collector
  both need an agent to talk to; none ships yet.
- No graphing UI consumes the frontend's timestamped history buffers yet
  (Phase 4.6).
- Backend `Dockerfile`/`docker-compose.yml` are unverified — no Docker
  in the environment they were built in (see above).
- Backend has no real plugins, collectors, notification providers,
  authentication, or history storage — all documented seams, Phase 5.2+
  territory.

## Immediate next phase

See `docs/roadmap.md` for the full list. Two reasonable candidates:
- **Phase 5.2**: wire the frontend's `ApiProvider`/`WebSocketProvider` to
  this backend, replacing simulated data with real data one config value
  at a time — the payoff this foundation was built for.
- **Phase 4.6**: charts/graphs against the frontend's timestamped history
  buffers, independent of backend work.
