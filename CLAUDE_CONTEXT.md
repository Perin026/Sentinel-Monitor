# Claude Context

A working-notes document for an AI agent (or a human) picking up this
project cold. `PROJECT_STATE.md` says *where the project is*; this says
*what you need to know before you touch it*. Read both before writing code
— per the project's own [Future Development Policy](docs/roadmap.md#future-development-policy),
this file and `PROJECT_STATE.md` are living documents and get updated in
the same commit as any change that makes them stale.

## The one constraint that shapes everything

**Sentinel Monitor is a zero-backend static page, on purpose** — open
`index.html`, no build step, no `npm install`. See
[`docs/architecture.md`](docs/architecture.md#why-no-framework) for the
full reasoning. This is not incidental; it's the project's core identity.

That constraint has a sharp edge: a browser cannot open a raw ICMP or TCP
socket, and it cannot read another machine's CPU/RAM/disk without
something running on that machine to ask. Any future phase that wants
"real" ping, real SNMP, or real host metrics needs one of:
1. A browser-safe approximation, clearly labeled as one (see Phase 4's
   `ping` sensor provider — HTTP(S)/no-cors timing, not ICMP).
2. A real backend the browser can `fetch()` from (Phase 5 on the roadmap).
3. A local agent the target machine runs (the `system` sensor provider's
   approach — structurally complete, honestly reports "unreachable" until
   an agent exists, exactly like `ApiProvider` already did for Phase 5).

Don't quietly reach for a Node.js backend or a browser extension to solve
this without flagging it — it's a bigger architectural pivot than it
looks, and the project has explicitly deferred that to Phase 5.

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

## Testing

No committed test suite yet (see `docs/developer-guide.md`). For Phase 4
specifically, the most useful verification is running the app in a real
browser and watching Settings → Live Monitoring plus the browser console
for a couple of poll cycles — static analysis can't tell you whether a
sensor provider's chosen target actually behaves under real network
conditions (see the rate-limit story above).
