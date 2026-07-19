# Architecture

> **This is a living document.** Whenever a phase changes the architecture,
> this file is updated in the same commit. If something here doesn't match
> the code, that's a bug in the documentation — please file an issue.

## Layering

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

Each arrow is a one-way dependency. UI code depends on the store; the store
doesn't know the UI exists. The engine writes to the store; it never imports
a UI component. Data providers produce data; they don't know what a "device
card" is. This is deliberate — it's what lets any one layer be replaced
without the others changing.

## Why no framework?

Sentinel Monitor is meant to be a single `index.html` a self-hoster can
open with zero build step, zero `npm install`, zero bundler. That constraint
shaped several decisions:

- **No ES modules.** Browsers block ES module scripts loaded via `file://`
  due to CORS. Every file is a classic `<script>` wrapped in an IIFE that
  attaches to a single global, `HLM`.
- **One global, not many.** Phase 1 used several top-level globals (`Utils`,
  `Store`, `Router`, ...). By Phase 2 that was collapsed into `HLM.*`
  specifically because a plugin system was coming — many independently
  loaded files each claiming a global name doesn't scale, and collisions
  are exactly the kind of bug that's invisible until two plugins pick the
  same name.
- **No virtual DOM.** At the scale this targets (hundreds of devices,
  thousands of sensors), naive re-rendering is a real performance risk.
  Components expose imperative `update()` functions that patch specific
  DOM nodes instead of diffing/rebuilding. This is more code than a
  framework would need, but it's the reason a 500-device fleet ticking
  every 2.5 seconds doesn't rebuild the DOM 500 times a tick.

## The Store

`HLM.store` is a minimal observable store: `get()`, `set(patch)`,
`subscribe(fn, selector?)`. Two design choices worth explaining:

- **Selectors gate *when* a subscriber runs, not *what* it receives.**
  `subscribe(render, s => s.lastTick)` means `render` only re-runs when
  `lastTick` changes, but it always receives full state. This was actually
  a real bug during Phase 3 development — an earlier version passed the
  *selected value* to the callback, which crashed the first widget that
  needed more than the selected slice. Fixed, and now the contract is
  explicit here so it isn't reintroduced.
- **Listeners are isolated.** `store.set()` wraps every listener call in
  `try/catch`. Before this, one throwing widget silently prevented every
  other widget from updating for that tick — a single bug anywhere could
  freeze the entire dashboard. This mirrors the same sandboxing philosophy
  applied to plugins (see below), just one layer down.

Events (`HLM.events`) are separate from the store on purpose: the store
answers "what is true right now" (devices, alerts, theme); events answer
"something just happened" (open this modal, show this toast). Conflating
the two would mean either polluting persistent state with one-off signals,
or losing the ability to fire a toast from code that has no reason to know
the store's shape.

## The Monitoring Engine

`js/engine/` is four cooperating, single-purpose modules:

- **`device-model.js`** — mechanics only. Turns a device-type definition
  (from a plugin) plus a config seed into a live runtime device. Has zero
  hardcoded knowledge of what device types exist.
- **`health-engine.js`** — pure functions, sensor → device → group →
  global. Each level only depends on the level below it, and every
  function is deterministic given its inputs — no side effects, no store
  access. This makes it trivially testable and safe for a plugin to
  override per device type (`healthCalculators` registry).
- **`alert-engine.js`** — owns its own persistent `Map` of active alerts,
  keyed by `(deviceId, sensorKey)`. Deduplication is structural (one alert
  per key, upserted) rather than timer-based — a sensor sitting in "warn"
  for an hour produces exactly one alert, not one per tick, with no
  cooldown timer required to achieve that.
- **`event-engine.js`** — turns alert transitions into a timeline and adds
  cosmetic "flavor" events (a container restarting, a backup completing)
  that never affect health or alerts. Kept explicitly separate so "what
  actually matters" (alerts) can never be confused with "what makes the
  log feel alive" (flavor events).

The engine's only contact with the outside world is a `DataProvider`. It
does not know or care whether that provider is simulating data or polling
a real API — see the next section.

## Data Providers

`DataProvider` is a three-method interface (`start`, `stop`, `refresh`)
plus two callbacks (`onTick`, `onStatus`). `SimulationProvider`,
`ApiProvider`, and `WebSocketProvider` all implement it identically from
the engine's point of view. Swapping between them is one config value
(`HLM.config.APP.dataProvider`), and `engine.js` automatically falls back
to simulation after several consecutive failed connections to a live
source.

`SimulationProvider` deliberately does **not** hand out its internal,
mutable simulation state directly — each tick, it emits a freshly cloned
snapshot. Early in development it passed the same mutable object graph
every tick, which meant "the previous tick's data" and "this tick's data"
were literally the same object by the time anything downstream looked at
them, breaking incident-detection logic that needs to compare before/after
state. The clone step is cheap and closes that whole class of bug.

## The Plugin Architecture

This is the newest and most consequential layer (Phase 3.5). The driving
constraint, stated directly in that phase's brief: **the core should not
know Proxmox, Docker, Minecraft, or Ollama exist.**

Before Phase 3.5, `device-model.js` hardcoded sensor blueprints for every
device type by name — including third-party services. That's exactly the
coupling this layer removes.

### Registry, not sixteen registries

Every extension point (device types, widgets, pages, commands, data
providers, ...) is an instance of one generic `createRegistry()` factory,
not a bespoke class per extension point. The shape — register, get, list,
unregister-with-owner-tracking — doesn't change between "a place to put
device types" and "a place to put commands," so there's exactly one
implementation of it. This also means adding a *new* extension point in
the future (say, `dashboardLayouts`) is a one-line addition to
`registries.js`, not a new class.

### Plugin Manager as the only entry point

Core code never imports a plugin file directly. Everything goes through
`HLM.pluginManager`, which validates the manifest, checks dependencies and
core-version compatibility, and runs `setup(ctx)` inside a `try/catch`.
A plugin that throws is marked `failed` with the error recorded — it does
not take down the app. This was verified directly: the Phase 3.5 test
suite registers a plugin whose `setup()` deliberately throws and asserts
the rest of the app is unaffected.

### Built-in device types are plugins too

`js/plugins/builtin/core-devices.js` registers the general-purpose device
types (Windows, Linux, NAS, switch, router, ...) through `HLM.createPlugin()`
— the identical path a downloaded third-party plugin would use. There is
no special "built-in" code path in the Device Registry. This was a
deliberate choice over the faster option (leaving generic types hardcoded
in config and only making *third-party* types pluggable): a registry with
a secret backdoor for "the types that don't count" isn't really proof the
architecture works.

### Services, not direct access

Plugins receive a `ctx.services` object (Notifications, Storage, History,
Settings, Logging, Commands) instead of reaching into `HLM.store` or
`HLM.ui` directly. This is the indirection that lets core internals change
later without breaking every plugin that depends on them — the same reason
any stable software product publishes an SDK instead of telling extension
authors to read its source.

## Known Limitations (honesty over polish)

- Data is simulated. There is no real Proxmox/Docker/Minecraft/etc.
  integration behind the example plugins — see `docs/roadmap.md`.
- There is no backend. `ApiProvider`/`WebSocketProvider` are structurally
  complete but have nothing real to talk to yet (Phase 5).
- There is no persistence beyond `localStorage` for plugin-scoped settings.
  Refreshing the page resets the simulated fleet's history buffers.
- There is no authentication. Anyone who can open the page can see and
  interact with everything (Phase 9).
