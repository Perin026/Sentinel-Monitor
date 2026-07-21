# API Contract

The official contract between Sentinel Core Server (`backend/`) and any
client — the web dashboard (`js/`) is the first client, not a privileged
one. This document exists so a future desktop app, mobile app, or CLI
(see `CLAUDE_CONTEXT.md`'s framing of the frontend as *a* client, not
*the* server) can be built against this contract without reading either
codebase.

Every response, success or error, is a typed Pydantic schema
(`backend/app/schemas/`) — nothing here is "whatever the ORM happened to
serialize."

## Every concept, mapped to an endpoint (or explicitly not one)

| Concept | Endpoint | Notes |
|---|---|---|
| Dashboard | `GET /api/dashboard` | The one endpoint `ApiProvider` polls. Devices + their sensor values, nothing else. |
| Devices | embedded in `/api/dashboard`'s `devices` map | Not a separate CRUD resource yet — there's no create/update/delete use case until real collectors exist (Phase 6+). |
| Sensors | embedded per-device, `device.sensors: {key: value}` | Raw numbers only — no label/unit/threshold. See "What the backend deliberately doesn't know" below. |
| Groups | **not a backend concept** | `group` (which nav view a device appears under) is resolved entirely on the frontend from `HLM.registries.deviceTypes` — plugin configuration, not backend-owned fact. |
| Alerts | **not served — derived on the frontend** | `js/engine/alert-engine.js` computes alerts from device/sensor state on every tick, unchanged since Phase 3. Centralizing alert state on the backend is real business logic (persistence, multi-client consistency) that's explicitly out of scope for this phase — see `PROJECT_STATE.md`. |
| Events | **not served — derived on the frontend** | Same reasoning as Alerts; `js/engine/event-engine.js` is unchanged. |
| Plugins | `GET /api/plugins` | The **backend's own** plugin registry (`backend/app/plugins/`) — collectors, notification providers, etc. Entirely separate from the frontend's `HLM.pluginManager`, which has no HTTP surface and never will; it's client-side by design. |
| Settings | `GET /api/settings` | The **backend's own** configuration (secret-stripped). Unrelated to the frontend's `HLM.config`, which stays a local JS object. |
| Health | `GET /health` (liveness), `GET /api/health` (readiness) | Liveness: "is the process responding, no dependency checks." Readiness: database/scheduler/websocket/plugins, each individually reported. |
| History | **not implemented** | `HistoryService` raises `NotImplementedError` on purpose (see `backend/README.md`). Explicitly out of scope for this phase. |
| Version | `GET /api/version` | Backend's own app/API version — distinct from the frontend's `HLM.config.APP.version`. |
| Errors | every non-2xx response | One envelope shape (`ErrorResponse`, `backend/app/schemas/common.py`) regardless of cause — see `backend/app/core/exceptions.py`. |
| Status | `/health` + `/api/health` (backend-side); `HLM.store.get().connection` (frontend-side) | Two different "status" concepts on purpose: the backend's own health, and the frontend's read on *its connection* to a data source (`"simulated" \| "live" \| "reconnecting"`) — the latter existed since Phase 3 and is unchanged. |

## `GET /api/dashboard`

```json
{
  "devices": {
    "backend-demo-linux": {
      "id": "backend-demo-linux",
      "name": "backend-demo-linux",
      "type": "linux",
      "hostname": "demo-linux.internal",
      "ip": "10.10.0.11",
      "status": "ok",
      "maintenance": false,
      "booted_at": 1784654915915,
      "sensors": { "cpu": 32.5, "ram": 46.0, "storage": 44.0, "temp": 49.4 }
    }
  },
  "timestamp": 1784662116011
}
```

`booted_at` and `timestamp` are epoch milliseconds (matches JS `Date.now()`
directly — no client-side date parsing). `ApiProvider` overwrites
`timestamp` with its own `Date.now()` on receipt to avoid client/server
clock skew feeding into `lastTick` arithmetic; the backend's value is
carried for logging/latency debugging only.

### What the backend deliberately doesn't know

A sensor's `label`, `unit`, `warn`/`critical` thresholds, and a device's
`icon`/`group` are **frontend plugin configuration**
(`HLM.registries.deviceTypes`, see `js/plugins/builtin/core-devices.js`),
not backend-owned fact — see `backend/app/models/device.py`'s docstring.
The backend reports `type: "linux"` and `sensors: {cpu: 32.5}`; the
frontend's `hydrateFromSnapshot()` (`js/engine/device-model.js`) is what
resolves `"linux"` against the plugin that registered it and merges in
everything the backend never had to know. This keeps the backend
independent of frontend plugin implementation, and vice versa — either
side's plugin set can change without the other needing to know.

### Why the data is synthetic

Phase 5.2 explicitly excludes real collectors (Docker/Proxmox/Minecraft/
Ollama/SNMP — later phases). `DashboardService` seeds a handful of demo
devices using *generic* frontend-builtin types (`linux`/`windows`/`nas`,
not a vendor-specific plugin) and jitters their values slightly on each
read — enough to prove the full round trip (DB → API → frontend hydration
→ Store → widgets, all with data that actually changes over time) without
pretending to monitor anything real. See
`backend/app/services/dashboard_service.py`'s docstring.

## Data flow, end to end

1. `js/engine/engine.js` starts whichever `DataProvider` `HLM.config.APP.dataProvider`
   names (`"simulation"` by default, unchanged — see `CLAUDE_CONTEXT.md`
   for why the default doesn't change in this phase).
2. If `"api"`: `ApiProvider` (`js/engine/data-provider.js`) polls
   `GET /api/dashboard` on `HLM.config.APP.refreshMs`, with a per-request
   timeout and short in-poll retry before reporting `"reconnecting"`.
3. Each raw device in the response is hydrated via
   `HLM.deviceModel.hydrateFromSnapshot()` — the exact same `def`-merge
   `hydrateDevice()` already does for the static `config.js` seed list,
   just fed real values instead of random ones.
4. The hydrated snapshot is handed to `engine.js`'s `runPipeline()`
   **completely unchanged** from the simulation path: health engine,
   alert engine, event engine, history engine all run exactly as before.
5. `HLM.store.set(...)` — same call site, same shape, regardless of
   which provider produced the tick.
6. Every widget re-renders from the store exactly as it always has. No
   widget, component, or engine file changed to make this work.

## Error handling

`ApiProvider` never lets a fetch failure reach `runPipeline()`. A
malformed response, a timeout, a non-2xx status, or a network error all
result in `onStatus("reconnecting")` and the tick is skipped — the store
keeps its last-known-good state rather than rendering partial/garbage
data. See `js/engine/data-provider.js` for the retry/timeout mechanics
and `PROJECT_STATE.md` for how this was verified.
