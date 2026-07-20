# Project State

> **This is a living document**, updated at the end of every phase
> alongside `docs/roadmap.md` and `CLAUDE_CONTEXT.md` — see the
> [Future Development Policy](docs/roadmap.md#future-development-policy).
> If something here doesn't match the code, that's a documentation bug.

## Where things stand

**Current version:** `0.5.0-alpha`
**Last completed phase:** Phase 4 — Real Monitoring Engine

A note on numbering: the roadmap drafted after Phase 3.5 originally
scoped its *next* phase as "Visualization Framework" (charts, topology
maps — see `docs/roadmap.md`'s history). The Phase 4 actually executed
was a different brief: a real, pollable monitoring engine — closer in
spirit to what that same roadmap had filed under Phase 5/6. That's a
legitimate reordering (a monitoring platform needs real data flowing
before it needs charts of that data), but it means "Phase 4" in commit
history refers to *this* work, not the originally-planned visualization
phase. That's now folded back into the roadmap below as still-upcoming.

## What's real vs. simulated right now

Two devices in the fleet are genuinely live-polled (see
`js/core/config.js`'s `DEVICES`, entries with `monitored: true`):

| Device | What's real |
|---|---|
| `mc-public-demo` (Hypixel Network) | Player count, online status, MOTD, version — via the public `mcsrvstat.us` API, which speaks real Minecraft Server List Ping server-side |
| `http-demo` (GitHub Status) | HTTP response code/time against `www.githubstatus.com`, and a reachability/latency probe against Cloudflare's `1.1.1.1` |

Every other device in the fleet (the original 20 from Phase 3) is
unchanged and fully simulated — Phase 4 didn't touch their behavior at
all. That's deliberate: `monitor` configs exist on some shared device
*types* now (e.g. `minecraft`'s `players` sensor), but only an instance
with `monitored: true` on its config seed actually gets polled. See
`CLAUDE_CONTEXT.md` for why that split exists.

CPU/RAM/Disk sensors are **never** real for any device, including the two
monitored ones — that would require an agent running on the target
machine (the `system` sensor provider exists for this, structurally
complete, but nothing ships an agent yet). This is the same honesty
`ApiProvider`/`WebSocketProvider` already modeled in Phase 3: present,
correct, and inert until something real exists on the other end.

## Phase 4 — what was built

- **Sensor Provider registry & SDK** — a new pluggable extension point
  (`HLM.registries.sensorProviders`, `ctx.registerSensorProvider()`,
  `HLM.sdk.defineMonitor()`), following the exact same pattern every
  other registry in the app uses.
- **Four sensor providers**: `ping` (HTTP/no-cors reachability + latency
  + rough packet loss), `http` (real response code/time), `system`
  (structurally-complete local-agent poller), `dummy` (synthetic, for
  exercising the scheduler). Plus a fifth, service-specific one:
  `minecraft`, registered by the Minecraft plugin itself, via the public
  `mcsrvstat.us` API.
- **Monitoring Scheduler** (`js/engine/monitoring-scheduler.js`) — one
  independently-rescheduling chain per (device, sensor) pair, concurrency
  capped at 6 in-flight polls, retry with backoff before declaring a
  sensor down, maintenance-aware pausing, failure logging.
- **History Engine** (`js/engine/history-engine.js`) — timestamped
  `{t,v}` rolling buffers, shared by simulated and live sensors, ready
  for a future graphing layer.
- **Status logic** — `unknown | up | down | paused` poll-health per
  sensor, layered on top of (not replacing) the existing
  `ok | warn | critical | offline | maintenance` threshold-health
  vocabulary. Zero changes to `health-engine.js`/`alert-engine.js`: a
  live sensor's real value flows through the exact same thresholding an
  ordinary simulated sensor uses, and a failed *primary* sensor sets
  `device.status = "offline"`, which health-engine already short-circuits
  on (the same mechanism the simulator's incident engine relies on).
- **Alerts foundation** — already fully satisfied by the existing
  `alert-engine.js` from Phase 3 (alert objects, severity, `acknowledged`,
  timestamps, `resolved` state, structural dedup). Nothing new was built
  here; it was audited against the Phase 4 brief and found complete.
  Delivery/notification channels are still explicitly out of scope
  (Phase 8+ territory per the roadmap).
- **Dashboard**: device cards show live values, per-monitored-sensor
  status/response-time/next-check, and a sensor count. Settings gained a
  "Live Monitoring" panel listing every polled sensor fleet-wide.

## Known limitations (honesty over polish)

- Real monitoring is opt-in per device instance and currently only
  configured for the two demo devices. There is no UI yet for a user to
  mark their own device `monitored: true` without editing `config.js`
  directly — same limitation Phase 3's "Add device" flow already had.
- `system` sensor provider has no agent to talk to. It will always report
  "down" until someone builds one (out of scope here; flagged for
  whoever picks up host-agent work).
- No graphing UI consumes the new timestamped history buffers yet — that
  remains genuinely future work (the *original* Phase 4 scope).
- No committed automated test suite (pre-existing limitation, unchanged;
  see `docs/developer-guide.md`).

## Immediate next phase

See `docs/roadmap.md` for the full list. The most natural next step given
what Phase 4 just built is either:
- **Visualization**: charts/graphs against the new timestamped history
  buffers (the originally-planned Phase 4 scope, now unblocked).
- **A real backend** (`ApiProvider`/`WebSocketProvider` finally getting
  something to talk to), which would also let a `system` agent's metrics
  flow through cleanly.
