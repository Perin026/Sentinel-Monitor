/* =====================================================================
   PLUGIN MANAGER — the single point of contact between core and
   plugins. Nothing else in the app should import a plugin file
   directly; everything goes through here so lifecycle, sandboxing and
   status reporting stay centralized.
   ===================================================================== */
(function(HLM){
  "use strict";

  // Bumped when the plugin-facing API shape changes in a breaking way.
  // Plugins declare `minCoreVersion` and are marked incompatible if
  // this is lower than what they require.
  const CORE_API_VERSION = "1.0.0";

  function parseVersion(v){
    const [major = 0, minor = 0, patch = 0] = String(v).split(".").map(n => parseInt(n, 10) || 0);
    return { major, minor, patch };
  }

  /** true if `have` is greater than or equal to `need` */
  function versionSatisfies(have, need){
    const a = parseVersion(have), b = parseVersion(need);
    if(a.major !== b.major) return a.major > b.major;
    if(a.minor !== b.minor) return a.minor > b.minor;
    return a.patch >= b.patch;
  }

  const REGISTRY_NAMES = Object.keys(HLM.registries);

  const plugins = new Map(); // id -> { manifest, status, error, ctx }

  function buildContext(pluginId){
    const bind = (registryName) => (id, value) => HLM.registries[registryName].register(id, value, pluginId);
    return {
      pluginId,
      core: { version: CORE_API_VERSION },
      registerDevice: bind("deviceTypes"),
      registerWidget: bind("widgets"),
      registerPage: bind("pages"),
      registerProvider: bind("dataProviders"),
      registerSensorProvider: bind("sensorProviders"),
      registerCommand: bind("commands"),
      registerNotificationProvider: bind("notificationProviders"),
      registerSettingsPanel: bind("settingsPanels"),
      registerAction: bind("actions"),
      registerHealthCalculator: bind("healthCalculators"),
      registerAlertRule: bind("alertRules"),
      registerBackgroundTask: bind("backgroundTasks"),
      registerTheme: bind("themes"),
      registerTranslation: bind("translations"),
      registerIcon: bind("icons"),
      services: {
        notifications: HLM.services.notifications,
        storage: HLM.services.storage.scoped(pluginId),
        history: HLM.services.history,
        settings: HLM.services.settings.scoped(pluginId),
        logging: HLM.services.logging.scoped(pluginId),
        commands: HLM.services.commands,
      },
    };
  }

  function validate(manifest){
    if(!manifest || typeof manifest !== "object") return "Plugin manifest must be an object";
    if(!manifest.id) return "Plugin is missing required field: id";
    if(!manifest.name) return "Plugin is missing required field: name";
    if(!manifest.version) return "Plugin is missing required field: version";
    if(typeof manifest.setup !== "function") return "Plugin is missing required field: setup(ctx)";
    if(plugins.has(manifest.id)) return `A plugin with id "${manifest.id}" is already registered`;
    return null;
  }

  function missingDependencies(manifest){
    return (manifest.dependencies || []).filter(depId => {
      const dep = plugins.get(depId);
      return !dep || dep.status !== "enabled";
    });
  }

  /**
   * Registers and immediately loads+enables a plugin. Returns the
   * plugin's status record. Never throws — failures are captured in
   * the returned/stored status instead (Step 10: sandboxing).
   */
  function register(manifest){
    const validationError = validate(manifest);
    if(validationError){
      const record = { manifest: manifest || {}, status: "failed", error: validationError };
      if(manifest?.id) plugins.set(manifest.id, record);
      return record;
    }

    const record = { manifest, status: "loaded", error: null, ctx: buildContext(manifest.id) };
    plugins.set(manifest.id, record);

    if(manifest.minCoreVersion && !versionSatisfies(CORE_API_VERSION, manifest.minCoreVersion)){
      record.status = "incompatible";
      record.error = `Requires core >= ${manifest.minCoreVersion}, running ${CORE_API_VERSION}`;
      return record;
    }

    const missing = missingDependencies(manifest);
    if(missing.length){
      record.status = "missing-dependency";
      record.error = `Missing dependencies: ${missing.join(", ")}`;
      return record;
    }

    runIsolated(record, () => manifest.setup(record.ctx));
    if(record.status === "loaded") record.status = "enabled";
    return record;
  }

  /** Runs a plugin hook, catching any exception and recording it as a failure — never propagates. */
  function runIsolated(record, fn){
    try{
      fn();
    } catch(err){
      record.status = "failed";
      record.error = err?.message || String(err);
      console.error(`[PluginManager] "${record.manifest.id}" threw during lifecycle:`, err);
    }
  }

  function disable(pluginId){
    const record = plugins.get(pluginId);
    if(!record || record.status !== "enabled") return false;
    runIsolated(record, () => record.manifest.disable?.(record.ctx));
    REGISTRY_NAMES.forEach(name => HLM.registries[name].unregisterAllBy(pluginId));
    if(record.status !== "failed") record.status = "disabled";
    return true;
  }

  function enable(pluginId){
    const record = plugins.get(pluginId);
    if(!record || record.status !== "disabled") return false;
    runIsolated(record, () => record.manifest.setup(record.ctx));
    if(record.status !== "failed") record.status = "enabled";
    return true;
  }

  function unload(pluginId){
    const record = plugins.get(pluginId);
    if(!record) return false;
    if(record.status === "enabled") disable(pluginId);
    plugins.delete(pluginId);
    return true;
  }

  function getStatus(pluginId){
    const record = plugins.get(pluginId);
    if(!record) return null;
    return {
      id: pluginId,
      status: record.status,
      error: record.error,
      name: record.manifest.name,
      version: record.manifest.version,
      author: record.manifest.author,
      description: record.manifest.description,
    };
  }

  function list(){
    return [...plugins.keys()].map(getStatus);
  }

  HLM.pluginManager = { register, enable, disable, unload, getStatus, list, CORE_API_VERSION };
})(window.HLM = window.HLM || {});
