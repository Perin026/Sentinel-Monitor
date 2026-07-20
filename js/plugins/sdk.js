/* =====================================================================
   SDK — sugar for plugin authors. A plugin file should never need to
   touch HLM.pluginManager, HLM.registries or HLM.services directly;
   everything it needs comes through here or through the `ctx` object
   passed to setup().
   ===================================================================== */
(function(HLM){
  "use strict";

  /**
   * Defines and immediately registers a plugin.
   *   HLM.createPlugin({
   *     id: "proxmox", name: "Proxmox VE", version: "1.0.0",
   *     author: "Sentinel Monitor", license: "MIT",
   *     description: "Proxmox VE hosts as a device type.",
   *     minCoreVersion: "1.0.0",
   *     setup(ctx){ ctx.registerDevice("proxmox", HLM.sdk.defineDeviceType({...})); }
   *   });
   * @returns the plugin's status record (see PluginManager.getStatus)
   */
  function createPlugin(manifest){
    return HLM.pluginManager.register(manifest);
  }

  /**
   * Normalizes a device-type definition so every plugin doesn't need
   * to remember the exact internal shape (Step 5: sensors, health
   * rules, icon, status calculation, actions, views).
   */
  function defineDeviceType({ label, icon = "server", group = "infrastructure", sensors = [], actions = [] }){
    return { label, icon, group, sensors, actions };
  }

  /**
   * Normalizes a sensor's live-polling configuration (Phase 4). A sensor
   * with no `monitor` stays purely simulated, exactly as before — this is
   * opt-in per sensor *definition*, and further gated per device *instance*
   * by that device's config seed needing `monitored: true` (see
   * js/engine/monitoring-scheduler.js). `primary` defaults to true: by
   * default, a failed poll on a monitored sensor takes the whole device
   * offline, matching how the simulation engine already treats incidents.
   */
  function defineMonitor({ provider, intervalMs = 30000, timeoutMs = 5000, retries = 2, primary = true, ...rest }){
    return { provider, intervalMs, timeoutMs, retries, primary, ...rest };
  }

  /** Sugar for the common "sensor with warn/critical thresholds" shape. */
  function defineSensor({ key, label, unit = "", min = 0, max = 100, warn = null, critical = null, weight = 1, volatility = 2, invert = false, monitor = null }){
    return { key, label, unit, min, max, warn, critical, weight, volatility, invert, monitor: monitor ? defineMonitor(monitor) : null };
  }

  HLM.sdk = { createPlugin, defineDeviceType, defineSensor, defineMonitor };
  HLM.createPlugin = createPlugin; // top-level convenience, matches the brief's `createPlugin()`
})(window.HLM = window.HLM || {});
