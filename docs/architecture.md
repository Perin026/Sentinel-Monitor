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

## Live Monitoring (Phase 4)

Phase 3's simulation engine invents every value. Phase 4 adds a second,
parallel source of truth for specific sensors: real polls, running
independently of the 2.5s simulation tick.

```
Monitoring Scheduler (js/engine/monitoring-scheduler.js)
      ↓ calls, per (device, sensor), on its own interval
Sensor Providers (HLM.registries.sensorProviders — ping/http/system/dummy/minecraft/...)
      ↓ results overlaid onto the tick snapshot by
Engine's overlayLiveSensors() — runs *before* health computation
      ↓ from there, indistinguishable from a simulated sensor to
Health Engine / Alert Engine / Event Engine / UI (all unchanged)
```

The key design decision: this is an **overlay**, not a replacement
data path. `overlayLiveSensors()` runs at the top of `engine.js`'s
`runPipeline()`, before `computeDeviceHealth()`, and only touches
`sensor.value` (when a poll succeeded) plus new observability fields
(`monitorStatus`, `responseTimeMs`, `lastUpdate`, `lastSuccessfulUpdate`,
`nextCheckAt`, `meta`). A failed *primary* sensor sets
`device.status = "offline"` on the snapshot — the exact same field the
simulator's own incident engine already sets, which `computeDeviceHealth`
already short-circuits on. Net effect: **zero changes to
`health-engine.js`, `alert-engine.js`, or `event-engine.js`** to support
real data. A live sensor's value gets thresholded, alerted on, and timed
into the event log through the identical code path a simulated one uses.

This only works because live monitoring is opt-in at two levels:
1. **Sensor definition** (device type, from a plugin) — does this sensor
   have a `monitor` config at all? (`HLM.sdk.defineMonitor()`)
2. **Device instance** (its `js/core/config.js` seed) — does *this*
   device have `monitored: true`?

A `minecraft` device type's `players` sensor can carry a real `monitor`
config while two of the three Minecraft devices in the demo fleet stay
100% simulated, because only one of them opts in at the instance level.
Device types are shared; whether an instance points at something real
is not.

### Sensor Providers vs. Data Providers

Don't confuse this with the existing `DataProvider` abstraction
(simulation/api/websocket) from Phase 3 — that swaps out the source for
an *entire device snapshot, every tick, in lockstep*. A `SensorProvider`
polls *one sensor*, on its own schedule, independently of any tick.
They coexist: the active `DataProvider` still produces a full snapshot
every 2.5s (simulated, for now), and the monitoring scheduler's overlay
punches through just the sensors that opted in. A future phase giving
`ApiProvider` something real to talk to wouldn't need to touch sensor
providers at all — the two systems are orthogonal.

### The browser-reality boundary

A browser cannot open a raw ICMP or TCP socket, or read another
machine's CPU/RAM/disk without something on that machine to ask (see
"Why no framework?" above — no backend is the whole point). The built-in
sensor providers (`js/plugins/builtin/core-monitoring.js`) are honest
about this:
- `http` is a real, direct check — response code and timing are exactly
  what they claim to be.
- `ping` is an HTTP(S)/no-cors reachability + latency probe, used *as* a
  ping — not real ICMP, but not fake either: `no-cors` mode resolves for
  any response and rejects only on genuine network failure, so it
  answers "is this reachable, how long did it take" without requiring
  CORS support from the target.
- `system` is structurally complete — same "nothing real to talk to
  unless you run one" honesty `ApiProvider` already modeled — and
  expects a local agent serving JSON metrics.
- `minecraft` (registered by the Minecraft plugin, not core — the core
  still doesn't know Minecraft exists) is genuinely real: the public
  `mcsrvstat.us` API speaks the actual Minecraft protocol server-side, so
  the browser gets real online/player/MOTD/version data over plain HTTPS.

## Visualization (Phase 4.6)

The charting layer is deliberately a *rendering* layer, not a data layer:
it adds no state, no polling, and no engine changes. Every chart consumes
the one history-buffer shape the engine has produced since Phase 4
(`{t,v}` samples, `js/engine/history-engine.js`) and follows the same
component contract as `gauge.js` — a factory returning `{ el, update }`,
where the component owns rendering and the caller owns the data and the
update cadence. There is no charting library; the SVG is built with
`createElementNS`, the same way the gauges are.

Two primitives (`js/components/chart.js`), both registered through the
existing widget registry (`js/plugins/builtin/core-visualizations.js`) so
a plugin can use them exactly like a gauge:

- `createSparkline()` — an inline, axis-less trend. Responsive without any
  measurement code: a fixed logical viewBox stretched by the container,
  with `vector-effect: non-scaling-stroke` keeping the line crisp at any
  width. Colored by the sensor's own threshold status.
- `createTimeChart()` — a full chart with gridlines, y-axis labels,
  warn/critical threshold bands, an area-filled line, and a pointer
  crosshair with a floating value/time readout.

The split between "a device's own sensor history" and "a fleet aggregate"
matters: per-sensor buffers live on the device objects in the Store, so a
sparkline is handed `sensor.history` directly. A fleet-average series
(the Overview's "Fleet CPU Trend") has no such buffer, so *that* widget
keeps its own rolling buffer — using the same `historyEngine.pushSample`
shape — of the average it computes each tick. A chart is never given
authority over data it doesn't own; it either reads an existing buffer or
maintains its own clearly-labeled aggregate.

## Sentinel Core Server (Phase 5.1)

A backend now exists (`backend/`) — but it is not yet wired to anything
above. Nothing in `js/` changed to accommodate it, and nothing in `js/`
needs to: `ApiProvider`/`WebSocketProvider` (Phase 3) were built as
structurally-complete-but-inert seams from the start, specifically so a
real backend could show up later without the frontend being redesigned
around it. That's exactly what happened.

The backend was designed with an explicit constraint: **the frontend is a
client, not part of the server.** Nothing in `backend/app/` imports
anything frontend-specific, assumes a browser, or hardcodes the web
dashboard as *the* consumer — a future desktop app, mobile app, or CLI
should be able to talk to the same API. Concretely:
- CORS is configured with an explicit origin allowlist (`Settings.cors_origins`),
  never a wildcard — every client that's allowed to call the API is named,
  not assumed.
- Every response is a typed Pydantic schema (`app/schemas/`), independent
  of any SQLAlchemy model — the wire format doesn't leak storage details
  to whatever's on the other end of the HTTP call.
- The plugin architecture, generic registry, and isolate-on-failure
  guarantee are deliberately mirrored from `js/plugins/` (see
  `backend/app/plugins/`) — same reasoning, same shape, independently
  implemented on each side rather than the backend depending on the
  frontend's JS at all.

Phase 5.1 is architecture, not monitoring: the database layer, plugin
bootstrap, API skeleton, WebSocket transport, and scheduler are all real
and running, but `/api/*` returns placeholder/infrastructure data, no
collector polls anything. See [`backend/README.md`](../backend/README.md)
for the backend's own architecture documentation (folder-by-folder
responsibilities, what's real vs. a documented seam) rather than
duplicating it here.

## Frontend ↔ Backend Integration (Phase 5.2)

`ApiProvider` is real now — see `docs/api-contract.md` for the wire
contract and `PROJECT_STATE.md` for how it was verified. The default is
still `"simulation"` (`HLM.config.APP.dataProvider`); this phase proves
the *path* works, not that it should be the default yet.

The mechanism is deliberately a thin adapter, not a parallel pipeline:
`ApiProvider` fetches `GET /api/dashboard`, and
`HLM.deviceModel.hydrateFromSnapshot()` (js/engine/device-model.js) merges
each raw device with the plugin-registered type definition — the exact
same `typeDefinition()` lookup `hydrateDevice()` already used for
`config.js`'s static seed list. From that point on, the snapshot is
indistinguishable from a simulated one: `engine.js`'s `runPipeline()`,
`health-engine.js`, `alert-engine.js`, `event-engine.js`, the Store, and
every widget are **completely unmodified**. This is the architectural
claim Phase 3 made when `DataProvider` was designed as a swappable
interface, now actually exercised rather than merely structurally
plausible.

Several real bugs surfaced only by actually connecting the two sides (not
by review) — see `CHANGELOG.md`'s `[Unreleased]` entry and
`PROJECT_STATE.md` for details: a backend session that silently never
committed writes, and two frontend places that assumed a device count
never differs from `HLM.config.DEVICES.length` (true for
`SimulationProvider` by construction, false the instant a real backend's
fleet size can differ) — one of which (`mountDeviceGroupView`) had never
removed a stale device card once its device disappeared from a snapshot,
because no snapshot's device set had ever shrunk before this phase.

### How the two sides communicate

The frontend is an HTTP client of the backend — nothing more. There is no
shared code, no build-time link, no generated client; the contract is
`docs/api-contract.md` and the wire format is plain JSON. Three
independent frontend consumers each own one concern and one endpoint:

| Frontend module | Endpoint | Cadence | Purpose |
|---|---|---|---|
| `ApiProvider` (`data-provider.js`) | `GET /api/dashboard` | every `refreshMs` (2.5s) | the device snapshot that drives the whole UI |
| `backend-health.js` | `GET /api/system` | every 8s | the backend's own self-monitoring, for Settings |
| `connection-manager.js` | `GET /health` | only while fallen back | cheap liveness probe to detect recovery |

A single dashboard round trip: `ApiProvider._poll()` →
`HLM.http.fetchWithTimeout('/api/dashboard')` → FastAPI route
(`api/routes/dashboard.py`) → `DashboardService.get_snapshot()` (reads the
`Device` table, applies a tiny random walk, serializes via the
`DashboardResponse` pydantic schema) → JSON on the wire →
`ApiProvider._hydrateSnapshot()` calls
`HLM.deviceModel.hydrateFromSnapshot()` per device (merging raw numbers
with the plugin-registered type definition) → `onTick` → `runPipeline()` →
Store → widgets. The backend deliberately knows *nothing* about
thresholds, units, labels, or icons — it sends identity + raw sensor
numbers only, and the frontend's plugin layer supplies the rest. That
split is the whole point: it's what lets a device type be defined once, in
one plugin, and work identically whether its values come from the
simulator or the backend.

All three consumers share their HTTP plumbing through **`js/core/http.js`**
(`HLM.http.fetchWithTimeout`, `HLM.http.deriveEndpoint`) rather than
re-implementing abort-timeout and URL-derivation three times. Everything
that reaches the backend over HTTP from the frontend's *own* code goes
through that one module; the only fetches that don't are inside sandboxed
plugins, which by design depend on the SDK surface, not core internals.

### Automatic fallback and reconnect

`engine.js` already had a fallback threshold from Phase 3 (three
consecutive failed polls → switch to simulation), but it only ever went
one direction: nothing was left running that could notice the backend
come back, because the failing `ApiProvider` gets `.stop()`ped the moment
fallback happens. `js/engine/connection-manager.js` closes that gap with
an independent heartbeat against `/health` (the cheap liveness probe,
not `/api/dashboard`) that starts *only* while a fallback is active and
stops itself the instant it succeeds.

`engine.js` tracks "preferred" and "currently active" provider
separately so this stays correct under a subtlety that matters: an
*internal* fallback switch must never overwrite what the user (or
config) actually asked for, or a recovered backend would have nothing to
reconnect *to*. `switchProvider(name, { manual })` — `manual: true`
(the default, for any explicit call) updates what's preferred and cancels
any pending heartbeat; `manual: false` (only used by the fallback/
recovery paths themselves) does neither.

Verified live end-to-end, not just by reading the code: the backend
process was killed mid-session and the frontend fell back to simulation
automatically; it was then restarted and the frontend reconnected
automatically — both with zero page reload. See `PROJECT_STATE.md`.

### Backend self-monitoring

"Sentinel should monitor itself before monitoring anything else."
`GET /api/system` reports real process CPU%/memory% (`psutil`), uptime,
live database/scheduler status, and exact registry counts — not
estimates. `js/engine/backend-health.js` polls it independently of
whichever `DataProvider` is active (useful even while fully simulated)
and Settings' "Backend Health" widget renders it, showing an honest
"Backend unreachable" state rather than stale data when there's nothing
to poll.

## Known Limitations (honesty over polish)

- Data is simulated by default. There is no real Proxmox/Docker/Ollama/
  Home Assistant/Pi-hole integration behind those example plugins yet —
  see `docs/roadmap.md`. Minecraft and generic HTTP/reachability checks
  are real as of Phase 4, but only for device instances explicitly
  marked `monitored: true`.
- CPU/RAM/disk are never real for any device — that needs a local agent,
  which the `system` sensor provider is ready for but nothing ships yet.
- A backend foundation exists (Phase 5.1, `backend/`) but nothing streams
  from it yet. `ApiProvider`/`WebSocketProvider` are structurally complete
  on the frontend and the server now has endpoints to call, but the two
  are not wired together — that's real business logic, deferred past the
  architecture-only scope of Phase 5.1.
- There is no persistence beyond `localStorage` for plugin-scoped settings.
  Refreshing the page resets the simulated fleet's history buffers (and
  the live monitoring scheduler's in-memory state).
- There is no authentication. Anyone who can open the page can see and
  interact with everything (Phase 9).
