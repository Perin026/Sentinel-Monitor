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

---

## Upcoming

### Phase 4.5 — Visualization Framework
Charts, interactive topology map, treemap/sunburst for fleet composition,
historical graphs backed by the sensor history buffers the engine already
maintains (now timestamped — see `js/engine/history-engine.js`), heatmaps,
and a status matrix. This phase is UI/rendering work on top of data the
engine already produces — no engine changes expected. (This is the
work originally scoped as "Phase 4," renumbered after the Real Monitoring
Engine brief took that slot — see `PROJECT_STATE.md`.)

### Phase 5 — FastAPI Backend
A real backend implementing the `/api/dashboard` contract `ApiProvider`
already expects, plus a WebSocket endpoint for `WebSocketProvider`. This is
where "simulated" data starts being replaceable with real data, one
config value at a time, per the Data Provider architecture from Phase 3.
Also the natural home for a reference `system` sensor-provider agent
(Phase 4 built the poller; nothing ships an agent for it to poll yet).

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
