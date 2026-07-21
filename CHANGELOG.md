# Changelog

All notable changes to Sentinel Monitor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it reaches 1.0.0. Pre-1.0 releases (`0.x.y`) may include breaking changes
between minor versions, as permitted by SemVer.

---

## [Unreleased]

Nothing yet.

---

## [0.6.0-alpha] — Phase 5.1: Sentinel Core Server Foundation

A backend now exists (`backend/`) — the backend equivalent of Phase 1:
architecture, not monitoring functionality. Designed from the start so the
frontend is a client of it, not part of it; a future desktop app, mobile
app, or CLI could consume the same API. Zero frontend changes were needed
— `ApiProvider`/`WebSocketProvider` were already structurally-complete,
inert seams built for exactly this (Phase 3), and the frontend remains
100% simulated by default with no behavior change.

### Added
- FastAPI application factory (`backend/app/core/application.py`):
  dependency injection, request-id + request-logging middleware,
  structured logging (`structlog`, console or JSON), global exception
  handlers with a consistent JSON error envelope, CORS with an explicit
  origin allowlist, lifespan-managed startup/shutdown, Swagger/ReDoc/OpenAPI
- Configuration system (`app/config/`): env vars, `.env`, and custom
  YAML/JSON `pydantic-settings` sources, all layered with defaults and
  validation; secrets never sourced from a checked-in file
- Async SQLAlchemy database layer (`app/database/`): engine/session
  management, a `Base` + `TimestampMixin`, a generic `BaseRepository`
  (deliberately mirroring `js/plugins/registry.js`'s "one generic
  implementation, not sixteen bespoke ones" reasoning), and Alembic
  migrations — verified end-to-end (model → autogenerate → migration →
  `upgrade head` → real table)
- Plugin bootstrap (`app/plugins/`): a generic `Registry` and
  `PluginManager` mirroring `js/plugins/registry.js` /
  `plugin-manager.js`'s shape and isolate-on-failure guarantee. No real
  plugins ship — `load_all()` loads none by default
- API skeleton: `/api/system`, `/api/health`, `/api/version`,
  `/api/plugins`, `/api/settings`, plus root `/` and a dependency-free
  `/health` liveness probe distinct from `/api/health`'s readiness check
  (database/scheduler/websocket/plugins)
- WebSocket foundation (`app/websocket/`): connection manager
  (connect/disconnect/broadcast/heartbeat), an auth hook seam, verified
  live (connection count correctly tracks connect and graceful disconnect)
- Scheduler foundation (`app/scheduler/`): pluggable APScheduler-backed
  interval jobs; `jobs.py` registers none by default
- Documented `NotImplementedError` seams — `HistoryService`,
  `AuthenticationService` — instead of silent empty-data stubs, so "not
  built yet" can never be mistaken for "genuinely empty"
- `backend/README.md`, Dockerfile (multi-stage, non-root, healthcheck),
  docker-compose.yml (SQLite by default, commented Postgres path), pytest
  suite (in-memory SQLite per test, 9 passing tests)

### Verified
Actually run, not just reviewed: `pytest` (9/9 passing), the live server
booting and every endpoint responding correctly (including config values
genuinely loaded from `config/config.yaml`, not just field defaults), a
live WebSocket connection, and a full Alembic migration round-trip. Two
real bugs were caught this way and fixed: the default SQLite path failed
because nothing created its parent directory first, and Alembic's
`migrations/env.py` builds its own engine (bypassing the app's session
module), so it needed the same fix applied separately.

---

## [0.5.1-alpha] — Phase 4.5: Full Visual QA & UI Stabilization

No new features — a full visual QA pass across viewports (390px–3440px)
and every view/modal, verified live in a browser via direct DOM/CSS
measurement rather than inspection alone.

### Fixed
- Device-card lists on every group view (Infrastructure/Servers/Network/
  Storage/Docker/AI/Minecraft) were collapsed to ~1/12th page width — a
  nested `.widget-grid` sat unspanned inside the outer 12-column grid
- Widget and device-card collapse/expand animations didn't actually
  collapse content (the `grid-template-rows: 0fr` trick wasn't resolving
  to zero in this render engine); switched to a `max-height` transition
- The search modal's `close()` nulled its shared `backdrop` variable
  before the deferred `remove()` read it, so Escape/backdrop-click
  silently no-op'd
- The Add Device modal's "Got it" button had an empty `onclick`
- Ultrawide viewports (2560/3440px) stretched widgets into mostly-empty
  cards — `.app-main`'s content width is now capped and centered
- A page-wide horizontal scrollbar appeared at tablet width (768px)
  whenever header status text ran long — `.app-header` lacked `min-width: 0`
- Two CSS-specificity bugs meant `.header-search`'s hide-on-mobile rule
  and the mobile drawer's nav labels/wordmark had never actually worked,
  at any viewport, since Phase 1
- Stale/self-contradicting view copy; a duplicate CPU/Memory icon (added
  a dedicated memory icon)

### Removed
45 lines of confirmed-orphaned CSS (checked against every JS file):
unused card/counter/notification/spinner/search-label rules and animation
utilities duplicated by the existing `view-in` keyframe.

---

## [0.5.0-alpha] — Phase 4: Real Monitoring Engine

A second, real data path alongside the Phase 3 simulator. Every device
remains simulated by default; two demo devices are now genuinely
live-polled, proving the mechanism end-to-end without touching any of the
existing fleet's behavior.

### Added
- Sensor Provider registry (`HLM.registries.sensorProviders`) and SDK
  support (`ctx.registerSensorProvider()`, `HLM.sdk.defineMonitor()`),
  following the same pattern as every other registry in the app
- Four built-in sensor providers (`js/plugins/builtin/core-monitoring.js`):
  `ping` (HTTP/no-cors reachability + latency + rough packet loss),
  `http` (real response code/time), `system` (structurally-complete
  local-agent poller), `dummy` (synthetic, for scheduler testing)
- A real `minecraft` sensor provider, registered by the existing
  Minecraft plugin itself, using the public `mcsrvstat.us` API for
  genuine online/player-count/MOTD/version data
- A generic `http-endpoint` device type for monitoring arbitrary HTTP
  services
- Monitoring Scheduler (`js/engine/monitoring-scheduler.js`): one
  independently-rescheduling poll chain per (device, sensor), concurrency
  capped, retry-with-backoff before marking a sensor down,
  maintenance-aware pausing, failure logging
- History Engine (`js/engine/history-engine.js`): timestamped `{t,v}`
  rolling buffers, replacing the raw-number history arrays, shared by
  simulated and live sensors alike
- Two demo devices, `monitored: true` in `js/core/config.js`: a public
  Minecraft server (Hypixel) and a public HTTP/reachability check
  (GitHub's status page + Cloudflare's `1.1.1.1`)
- Device cards show live-monitored sensors' poll status, response time,
  and next-check countdown, plus a sensor-count row for every device
- Settings gained a "Live Monitoring" panel listing every polled sensor
  fleet-wide

### Changed
- `engine.js`'s tick pipeline gained an `overlayLiveSensors()` step,
  running before health computation — real values flow through the exact
  same thresholding a simulated sensor uses, with zero changes to
  `health-engine.js`, `alert-engine.js`, or `event-engine.js`
- `minecraft-plugin.js`'s `players` sensor definition gained a `monitor`
  config; unaffected for the two demo-fleet Minecraft devices that don't
  have `monitored: true`, since that's a per-device-instance opt-in

### Notes
- The Alerts Foundation this phase's brief asked for (alert objects,
  severity, acknowledged flag, timestamp, resolved state) was audited
  against Phase 3's `alert-engine.js` and found already complete — no new
  code was written there.
- This phase reorders the roadmap: what was originally planned as
  "Phase 4" (charts/topology/visualization) is now Phase 4.5. See
  `PROJECT_STATE.md` for the full reasoning.

---

## [0.4.0-alpha] — Phase 3.5: Plugin Architecture

The monitoring engine from Phase 3 is now built on top of a full plugin
architecture. This is the most significant architectural milestone in the
project so far: **the core no longer has any hardcoded knowledge of a
specific service.**

### Added
- Plugin Manager: registration, lifecycle (enable/disable/unload), dependency
  validation, semantic-version compatibility checks, and full error isolation
  (a plugin that throws cannot crash the application)
- Generic Registry system (`HLM.createRegistry`) backing every extension
  point, with per-plugin ownership tracking for clean unload
- Plugin SDK (`HLM.createPlugin`, `HLM.sdk.defineDeviceType`,
  `HLM.sdk.defineSensor`) for ergonomic plugin authoring
- Service layer (Notification, Storage, History, Settings, Logging, Command
  services) so plugins never touch core internals directly
- Widget Registry, Device Registry, Data Provider Registry, Notification
  Provider Registry, Settings Panel Registry, Health Calculator Registry,
  Alert Rule Registry, Background Task Scheduler, Page Registry, Icon
  Registry, Theme Registry, Translation Registry
- Six example plugins demonstrating the extension surface end-to-end:
  Proxmox, Docker, Minecraft, Ollama, Home Assistant, Pi-hole (device type +
  widget + command + icon + settings panel each; intentionally not full
  integrations)
- Built-in "core-devices" and "core-widgets" plugins — the platform's own
  default device types and widget kinds now ship through the identical
  registration path a third-party plugin uses
- Command palette now indexes plugin-registered commands
- Settings view now renders a live Plugin Manager status panel and any
  plugin-registered settings panels

### Changed
- `device-model.js` rewritten to be purely mechanical (hydrates a device
  from whatever definition a registry hands it); all sensor blueprints
  moved out of the engine and into plugins
- `data-provider.js` provider selection now resolves through the Data
  Provider Registry instead of a hardcoded switch statement
- `health-engine.js` checks for a plugin-registered custom health
  calculator before falling back to the default weighted algorithm
- `config.js` no longer contains `DEVICE_TYPES` or `TYPE_GROUP` — that
  knowledge lives entirely in plugin device-type registrations

### Fixed
- `store.subscribe(fn, select)` was passing the selected slice to `fn`
  instead of full state, causing selector-gated subscribers to crash on
  first use; fixed and now covered by regression tests
- Store listeners are now isolated in `try/catch` — one throwing listener
  no longer silently cancels every other subscriber for that update

---

## [0.3.0] — Phase 3: Monitoring Engine

### Added
- Data Provider abstraction (`DataProvider` interface) with `SimulationProvider`,
  a structurally-complete `ApiProvider`, and a structurally-complete
  `WebSocketProvider`; provider swap is a single config value
- Simulation engine: slow-drifting sensor targets, gaussian noise, decaying
  spikes, and a per-device incident state machine (offline/degraded with
  automatic recovery)
- Health engine: sensor → device → group → global health, each a pure
  function of the layer below it
- Alert engine: structural deduplication (one alert per device+sensor),
  escalation, auto-resolution, maintenance suppression, acknowledgement
- Event engine: alert-transition events plus type-specific flavor events
  (container restarts, Minecraft backups, UPS power-source changes)
- 20-device simulated fleet spanning 18 device types
- Live-updating Overview, per-category device views, and a filterable Logs
  event stream, all bound to the store

### Changed
- `app.js` rewritten to bind every view to live store state instead of
  static demo content
- `device-card.js` gained an `update()` path for in-place DOM patching
  instead of full rebuilds on every tick (required for the fleet to scale)
- Gauges gained `invert` support (for values where lower is worse, e.g.
  battery charge, fleet health score)

---

## [0.2.0] — Phase 2: UI Framework

### Added
- Reusable component library: Widget framework, circular/linear gauges,
  animated counters, progress bars, device cards, modal/dialog system,
  toast notifications, dropdown + context menus, notification center,
  command-palette search, floating action menu
- Event bus (`HLM.events`) alongside the store, for transient signals that
  don't belong in application state
- Full focus management (focus trap, Escape-to-close, focus restoration)
  across modals, menus, and search

### Changed
- Collapsed all Phase 1 globals (`Utils`, `CONFIG`, `Store`, `Theme`,
  `Router`, `Clock`) into a single `HLM` namespace
- Split the monolithic `components.css` into 17 single-responsibility files
- Centralized all icon rendering through `HLM.icon()`

---

## [0.1.0] — Phase 1: Application Architecture

### Added
- Initial application shell: header, collapsible sidebar, responsive
  layout framework down to phone width
- Design token system (`tokens.css`): color, typography, spacing, radius,
  shadow, and motion, dark-mode-first
- Client-side router for the ten core views (Overview, Infrastructure,
  Servers, Network, Storage, Docker, AI, Minecraft, Logs, Settings)
- SVG icon sprite and base typography (Space Grotesk / Inter / JetBrains
  Mono)
- Config-driven navigation structure

[Unreleased]: https://github.com/your-org/sentinel-monitor/compare/v0.6.0-alpha...HEAD
[0.6.0-alpha]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.6.0-alpha
[0.5.1-alpha]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.5.1-alpha
[0.5.0-alpha]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.5.0-alpha
[0.4.0-alpha]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.4.0-alpha
[0.3.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.3.0
[0.2.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.1.0
