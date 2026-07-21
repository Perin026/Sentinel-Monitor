<div align="center">

# Sentinel Monitor

**A modern, extensible, plugin-based monitoring platform for homelabs, self-hosted infrastructure, and small enterprise environments.**

[![Version](https://img.shields.io/badge/version-0.6.0--alpha-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange)](#project-status)
[![Build](https://img.shields.io/badge/build-not_configured-lightgrey)](.github/workflows)
[![Plugins](https://img.shields.io/badge/architecture-plugin--based-6c8eff)](docs/plugin-development.md)

[Overview](#overview) •
[Features](#features) •
[Architecture](#architecture-overview) •
[Getting Started](#getting-started) •
[Plugin System](#plugin-system) •
[Roadmap](#roadmap) •
[Contributing](#contributing)

</div>

---

## Overview

Sentinel Monitor is a Network-Operations-Center-style dashboard for people who run real infrastructure at home or in a small office: Proxmox hosts, Docker stacks, NAS boxes, network gear, UPSes, self-hosted AI tooling, game servers, and everything in between.

It's built to feel like commercial monitoring software — Grafana, Netdata, Uptime Kuma, PRTG — while staying honest about what it currently is: **an alpha-stage frontend and simulation engine, with a production-grade plugin architecture on both sides and a backend foundation that isn't wired to it yet**, not yet a finished product with real integrations.

### Vision

Most homelab dashboards are either too simple (a static status page) or too heavy (a full observability stack you don't need). Sentinel Monitor aims to sit in between: a single, elegant, always-on dashboard that can grow with your homelab because every integration — Proxmox, Docker, Minecraft, Pi-hole, whatever you run next — is a plugin, not a core-code change.

## Project Status

> **Alpha.** The UI framework, monitoring engine, and plugin architecture are complete and tested. There's a real (opt-in) live-monitoring path — two devices are genuinely polled over the network — and, as of Phase 5.2, a working (if not yet default) path to a real backend: `ApiProvider` now renders genuine Sentinel Core Server data through the frontend's completely unmodified pipeline. Most of the demo fleet is still **simulated** by default. See the [Roadmap](#roadmap) for what's next.

## Features

**Today (v0.6.0-alpha):**
- NOC-style dashboard: overview, per-category device views, live event log, settings
- Realistic simulated telemetry — trends, spikes, incidents, and automatic recovery, not just random noise
- Full health/alert/event engine: weighted device health, alert lifecycle (create → escalate → resolve), live event stream
- **Real, opt-in live monitoring**: a Sensor Provider registry, a per-sensor Monitoring Scheduler (independent intervals, retries, backoff), and timestamped history — see two devices polling real infrastructure right now (a public Minecraft server and a public HTTP/reachability check) in Settings → Live Monitoring
- Plugin architecture: device types, widgets, commands, data providers, sensor providers, notification providers, settings panels, and background tasks are all pluggable
- Six example plugins (Proxmox, Docker, Minecraft, Ollama, Home Assistant, Pi-hole) proving the extension surface — Minecraft's player-count/MOTD/version check is genuinely real, the rest remain architectural demonstrations
- Dark-mode-first, responsive, accessible component library (modals, toasts, menus, gauges, device cards) built from scratch — no UI framework dependency
- Zero build step — open `index.html` and it runs
- **Sentinel Core Server** (`backend/`): a FastAPI backend foundation — app factory, config system, async database layer with migrations, a plugin architecture mirroring the frontend's, WebSocket transport, and a job scheduler. See [`backend/README.md`](backend/README.md)
- **Frontend ↔ backend integration** (Phase 5.2, in progress): `ApiProvider` genuinely fetches and renders real backend data — proven by switching `HLM.config.APP.dataProvider` to `"api"` and watching real values flow through the *same* Store, health engine, and widgets the simulator uses, completely unmodified. Still opt-in (`"simulation"` stays the default) until automatic fallback/reconnect exists. See [`docs/api-contract.md`](docs/api-contract.md)

**Not yet implemented** (see [Roadmap](#roadmap)):
- Charts, topology maps, and historical graphs (Phase 4.6)
- Automatic simulation fallback / reconnect when a real backend goes away (Phase 5.2, Milestone 5.2.2), and real collectors/authentication/history behind the backend (Phase 5.2+/6+)
- Full third-party integrations for the other five example plugins (Phase 6) — RCON-level Minecraft control, real Proxmox/Docker/Ollama/Home Assistant/Pi-hole APIs
- Authentication, multi-user support, notification delivery (Discord/ntfy/email)

## Architecture Overview

Sentinel Monitor is a layered, dependency-inverted architecture:

```
UI (widgets, views)
      ↓ reads/writes
Store (single source of truth, observable)
      ↓ populated by
Monitoring Engine (health, alerts, events)
      ↓ fed by
Data Providers (simulation today; API/WebSocket ready)
      ↓ configured by
Plugins (device types, widgets, commands, providers, ...)
      ↓ registered through
Plugin Manager (lifecycle, sandboxing, dependency validation)
```

The core application has **no hardcoded knowledge of any specific service.** Proxmox, Docker, Minecraft, Ollama, Home Assistant, and Pi-hole are all plugins that register themselves through the exact same API a third-party plugin would use. Full details, including the reasoning behind each layer, are in [`docs/architecture.md`](docs/architecture.md).

## Getting Started

Sentinel Monitor is a static, dependency-free frontend. There is no build step.

### Installation

```bash
git clone https://github.com/<your-org>/sentinel-monitor.git
cd sentinel-monitor
```

Then just open `index.html` in a browser — or serve it locally if you prefer:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Everything else — device fleet, simulation, plugins — boots automatically. There is nothing to configure to see it running.

The backend (below) is entirely optional and separate — the frontend doesn't need it and doesn't currently talk to it.

### Requirements

- Any modern browser (Chrome, Firefox, Safari, Edge)
- No Node.js, no package manager, no build tooling required to *run* the app
- Node.js is only used for the project's own smoke tests during development (see [`docs/developer-guide.md`](docs/developer-guide.md))
- Python 3.12+ only if you're also running the backend (see [`backend/README.md`](backend/README.md)) — not required for the frontend

## Project Structure

```
sentinel-monitor/
├── index.html                  App shell + icon sprite
├── css/
│   ├── tokens.css               Design tokens (colors, type, spacing, motion)
│   ├── base.css, layout.css, animations.css
│   └── components/                One file per UI component
├── js/
│   ├── core/                       Store, router, theme, clock, config, event bus
│   ├── plugins/                      Plugin Manager, registries, SDK, services
│   │   ├── builtin/                   Ships-by-default plugins (core device types, core widgets)
│   │   └── examples/                   Demonstration plugins (Proxmox, Docker, Minecraft, ...)
│   ├── engine/                        Health/alert/event engines, simulation, data providers, live-monitoring scheduler
│   ├── components/                     Reusable UI component library
│   └── app.js                           Bootstraps everything
├── backend/                     Sentinel Core Server — independent FastAPI backend (see backend/README.md)
├── docs/                          Architecture, plugin dev guide, roadmap, standards
└── .github/                       Issue templates, PR template, CODEOWNERS, CI placeholder
```

See [`docs/system-overview.md`](docs/system-overview.md) for a frontend subsystem-by-subsystem walkthrough, and [`backend/README.md`](backend/README.md) for the backend's own.

## Plugin System

Every integration in Sentinel Monitor — existing or future — is a plugin. A minimal plugin looks like this:

```javascript
HLM.createPlugin({
  id: "my-service",
  name: "My Service",
  version: "0.1.0",
  author: "Your Name",
  license: "MIT",
  description: "Monitors My Service.",
  minCoreVersion: "1.0.0",
  setup(ctx){
    ctx.registerDevice("my-service", HLM.sdk.defineDeviceType({
      label: "My Service",
      icon: "cpu",
      group: "infrastructure",
      sensors: [HLM.sdk.defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90 })],
    }));
    ctx.registerCommand("my-service.restart", {
      label: "My Service: Restart",
      run(){ ctx.services.notifications.notify({ title: "Not implemented yet", level: "info" }); },
    });
  },
});
```

Plugins can register device types, widgets, pages, commands, data providers, notification providers, settings panels, health calculators, alert rules, background tasks, icons, and themes — all without touching a single core file. See [`docs/plugin-development.md`](docs/plugin-development.md) for the full guide.

## Roadmap

| Phase | Name | Status |
|---|---|---|
| 1 | Application Architecture | ✅ Complete |
| 2 | UI Framework | ✅ Complete |
| 3 | Monitoring Engine | ✅ Complete |
| 3.5 | Plugin Architecture | ✅ Complete |
| 4 | Real Monitoring Engine (sensor providers, scheduler, live polling) | ✅ Complete |
| 4.5 | Full Visual QA & UI Stabilization | ✅ Complete |
| 4.6 | Visualization Framework (charts, topology, treemap) | ⏳ Planned |
| 5.1 | Sentinel Core Server Foundation (`backend/`) | ✅ Complete |
| 5.2 | Frontend ↔ Backend Integration (real `ApiProvider`, Connection Manager, fallback) | 🔄 In progress |
| 5.2+/6+ | Real collectors, authentication, history behind the backend | ⏳ Planned |
| 6 | Official Plugins (Proxmox, Docker, Ollama, Minecraft, Home Assistant, Pi-hole, OPNsense) | ⏳ Planned |
| 7 | Historical Analytics | ⏳ Planned |
| 8 | Automation Engine | ⏳ Planned |
| 9 | Authentication & Multi-user | ⏳ Planned |
| 10 | Production Release | ⏳ Planned |

Full detail, scope, and rationale for each phase: [`docs/roadmap.md`](docs/roadmap.md).

## Screenshots

> _Screenshots will be added once the visualization framework (Phase 4.6) lands. For now, clone the repo and open `index.html` — it's more informative than a static image._

## Contributing

Contributions are welcome, especially plugins. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR — it covers the branch strategy, commit conventions, and (most importantly) when to write a plugin instead of modifying core code.

## Core Principles

- **Plugin-first architecture** — the core knows nothing about specific services
- **Modular design** — one file, one responsibility
- **Extensibility** — every layer has a registered extension point
- **Maintainability** — documentation stays in lockstep with implementation
- **Clean UI** — dark-mode-first, dense, and deliberate
- **Real-time monitoring** — the store is the single source of truth, updated live
- **Production-quality engineering** — even in alpha, error handling and sandboxing are not optional

## License

Sentinel Monitor is released under the [MIT License](./LICENSE).
