# Plugin Development Guide

Sentinel Monitor's core has no built-in knowledge of any specific service.
Everything from "what is a Proxmox host" to "what does the Docker icon
look like" is defined by a plugin — including the device types that ship
by default. This guide walks through building one.

## The Minimal Plugin

```javascript
HLM.createPlugin({
  id: "my-service",              // globally unique, used to namespace everything you register
  name: "My Service",
  version: "0.1.0",
  author: "Your Name",
  license: "MIT",
  description: "One sentence describing what this plugin monitors.",
  minCoreVersion: "1.0.0",       // checked against HLM.pluginManager.CORE_API_VERSION
  setup(ctx){
    // register things here
  },
});
```

`setup(ctx)` runs once, immediately, when the plugin loads. `ctx` is your
only interface to the rest of the app — see [Context API](#context-api)
below.

## Defining a Device Type

```javascript
ctx.registerDevice("my-service", HLM.sdk.defineDeviceType({
  label: "My Service",
  icon: "cpu",                    // built-in sprite icon, or one you registered yourself
  group: "infrastructure",         // which nav view this device type appears under
  sensors: [
    HLM.sdk.defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 2 }),
    HLM.sdk.defineSensor({ key: "queue", label: "Queue Depth", unit: "", weight: 1, warn: 50, critical: 100 }),
  ],
}));
```

`weight` controls how much a sensor contributes to the device's overall
health score; a sensor with `weight: 0` is informational only and never
affects status (useful for things like "players online" that shouldn't
themselves trigger an alert). `invert: true` means *lower* values are
worse (battery charge, free disk headroom expressed as "percent remaining").

Once registered, your device type is available to the fleet config
(`js/core/config.js`'s `DEVICES` array) immediately — the health engine,
alert engine, device cards, and Overview aggregates all pick it up with no
further code.

## Registering a Widget

```javascript
ctx.registerWidget("my-service.queue-depth", () => ({
  title: "Queue Depth",
  render(container, { device }){
    container.textContent = `${device.name}: ${device.sensors.queue.value} queued`;
  },
}));
```

Widgets are registered as **factories** (a function returning the widget
definition), not instances — nothing is constructed until something
resolves and calls the factory. This is what "lazy loading" means in a
single-file, no-bundler app: construction cost is deferred, not file
loading.

## Registering a Command

Commands show up in the command palette (press `/` or click search).

```javascript
ctx.registerCommand("my-service.restart", {
  label: "My Service: Restart",
  icon: "refresh",
  run(){
    ctx.services.notifications.notify({ title: "Restarted", level: "ok" });
  },
});
```

## Registering an Icon

If the built-in sprite doesn't have an icon for your service, register your
own — inner SVG markup, 24×24 viewBox convention, stroke-based to match the
existing icon style:

```javascript
ctx.registerIcon("my-service", `<circle cx="12" cy="12" r="8"/><path d="M9 12h6"/>`);
```

## Registering a Settings Panel

```javascript
ctx.registerSettingsPanel("my-service", {
  title: "My Service",
  icon: "my-service",
  render(container){
    container.textContent = "Connection settings would go here.";
  },
});
```

## Context API

| Method | Registers into |
|---|---|
| `ctx.registerDevice(id, def)` | Device Registry |
| `ctx.registerWidget(id, factory)` | Widget Registry |
| `ctx.registerPage(id, def)` | Page Registry (adds a nav item + view) |
| `ctx.registerProvider(id, ProviderClass)` | Data Provider Registry |
| `ctx.registerCommand(id, def)` | Command Registry (command palette) |
| `ctx.registerNotificationProvider(id, provider)` | Notification Provider Registry |
| `ctx.registerSettingsPanel(id, panel)` | Settings Panel Registry |
| `ctx.registerAction(id, action)` | Action Registry (toolbar/context-menu actions) |
| `ctx.registerHealthCalculator(type, fn)` | Health Calculator Registry — overrides default health scoring for a device type |
| `ctx.registerAlertRule(id, rule)` | Alert Rule Registry |
| `ctx.registerBackgroundTask(id, task)` | Background Task Scheduler — `{ run(), intervalMs }` |
| `ctx.registerTheme(id, theme)` | Theme Registry |
| `ctx.registerTranslation(locale, bundle)` | Translation Registry |
| `ctx.registerIcon(id, svgMarkup)` | Icon Registry |
| `ctx.services.notifications` | Fire toasts + in-app notifications |
| `ctx.services.storage` | Namespaced `localStorage`, scoped to your plugin id |
| `ctx.services.history` | Read-only access to a device/sensor's rolling history |
| `ctx.services.settings` | In-memory settings scoped to your plugin id |
| `ctx.services.logging` | `console.*` wrapper, tagged with your plugin id |
| `ctx.services.commands` | Execute another plugin's registered command |

Every `register*` call automatically records your plugin as the owner —
disabling your plugin removes everything it registered, with no manual
cleanup required.

## Naming Conventions

Prefix every id you register with your plugin's id:
`"docker.restartContainer"`, not `"restartContainer"`. Two plugins
registering the same bare id will throw at registration time (the second
one fails with a clear "already registered" error, isolated by the Plugin
Manager — it won't crash the app, but your plugin also won't load).

## Plugin Lifecycle

- **`register()`** validates the manifest, checks `minCoreVersion` and
  `dependencies`, then calls `setup(ctx)`. Status becomes `enabled` on
  success, or `failed` / `incompatible` / `missing-dependency` otherwise.
- **`disable(id)`** calls your optional `disable(ctx)` hook, then removes
  every registry entry your plugin owns.
- **`enable(id)`** re-runs `setup(ctx)` on a disabled plugin.
- **`unload(id)`** disables (if enabled) and forgets the plugin entirely.

All four are exposed on `HLM.pluginManager` and are what a future plugin
marketplace UI would call.

## What a Demonstration Plugin Should Include

Looking at `js/plugins/examples/` for reference, a demonstration plugin
(one that proves the extension surface without a real integration) should
register:

1. A device type with realistic sensors and thresholds
2. One widget (can be a placeholder — the point is proving the registry
   works, not building a full dashboard)
3. One command (can notify "not implemented" — same reasoning)
4. A custom icon
5. A settings panel stub

...and nothing more. Full integrations (real API calls) are scoped to
Phase 6 — see [`docs/roadmap.md`](roadmap.md).

## Marketplace-Readiness

The manifest schema already includes everything a future plugin
marketplace would need: `id`, `name`, `version`, `author`, `license`,
`description`, `dependencies`, `minCoreVersion`. There is no marketplace
UI yet — this is intentionally forward-compatible metadata, not a feature
in itself.
