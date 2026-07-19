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

  /** Sugar for the common "sensor with warn/critical thresholds" shape. */
  function defineSensor({ key, label, unit = "", min = 0, max = 100, warn = null, critical = null, weight = 1, volatility = 2, invert = false }){
    return { key, label, unit, min, max, warn, critical, weight, volatility, invert };
  }

  HLM.sdk = { createPlugin, defineDeviceType, defineSensor };
  HLM.createPlugin = createPlugin; // top-level convenience, matches the brief's `createPlugin()`
})(window.HLM = window.HLM || {});
