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

---

## Upcoming

### Phase 4 — Visualization Framework
Charts, interactive topology map, treemap/sunburst for fleet composition,
historical graphs backed by the sensor history buffers the engine already
maintains, heatmaps, and a status matrix. This phase is UI/rendering work
on top of data the engine already produces — no engine changes expected.

### Phase 5 — FastAPI Backend
A real backend implementing the `/api/dashboard` contract `ApiProvider`
already expects, plus a WebSocket endpoint for `WebSocketProvider`. This is
where "simulated" data starts being replaceable with real data, one
config value at a time, per the Data Provider architecture from Phase 3.

### Phase 6 — Official Plugins
Real integrations, replacing today's demonstration plugins:
- Proxmox (VE API)
- Docker (Engine API)
- Ollama (local API)
- Minecraft (RCON / Query protocol)
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
