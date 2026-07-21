# Roadmap

> **This is a living document.** It is updated at the end of every phase,
> alongside `docs/architecture.md`, per the
> [Future Development Policy](#future-development-policy) below.

## Completed

### ✅ Phase 1 — Application Architecture
App shell, design tokens, responsive layout framework, client-side router,
config-driven navigation. No functionality yet — the foundation everything
else is built on.

### ✅ Phase 2 — UI Framework
Full reusable component library: widgets, gauges, counters, progress bars,
device cards, modals, toasts, menus, notification center, command palette,
floating action menu. Collapsed into a single `HLM` namespace in
preparation for the plugin system that would follow.

### ✅ Phase 3 — Monitoring Engine
Data provider abstraction, realistic simulation engine (trends, spikes,
incidents, recovery), health/alert/event engines, a 20-device simulated
fleet, and every view wired to live store state.

### ✅ Phase 3.5 — Plugin Architecture
Plugin Manager, generic registry system, Plugin SDK, service layer, and
six example plugins. The core no longer has hardcoded knowledge of any
specific service — see [`docs/architecture.md`](architecture.md) for the
full rationale.

### ✅ Phase 4 — Real Monitoring Engine
A second, real data path alongside the Phase 3 simulator: a Sensor
Provider registry, a Monitoring Scheduler (independent per-sensor
intervals, concurrency-capped, retry-with-backoff, failure logging), a
timestamped History Engine, and `unknown/up/down/paused` poll-health
layered on top of the existing threshold-health vocabulary — with zero
changes required to `health-engine.js`/`alert-engine.js`/`event-engine.js`
(see [`docs/architecture.md`](architecture.md#live-monitoring-phase-4)).
Two demo devices are genuinely live: a public Minecraft server (via
`mcsrvstat.us`) and a public HTTP/reachability check. Note: this reorders
what was originally planned as "Phase 4" (Visualization) — see
`PROJECT_STATE.md` for why real data before charts of that data made more
sense. The Alerts Foundation this phase asked for turned out to already
be fully satisfied by Phase 3's `alert-engine.js`; nothing new was built
there.

### ✅ Phase 4.5 — Full Visual QA & UI Stabilization
No new features — a full visual QA pass across viewports (390px–3440px)
and every view/modal, fixing what it found: device-card lists on every
group view were collapsed to ~1/12th page width (a nested `.widget-grid`
sat unspanned inside the outer 12-column grid); widget/device-card
collapse animations didn't actually collapse; the search modal's
`close()` never removed its own DOM node; the Add Device modal's "Got it"
button had an empty handler; ultrawide viewports stretched widgets into
mostly-empty cards; a page-wide horizontal scroll appeared at tablet width
whenever header status text ran long; and two CSS-specificity bugs meant
`.header-search`'s mobile hide rule and the mobile drawer's nav
labels/wordmark had never actually worked, since Phase 1. Also removed 45
lines of confirmed-orphaned CSS. See `PROJECT_STATE.md` for the full
list — every issue was found and fixed by measuring the live DOM/CSS in a
real browser, not by inspection alone.

---

## Upcoming

### Phase 4.6 — Visualization Framework
Charts, interactive topology map, treemap/sunburst for fleet composition,
historical graphs backed by the sensor history buffers the engine already
maintains (now timestamped — see `js/engine/history-engine.js`), heatmaps,
and a status matrix. This phase is UI/rendering work on top of data the
engine already produces — no engine changes expected. (This is the
work originally scoped as "Phase 4," twice renumbered — first when the
Real Monitoring Engine brief took the "Phase 4" slot, then again when
Visual QA took the "Phase 4.5" slot — see `PROJECT_STATE.md`.)

### Phase 5 — Backend
A real backend implementing the `/api/dashboard` contract `ApiProvider`
already expects, plus a WebSocket endpoint for `WebSocketProvider`. This is
where "simulated" data starts being replaceable with real data, one
config value at a time, per the Data Provider architecture from Phase 3.
Also the natural home for a reference `system` sensor-provider agent
(Phase 4 built the poller; nothing ships an agent for it to poll yet).

#### ✅ Phase 5.1 — Sentinel Core Server Foundation
The backend equivalent of Phase 1: architecture, not functionality. A
FastAPI application (`backend/`) designed to run independently of any one
client — application factory, DI, structured logging, global exception
handling, CORS, a config system (env vars/`.env`/YAML/JSON/defaults,
validated), an async SQLAlchemy + Alembic database layer with the
repository pattern, a Plugin Manager + generic Registry deliberately
mirroring `js/plugins/` (same isolation-on-failure guarantee, same "one
generic registry, not sixteen bespoke ones" reasoning), a WebSocket
connection manager (connect/disconnect/broadcast/heartbeat/auth hook), and
a pluggable APScheduler-backed job framework. No monitoring data flows
yet — `/api/system`, `/api/health`, `/api/version`, `/api/plugins`,
`/api/settings` all return real (if mostly placeholder) data, and
collectors/notifications/authentication/history are documented
`NotImplementedError` seams for Phase 5.2+ to fill in, not silent stubs.
See [`backend/README.md`](../backend/README.md) and
[`docs/architecture.md`](architecture.md#sentinel-core-server-phase-51).

#### 🔄 Phase 5.2 — Frontend ↔ Backend Integration (in progress)
Architectural validation, explicitly not new features: prove that
`ApiProvider` and `SimulationProvider` are genuinely interchangeable by
actually connecting them. Milestone 5.2.1 (API contract, real
`ApiProvider`, Store integration via `hydrateFromSnapshot()`) is
complete — see `CHANGELOG.md`'s `[Unreleased]` section and
`docs/api-contract.md`. Remaining: a Connection Manager + automatic
simulation fallback (5.2.2), then testing/documentation/final review
(5.2.3).

### Phase 6 — Official Plugins
Real integrations, replacing today's demonstration plugins:
- Proxmox (VE API)
- Docker (Engine API)
- Ollama (local API)
- Minecraft (RCON / Query protocol) — partially superseded: Phase 4
  already wired a real `mcsrvstat.us`-backed sensor provider for
  online/players/MOTD/version. RCON would still be needed for anything
  that *acts* on the server (triggering a backup, running a command).
- Home Assistant (REST/WebSocket API)
- Pi-hole (API)
- OPNsense (API)

Each ships as a proper plugin under `js/plugins/`, following
[`docs/plugin-development.md`](plugin-development.md). This phase is
expected to touch zero core files — if it does, that's a signal the
Phase 3.5 architecture has a gap worth revisiting.

### Phase 7 — Historical Analytics
Long-term storage beyond the in-memory rolling buffers, trend analysis,
capacity planning views.

### Phase 8 — Automation Engine
Rule-based automations triggered by alerts/events (e.g. "restart this
container automatically after 3 failed health checks").

### Phase 9 — Authentication & Multi-user
Login, roles/permissions, per-user dashboard preferences.

### Phase 10 — Production Release
Hardening, performance audit at real scale (500 devices / 5,000 sensors
per the Phase 3 brief's target), full documentation pass, v1.0.0.

---

## Future Development Policy

Every phase from this point forward ends with:

1. Update `README.md` if the change affects features, install steps, or
   project structure.
2. Update `CHANGELOG.md` with a new version entry.
3. Update `docs/architecture.md` if any architectural layer changed.
4. Update this roadmap — move completed items up, adjust upcoming scope.
5. Review project structure for organizational drift.
6. Run a final architectural review (duplication, coupling, dead code).
7. Verify the application still builds and runs (open `index.html`, run
   the smoke test described in `docs/developer-guide.md`).
8. Commit with a Conventional Commits message describing the phase.

Documentation is not allowed to fall behind the implementation. If a
future change makes something in these docs inaccurate, fixing that is
part of the change, not a follow-up.
