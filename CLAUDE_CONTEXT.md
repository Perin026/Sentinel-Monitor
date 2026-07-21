# Claude Context

A working-notes document for an AI agent (or a human) picking up this
project cold. `PROJECT_STATE.md` says *where the project is*; this says
*what you need to know before you touch it*. Read both before writing code
— per the project's own [Future Development Policy](docs/roadmap.md#future-development-policy),
this file and `PROJECT_STATE.md` are living documents and get updated in
the same commit as any change that makes them stale.

## The one constraint that shapes everything

**The frontend is a zero-backend static page, on purpose** — open
`index.html`, no build step, no `npm install`, and that stays true even
now that `backend/` exists. See
[`docs/architecture.md`](docs/architecture.md#why-no-framework) for the
full reasoning. This is not incidental; it's the frontend's core identity,
and it's *why* the backend (Phase 5.1) was designed the way it was: a
completely independent service the frontend can optionally point at, not
something the frontend now requires to run. Don't let backend work leak a
build step, an API dependency, or any other requirement into `index.html`
opening standalone — that would break the one property this project has
protected since Phase 1.

The frontend running standalone has a sharp edge: a browser cannot open a
raw ICMP or TCP socket, and it cannot read another machine's CPU/RAM/disk
without something running on that machine to ask. Any phase that wants
"real" ping, real SNMP, or real host metrics needs one of:
1. A browser-safe approximation, clearly labeled as one (see Phase 4's
   `ping` sensor provider — HTTP(S)/no-cors timing, not ICMP).
2. A real backend the browser can `fetch()` from — `backend/` now exists
   and `ApiProvider` genuinely renders its data (Phase 5.2), though
   `"simulation"` stays the default until Milestone 5.2.2's fallback
   exists.
3. A local agent the target machine runs (the `system` sensor provider's
   approach on the frontend, and `app/collectors/base.py` on the backend
   — both structurally complete, honestly report "unreachable"/raise
   `NotImplementedError` until an agent exists).

Don't quietly reach for a Node.js backend or a browser extension to solve
this — `backend/` is the answer now, use it (once wired).

## Load order is the dependency graph

There's no bundler. `index.html`'s `<script>` tag order **is** correctness.
See [`docs/developer-guide.md`](docs/developer-guide.md#making-sense-of-load-order)
for the full ordering rules. The short version: core → plugin architecture
→ components → plugins (builtin, then examples) → engine → `app.js` last.
If you add a file that reads another module's exports at its own
top-level execution time (not deferred inside a function), it must load
after that module. When in doubt, defer the lookup into a function body
instead of fighting load order — that's the established pattern (see
`device-model.js`).

## Everything is `HLM.*`

One global. `HLM.registries.*` for extension points, `HLM.services.*` for
the plugin-facing API, `HLM.ui.*` for renderers. Don't introduce a second
top-level global, ever, even for something that feels "internal."

## Extension points added in Phase 4

- `HLM.registries.sensorProviders` — a registry exactly like
  `dataProviders`, but for *per-sensor* poll strategies rather than
  whole-device snapshot sources. Registered via
  `ctx.registerSensorProvider(id, { poll(seed, sensorDef) })`.
- `HLM.sdk.defineMonitor({...})` — normalizes a sensor's live-poll config.
  Used inside `defineSensor({ ..., monitor: {...} })`.
- `HLM.monitoringScheduler` (`js/engine/monitoring-scheduler.js`) — the
  thing that actually calls `provider.poll()` on a schedule. Read its
  file header before changing it; the per-sensor chained-`setTimeout`
  design (not `setInterval`) is deliberate — it's what stops a slow poll
  from overlapping itself.
- `HLM.historyEngine` (`js/engine/history-engine.js`) — one rolling-buffer
  shape (`{t,v}` samples), shared by simulated and live sensors alike, so
  a future charting layer only needs to handle one format.

## The two-flag opt-in for live monitoring (read this before adding a device)

A sensor only actually gets polled if **both** are true:
1. Its *type definition* (in a plugin) has a `monitor` config on that
   sensor — this is shared by every device of that type.
2. Its *device instance* (its seed in `js/core/config.js`'s `DEVICES`
   array) has `monitored: true` — this is per-device.

This split exists because device types are shared (every `"minecraft"`
device uses the same sensor defs) but only some *instances* point at
something real. If you add a device that should be genuinely monitored,
you need `monitored: true` on its seed — a `monitor` config on the type
alone does nothing for devices that don't opt in. Conversely, if you add
a `monitor` config to an existing shared device type (like Phase 4 did to
`minecraft`'s `players` sensor), audit every existing device of that type
before shipping — you don't want to accidentally start polling a
fictional demo device's fake `.lan` hostname.

## Picking a demo/target host

If you ever add a device that polls something real, prefer high-capacity,
public-by-design endpoints (status-page APIs, CDN edge IPs) over
authenticated/rate-limited REST APIs. Phase 4 originally pointed the
`http-endpoint` demo at `api.github.com` and got rate-limited (60 req/hr
unauthenticated) within minutes of normal polling — moved to
`www.githubstatus.com` (a Statuspage API, built for exactly this kind of
frequent public polling) and Cloudflare's `1.1.1.1` for the reachability
probe. Verify this kind of choice by actually running the app and
watching the console for a few poll cycles, not just by reading the code.

## Status vocabulary — don't invent a second one

Device/sensor *health* status is `ok | warn | critical | offline |
maintenance | unknown` (see `health-engine.js`) and CSS only has classes
for those plus `paused` (badge.css). Phase 4's monitored sensors also
carry a **separate** `monitorStatus` field — `unknown | up | down |
paused` — describing poll connectivity, not threshold health. These are
intentionally different axes (a sensor can be `up` and still `warn` if
its real value crossed a threshold). If you touch this, keep them
separate; don't collapse `monitorStatus` values into `sensor.status`
directly, map them through a lookup at render time instead (see
`MONITOR_CSS_STATUS` in `device-card.js`).

## Backend (Phase 5.1) — read this before touching `backend/`

- **It mirrors the frontend's plugin architecture on purpose.**
  `backend/app/plugins/registry.py` and `manager.py` are independent
  implementations of the same shape as `js/plugins/registry.js` /
  `plugin-manager.js` — same isolate-on-failure guarantee
  (`_run_isolated`), same generic-registry-not-sixteen-bespoke-classes
  reasoning. If you're adding a backend extension point, check how the
  frontend solved the equivalent problem first; don't invent a different
  pattern for no reason.
- **`NotImplementedError`, not empty data, for unbuilt features.**
  `HistoryService`/`AuthenticationService` raise on purpose — see
  `backend/README.md`'s "What's real vs. a documented seam" table. If you
  implement one of these for real, that's the file to change; don't leave
  the raise in place "just in case."
- **SQLite needs its parent directory to exist before you can connect —
  it won't create one.** `app/database/session.py`'s
  `ensure_sqlite_directory_exists()` handles the app's own engine.
  Alembic's `migrations/env.py` builds a *separate* engine and needed the
  identical fix applied there too — this was a real bug caught only by
  actually running `alembic revision --autogenerate`, not by reading the
  code. If you add another place that connects to the database directly
  (a script, a one-off tool), call that same function first.
- **The custom YAML/JSON config sources are `pydantic-settings`
  extension points**, not a hand-rolled merge (`app/config/loader.py`).
  If `Settings` gains a field that needs special parsing from a file
  (nested objects, etc.), extend `FileConfigSource`, don't bypass it with
  manual `yaml.safe_load()` calls scattered elsewhere.
- **The backend was actually run to verify this phase**, not just
  reviewed — see `PROJECT_STATE.md`'s "How Phase 5.1 was verified" for
  what that caught. If you change something foundational here (the
  database layer, the app factory, config loading), the bar is the same:
  boot it and hit the endpoints, don't just read the diff.
- **`get_session()` commits automatically on a clean return, rolls back
  on exception** — this wasn't true until Phase 5.2 (a real bug: writes
  silently never persisted). Route/service code should never call
  `session.commit()` itself; that's `get_session()`'s job, in exactly
  one place.

## Frontend ↔ Backend Integration (Phase 5.2) — read this before touching either side's data flow

- **`ApiProvider` is a thin adapter, not a parallel pipeline.** It fetches
  `/api/dashboard`, calls `HLM.deviceModel.hydrateFromSnapshot()` per
  device, and hands the result to the exact same `onTick` callback
  `SimulationProvider` uses. If you're tempted to special-case "when the
  provider is api" anywhere downstream of that (the Store, an engine
  file, a widget), stop — that's exactly the coupling this phase exists
  to prove doesn't need to happen. See `docs/api-contract.md`.
- **The backend doesn't know sensor thresholds, units, or labels — on
  purpose.** `hydrateFromSnapshot()` resolves those from
  `HLM.registries.deviceTypes` (frontend plugin config), the same lookup
  `hydrateDevice()` uses for the simulated seed list. A raw device from
  the backend only ever needs `type` + raw sensor numbers. Don't add
  presentation fields to `app/models/device.py` or the dashboard schema
  — see that model's docstring for why.
- **Any code that assumes the live device count equals
  `HLM.config.DEVICES.length` is a latent bug.** That equality only ever
  held because `SimulationProvider`'s fleet *is* that array. It broke
  twice in one milestone (Overview/Settings widgets, and
  `mountDeviceGroupView`'s never-pruned device cards) the instant
  `ApiProvider` reported a different count — see `PROJECT_STATE.md`'s
  Milestone 5.2.1 section. If you add a new widget or view that reads
  `HLM.config.DEVICES` directly instead of `HLM.store.get().devices`,
  you're probably reintroducing this.
- **Test both directions of a provider switch, not just one.** Switching
  simulation → api once isn't enough evidence a fix works — the
  device-card-pruning bug above only fully proved itself fixed by
  switching back to simulation afterward and confirming the cards
  correctly reappeared (see `PROJECT_STATE.md`).

## Testing

Frontend: no committed test suite yet (see `docs/developer-guide.md`).
For Phase 4 specifically, the most useful verification is running the app
in a real browser and watching Settings → Live Monitoring plus the
browser console for a couple of poll cycles — static analysis can't tell
you whether a sensor provider's chosen target actually behaves under real
network conditions (see the rate-limit story above).

Backend: `pytest` (`backend/tests/`), each test against its own in-memory
SQLite database. Run with `python -m pytest -v` from `backend/`.
