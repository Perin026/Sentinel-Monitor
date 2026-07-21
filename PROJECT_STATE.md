# Project State

> **This is a living document**, updated at the end of every phase
> alongside `docs/roadmap.md` and `CLAUDE_CONTEXT.md` — see the
> [Future Development Policy](docs/roadmap.md#future-development-policy).
> If something here doesn't match the code, that's a documentation bug.

## Where things stand

**Current version:** `0.6.0-alpha` (unchanged — Phase 5.2 is still in progress; see `[Unreleased]` in `CHANGELOG.md`)
**Last completed milestone:** Phase 5.2, Milestone 5.2.1 — API contract, real `ApiProvider`, Store integration

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

## Phase 5.2, Milestone 5.2.1 — what was built

The frontend is no longer just *ready* for a real backend — it renders
one, through the exact same pipeline it always used. Verified live:
switching `HLM.config.APP.dataProvider` to `"api"` (still opt-in; default
stays `"simulation"`) makes real Sentinel Core Server data flow through
`hydrateFromSnapshot()` → `runPipeline()` → the Store → every widget,
with **zero changes** to `health-engine.js`, `alert-engine.js`,
`event-engine.js`, the Store itself, or any widget/component file. See
`docs/api-contract.md` for the wire contract and
`docs/architecture.md`'s "Frontend ↔ Backend Integration" section for the
mechanism.

Backend gained: a minimal `Device` model + migration, `DashboardService`
(seeds a few generic — not vendor-specific — demo devices and jitters
their values, enough to prove the round trip without a real collector),
`GET /api/dashboard`.

**Three real bugs found only by actually connecting the two sides, not
by review or the existing test suite:**
1. `app/database/session.py`'s `get_session()` never called
   `session.commit()` — every DB write since Phase 5.1 would have
   silently vanished. The existing tests never caught this because they
   override the session dependency entirely, bypassing it. Fixed:
   commit on clean return, rollback on exception.
2. `app.js`'s Overview and Settings widgets hardcoded
   `HLM.config.DEVICES.length` as the fleet size — correct by
   construction for `SimulationProvider` (impossible for that number to
   be wrong, since its device set *is* that array), silently wrong the
   instant `ApiProvider` reports a different count. Fixed to read live
   counts from the store.
3. `mountDeviceGroupView()` never removed a device card once its device
   disappeared from a snapshot — again invisible with
   `SimulationProvider`, whose fleet never shrinks at runtime. Verified
   the fix in both directions (switching to a smaller API fleet removes
   the extra cards; switching back to simulation correctly recreates
   them, not leaves them missing).

All three are exactly what "prove the architecture" (this phase's
explicit goal) is for — implicit assumptions that held by construction
under the only provider ever actually used, surfaced the moment a second
one was.

## Known limitations (honesty over polish)

- `ApiProvider` is opt-in, not the default — Milestone 5.2.2's automatic
  simulation fallback needs to exist first, or a backend outage would
  break the app for anyone defaulted to `"api"`.
- The backend's `/api/dashboard` data is synthetic demo values, not a
  real collector — explicitly out of scope for this phase (see
  `docs/api-contract.md`).
- Real monitoring (frontend, Phase 4) is opt-in per device instance and
  currently only configured for two demo devices; no UI exists yet for a
  user to mark their own device `monitored: true` without editing
  `config.js` directly.
- `system` sensor provider (frontend) and any future backend collector
  both need an agent to talk to; none ships yet.
- No graphing UI consumes the frontend's timestamped history buffers yet
  (Phase 4.6).
- Backend `Dockerfile`/`docker-compose.yml` are unverified — no Docker in
  the environment they were built in.
- Backend has no real plugins, collectors, notification providers,
  authentication, or history storage — all documented seams, later-phase
  territory.
- `WebSocketProvider` is untouched by this milestone — still
  structurally-complete-but-inert, matching the backend's `/ws` endpoint
  which is transport-only (Phase 5.1). Not this phase's scope either.

## Immediate next

**Milestone 5.2.2** (same phase): a Connection Manager (backend
availability, latency, heartbeat, connection quality — richer than
`ApiProvider`'s own per-poll retry), automatic simulation fallback when
the backend goes away, automatic reconnect when it returns, and backend
self-monitoring surfaced in the UI. Then **Milestone 5.2.3**: testing,
full documentation pass, final architecture review. See `docs/roadmap.md`
  buffers, independent of backend work.
