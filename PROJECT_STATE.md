# Project State

> **This is a living document**, updated at the end of every phase
> alongside `docs/roadmap.md` and `CLAUDE_CONTEXT.md` — see the
> [Future Development Policy](docs/roadmap.md#future-development-policy).
> If something here doesn't match the code, that's a documentation bug.

## Where things stand

**Current version:** `0.6.0-alpha` (unchanged — Phase 4.6 adds visualization on existing data, not a new feature surface worth a version bump yet; see `[Unreleased]` in `CHANGELOG.md`)
**Last completed milestone:** Phase 4.6, Milestone 4.6.2 — fleet composition + status views (squarified treemap, status matrix, sensor heatmap) on a new Analytics page. Phase 5.2 is complete; Phase 4.6 is in progress (4.6.3, the topology map, remains).

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
review (see "How Phase 5.1 was verified" below). As of Phase 5.2 it is now
**optionally** wired to the frontend: `HLM.config.APP.dataProvider` still
defaults to `"simulation"` (the frontend never *requires* the backend),
but setting it to `"api"` with `dataUrl` pointing at `/api/dashboard`
makes the frontend render real backend data through its unmodified
pipeline, with automatic fallback to simulation and automatic reconnect
if the backend goes away. The two remain independently-runnable — that
property is preserved, not abandoned.

What's real: app factory, DI, structured logging, global exception
handling, CORS, the env/YAML/JSON config system, async SQLAlchemy +
Alembic migrations (verified end-to-end), a Plugin Manager + generic
Registry mirroring the frontend's, `/api/dashboard` (the snapshot
`ApiProvider` polls — synthetic demo devices for now, real round trip),
`/api/system` (real self-monitoring — process CPU/memory via `psutil`,
uptime, live DB/scheduler status), `/api/health` (readiness —
db/scheduler/websocket/plugins), `/api/version`, `/api/plugins`,
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

## Phase 5.2, Milestone 5.2.2 — what was built

Verified live, not just reviewed: the backend process was killed
mid-session — the frontend fell back to simulation automatically (22
devices, `connection` → `"simulated"`). The backend was then restarted —
the frontend reconnected automatically (3 real devices, `connection` →
`"live"`, fresh latency measured). **Zero page reloads, either
direction.** This is the exact scenario the brief's Step 6 describes,
and it now genuinely works, not just structurally.

What made it possible: `js/engine/connection-manager.js`, a heartbeat
against `/health` that runs *only* while a fallback is active — the
piece that was missing, since the failing `ApiProvider` gets stopped the
moment fallback happens and nothing was left polling to notice a
recovery. `engine.js` now tracks "preferred" vs. "currently active"
provider separately so the internal fallback/recovery switches never
overwrite what was actually asked for.

Backend self-monitoring is real: `GET /api/system` now reports process
CPU%/memory% (`psutil`), uptime, live database health, scheduler status,
and exact plugin/collector/WebSocket-client counts — verified both via
`curl` (real non-zero values while the server was up) and via the new
`js/engine/backend-health.js`, which polls it **unconditionally**
(regardless of which `DataProvider` is active) and Settings' new
"Backend Health" widget renders. Settings' "Data Source" widget, which
was frozen at whatever it showed at boot time, is now genuinely live
too — provider, connection status, latency, and quality all update in
real time.

## Phase 5.2, Milestone 5.2.3 — what was built

The closing milestone: testing, documentation, and a whole-codebase
review. Three concrete outcomes, plus the doc pass:

- **A contract test for the one endpoint that matters.**
  `backend/tests/test_dashboard.py` — `/api/dashboard` (the only route
  `ApiProvider` actually polls) had no test despite being the whole point
  of the phase. It now asserts the exact shape `hydrateFromSnapshot()`
  depends on, that the demo fleet seeds on first read, and that values
  stay clamped to `[0,100]` while genuinely drifting per read. Suite is
  12 tests (was 9), `ruff` clean.
- **A real DRY fix the review surfaced.** `ApiProvider`,
  `connection-manager.js`, and `backend-health.js` had each re-implemented
  the same fetch-with-abort-timeout and the same "derive a sibling
  endpoint from the dashboard URL" logic — genuine triplication.
  Extracted both into `js/core/http.js` (`HLM.http.fetchWithTimeout` /
  `HLM.http.deriveEndpoint`), one implementation shared by all three.
  Deliberately *not* pushed into the two plugin fetchers
  (`minecraft-plugin.js`, `core-monitoring.js`): a plugin depends on the
  SDK surface, not core internals, so their self-contained fetch is the
  price of the isolation boundary, not an oversight.
- **A version-pin correction.** `requirements.txt` pinned
  `psutil>=6.0,<7.0`, but the whole integration was verified against
  7.2.2 — a fresh install would have pulled an untested 6.x. Widened to
  `>=6.0,<8.0`.

Re-verified live after the refactor: the full kill→fallback→restart→
reconnect cycle still works end-to-end (fell back to 22 simulated devices,
recovered to 3 live ones, heartbeat stopped itself on recovery, zero page
reloads), and the app boots with no console errors on the shared
`http.js`. The architectural claim the phase set out to prove holds:
`engine.js`, the health/alert/event engines, the Store, and every widget
are unchanged between simulated and real data — the only new code is the
adapter, the provider, and the resilience layer.

## Known limitations (honesty over polish)

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

## Phase 4.6, Milestone 4.6.1 — what was built

The charting foundation, and the first two things wired to it. Hand-rolled
SVG, no charting library, no engine changes — pure rendering on the
`{t,v}` history buffers the engine has produced since Phase 4.

- `js/components/chart.js` (new): `createSparkline()` (inline, axis-less,
  responsive via viewBox + `non-scaling-stroke`) and `createTimeChart()`
  (gridlines, y-labels, warn/critical threshold bands, area-filled line,
  hover crosshair + floating readout). Same `{el, update}` contract as
  `gauge.js`; both handle 0/1-point buffers gracefully.
- `css/components/chart.css` (new): color-by-status + fills, tokens only.
- `js/plugins/builtin/core-visualizations.js` (new): registers `sparkline`
  and `time-chart` through the same widget registry every widget uses.
- Wired: a sparkline in every sensor row of a device card's expanded
  detail (reads `sensor.history`), and a full-width "Fleet CPU Trend"
  time-chart on the Overview (keeps its own rolling buffer of the average
  it already computes each tick — a chart never gets authority over data
  it doesn't own).

Verified live (screenshots time out in this environment, so via measured
DOM geometry + computed styles, same as Milestone 5.2.3): both chart kinds
draw real, growing paths from the buffers; the time-chart's stroke is
genuinely `--status-ok` green and carries warn bands + gridlines; a
device-card sparkline renders 186×26 with the right token colors; the
whole thing scales from 956px (desktop) to 304px (mobile) with zero
horizontal page overflow; no console errors across nav + expand +
resize.

## Phase 4.6, Milestone 4.6.2 — what was built

Three fleet-wide visualizations and the first new nav view since Phase 1.

- `js/components/treemap.js` (new): two-level **squarified** treemap —
  group rectangles sized by device count, subdivided into status-colored
  device cells. Squarified specifically because slice-and-dice
  degenerates into slivers when one group dominates, which is what a real
  homelab looks like. Measured on the live fleet: 0 degenerate rects,
  worst aspect ratio 1.94, ~87% area fill (rest is headers/gutters).
- `js/components/matrix.js` (new): `createStatusMatrix()` and
  `createHeatmap()`, both HTML CSS-grid rather than SVG — they're labeled
  tables of cells, and grid gives text alignment + native accessibility
  for free. The reasoning is in the file header; see also
  `docs/architecture.md`'s "SVG or HTML?" note.
- New **Analytics** view. The one non-obvious wiring detail: it had to be
  excluded from `mountViews()`'s device-group list, or
  `mountDeviceGroupView()` would have rendered it as a permanently-empty
  device category (it's a fleet-wide view, not a group).

Two readability decisions made by *looking at real output*, not by
guessing: the heatmap shows the 4 broadly-shared sensors rather than 6
(the fleet's sensor-key frequency is cpu 19, ram 16, storage 8, temp 5,
then a cliff to 3 — the extra columns were mostly empty; density went
41% → 55%), and rows are sorted by how many of those sensors a device
actually has, so the dense block reads first and the genuinely sparse
tail (a switch has no disk, a UPS no CPU) is visibly the tail.

All three separate layout from paint: they recompute layout only when a
composition signature changes and otherwise repaint cells in place —
verified by holding DOM node references across several ticks and
confirming the *same* nodes were recolored, not recreated.

Verified live: 7 groups / 22 treemap cells / 22 matrix cells / 88 heat
cells against the 22-device fleet; mobile (375px) scales cleanly with the
heatmap scrolling inside its own container and zero page-level horizontal
overflow (the Phase 4.5 rule); no console errors; no regression — all 22
device cards still distributed correctly across the group views.

## Immediate next

Phase 4.6 continues (see `docs/roadmap.md`):

- **Milestone 4.6.3 — interactive topology map**: a status-colored
  network graph (nodes = devices, grouped by subnet/role) with hover and
  zoom — the most layout-heavy single piece, hence its own milestone.

Separately (independent track, not blocking 4.6): **real data behind the
backend** (replace `/api/dashboard`'s synthetic demo devices with real
collectors; fill the documented backend seams — history storage, auth).
