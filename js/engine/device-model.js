/* =====================================================================
   DEVICE MODEL — mechanics only. Every device *type* (its sensors,
   thresholds, icon, group) comes from HLM.registries.deviceTypes,
   populated by plugins (see js/plugins/builtin and js/plugins/examples).
   This file has no idea Proxmox, Docker or Minecraft exist.
   ===================================================================== */
(function(HLM){
  "use strict";

  const FALLBACK_TYPE = { label: "Unknown Device", icon: "server", group: "infrastructure", sensors: [
    { key: "cpu", label: "CPU", unit: "%", min: 0, max: 100, warn: 75, critical: 90, weight: 1, volatility: 2 },
  ] };

  /** Looks up a device type's definition, falling back gracefully if its plugin isn't loaded/enabled. */
  function typeDefinition(type){
    return HLM.registries.deviceTypes.get(type) || FALLBACK_TYPE;
  }

  /**
   * Turns a static config seed ({ id, name, type, hostname, ip }) into
   * a live runtime device: sensors initialized mid-range, status "ok",
   * empty history buffers ready for the simulator to fill. `group` and
   * sensor blueprints come from whichever plugin registered `type`.
   */
  function hydrateDevice(seed){
    const def = typeDefinition(seed.type);
    const sensors = {};
    def.sensors.forEach(sensorDef => {
      const mid = sensorDef.min + (sensorDef.max - sensorDef.min) * (sensorDef.invert ? 0.85 : 0.3 + Math.random() * 0.25);
      sensors[sensorDef.key] = {
        def: sensorDef,
        value: Math.round(mid * 10) / 10,
        status: "ok",
        history: [],
      };
    });

    return {
      id: seed.id,
      name: seed.name,
      type: seed.type,
      hostname: seed.hostname || "",
      ip: seed.ip || "",
      group: def.group,
      status: "ok",
      maintenance: false,
      incident: null,          // { kind: "offline"|"degraded", ticksRemaining }
      bootedAt: Date.now() - Math.floor(Math.random() * 30 * 86400000),
      lastCheck: Date.now(),
      sensors,
    };
  }

  /**
   * Phase 5.2 — turns one raw device from the backend's `/api/dashboard`
   * response (see docs/api-contract.md) into the exact same shape
   * `hydrateDevice()` produces for a simulated one. The backend only ever
   * sends fact it can honestly know (identity, reachability, raw sensor
   * numbers); this is where that gets merged with the plugin-registered
   * type definition (thresholds, units, labels, icon, group) — the same
   * `typeDefinition()` lookup `hydrateDevice()` uses, so a device type
   * only ever needs to be defined once, in one plugin, regardless of
   * which DataProvider is active.
   *
   * Field names are translated from the API's snake_case (`booted_at`) to
   * this codebase's camelCase on the way in — the one and only place that
   * translation happens, so nothing downstream needs to know the backend
   * uses a different naming convention than the frontend does.
   *
   * @param {object} raw  one entry from DashboardResponse.devices
   */
  function hydrateFromSnapshot(raw){
    const def = typeDefinition(raw.type);
    const sensors = {};
    def.sensors.forEach(sensorDef => {
      const rawValue = raw.sensors ? raw.sensors[sensorDef.key] : undefined;
      const value = typeof rawValue === "number" ? rawValue : sensorDef.min;
      sensors[sensorDef.key] = {
        def: sensorDef,
        value: Math.round(value * 10) / 10,
        status: "ok", // recomputed from value+thresholds by health-engine.js on this same tick
      };
    });

    return {
      id: raw.id,
      name: raw.name || raw.id,
      type: raw.type,
      hostname: raw.hostname || "",
      ip: raw.ip || "",
      group: def.group,
      status: raw.status || "ok",
      maintenance: !!raw.maintenance,
      incident: null,
      bootedAt: raw.booted_at ?? Date.now(),
      lastCheck: Date.now(),
      sensors,
    };
  }

  HLM.deviceModel = { typeDefinition, hydrateDevice, hydrateFromSnapshot };
})(window.HLM = window.HLM || {});
