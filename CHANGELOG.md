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

[Unreleased]: https://github.com/your-org/sentinel-monitor/compare/v0.4.0-alpha...HEAD
[0.4.0-alpha]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.4.0-alpha
[0.3.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.3.0
[0.2.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-org/sentinel-monitor/releases/tag/v0.1.0
