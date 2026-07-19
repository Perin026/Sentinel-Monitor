# System Overview

A subsystem-by-subsystem tour of the codebase. For the *why* behind the
layering, see [`architecture.md`](architecture.md); this document is the
*what* and *where*.

## `js/core/` — Foundation

| File | Responsibility |
|---|---|
| `events.js` | Minimal pub/sub bus for transient signals |
| `utils.js` | DOM helpers, formatters, focus trapping |
| `config.js` | App metadata, nav structure, the device fleet seed list |
| `store.js` | Observable application state store |
| `theme.js` | Applies `data-theme` to `<html>`; dark-mode-first |
| `router.js` | Swaps the active `<section class="view">`, syncs URL hash |
| `clock.js` | Header clock + session uptime ticker |

## `js/plugins/` — Extensibility Layer

| File | Responsibility |
|---|---|
| `registry.js` | Generic register/get/list/unregister primitive |
| `registries.js` | Instantiates every named registry (device types, widgets, commands, ...) |
| `services.js` | Notification/Storage/History/Settings/Logging/Command services |
| `plugin-manager.js` | Lifecycle, validation, sandboxing — the only entry point for plugins |
| `sdk.js` | `createPlugin()`, `defineDeviceType()`, `defineSensor()` sugar |
| `scheduler.js` | Runs plugin-registered background tasks on their own interval |
| `builtin/core-devices.js` | Ships-by-default device types (Windows, Linux, NAS, switch, router, ...) |
| `builtin/core-widgets.js` | Ships-by-default widget kinds (gauges, counters, device cards) |
| `examples/*.js` | Six demonstration plugins (Proxmox, Docker, Minecraft, Ollama, Home Assistant, Pi-hole) |

## `js/engine/` — Monitoring Engine

| File | Responsibility |
|---|---|
| `device-model.js` | Hydrates a live device from a plugin's type definition + a config seed |
| `data-provider.js` | `DataProvider` interface, `ApiProvider`, `WebSocketProvider` |
| `simulation-provider.js` | Realistic simulated telemetry: trends, spikes, incidents, recovery |
| `health-engine.js` | Sensor → device → group → global health |
| `alert-engine.js` | Alert lifecycle: create, escalate, resolve, acknowledge, maintenance suppression |
| `event-engine.js` | Live event timeline from alert transitions + flavor events |
| `engine.js` | Orchestrator — wires provider → health → alerts → events → store |

## `js/components/` — UI Component Library

| File | Responsibility |
|---|---|
| `icon.js` | Renders sprite or plugin-registered icons |
| `widget.js` | The dashboard tile framework (header, status, collapse, loading/error states) |
| `gauge.js` | Circular + linear gauges |
| `metric.js` | Animated counters + progress bars |
| `device-card.js` | Expandable device summary/detail card, with in-place `update()` |
| `dropdown.js` / `context-menu.js` | Floating menus |
| `modal.js` | Dialog system + `confirmDialog()` helper |
| `toast.js` | Transient notification stack |
| `notification-center.js` | Bell-icon panel backed by the store's notifications slice |
| `search.js` | Command-palette search (views, devices, plugin commands) |
| `fab.js` | Floating action button + quick actions |

## `js/app.js` — Bootstrap

The composition root. Wires shell interactions (sidebar collapse, mobile
nav, header controls), mounts every view against live store state, starts
the background task scheduler, and starts the monitoring engine. Contains
no reusable logic of its own — everything here is gluing existing pieces
together.

## `css/` — Styling

| Path | Responsibility |
|---|---|
| `tokens.css` | Every color/spacing/type/motion value, as CSS custom properties |
| `base.css` | Reset + base typography |
| `layout.css` | App shell grid, responsive breakpoints |
| `animations.css` | Ambient background + shared keyframes |
| `components/*.css` | One file per UI component, matching `js/components/` |

## Data Flow, End to End

1. `app.js` calls `HLM.engine.start()`.
2. The engine creates a `DataProvider` (simulation by default) and starts it.
3. Every tick, the provider emits a device snapshot.
4. `engine.js`'s pipeline runs: health engine computes status per device →
   alert engine reconciles alerts against health → event engine turns
   alert transitions (+ flavor events) into a timeline.
5. Everything is committed to `HLM.store` in one `set()` call.
6. Every widget/view subscribed to the store re-renders — but via targeted
   `update()` calls (gauge fill, counter text, device-card sensor value),
   not DOM rebuilds.
7. Notable events also fan out through `HLM.services.notifications` to the
   toast stack and notification center.

No step in this chain knows what a "Proxmox host" is — that knowledge
lives entirely in the plugin that registered the `proxmox` device type.
