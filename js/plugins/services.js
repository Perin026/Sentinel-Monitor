/* =====================================================================
   SERVICES — the stable interface layer between plugins and core
   internals. A plugin that wants to show a toast calls
   ctx.services.notifications.notify(...), never HLM.ui.toast(...)
   directly — that indirection is what lets the toast implementation
   change later without every plugin breaking.
   ===================================================================== */
(function(HLM){
  "use strict";

  const NotificationService = {
    /** Fans out to every registered notification provider, plus the built-in in-app one. */
    notify({ title, message = "", level = "info" }){
      HLM.ui.pushNotification({ title, message, level });
      if(level === "critical" || level === "warn"){
        HLM.ui.toast({ title, message, level });
      }
      HLM.registries.notificationProviders.list().forEach(({ value: provider }) => {
        try{ provider.send?.({ title, message, level }); }
        catch(err){ console.error("[NotificationService] provider failed:", err); }
      });
    },
  };

  const STORAGE_PREFIX = "hlm.plugin.";
  const StorageService = {
    /** Namespaced per-plugin so two plugins can't collide on the same key. */
    scoped(pluginId){
      const ns = `${STORAGE_PREFIX}${pluginId}.`;
      return {
        get(key, fallback = null){
          try{ const raw = localStorage.getItem(ns + key); return raw == null ? fallback : JSON.parse(raw); }
          catch(err){ return fallback; }
        },
        set(key, value){
          try{ localStorage.setItem(ns + key, JSON.stringify(value)); return true; }
          catch(err){ return false; }
        },
        remove(key){ localStorage.removeItem(ns + key); },
      };
    },
  };

  const HistoryService = {
    /** Read-only view onto a sensor's rolling history buffer. */
    getSensorHistory(deviceId, sensorKey){
      return HLM.store.get().devices[deviceId]?.sensors?.[sensorKey]?.history || [];
    },
    getDevice(deviceId){
      return HLM.store.get().devices[deviceId] || null;
    },
  };

  const settingsState = {}; // pluginId -> { key: value }
  const SettingsService = {
    scoped(pluginId){
      settingsState[pluginId] = settingsState[pluginId] || {};
      return {
        get(key, fallback = null){ return settingsState[pluginId][key] ?? fallback; },
        set(key, value){ settingsState[pluginId][key] = value; },
        all(){ return { ...settingsState[pluginId] }; },
      };
    },
  };

  const LoggingService = {
    scoped(pluginId){
      const tag = `[plugin:${pluginId}]`;
      return {
        info: (...args) => console.log(tag, ...args),
        warn: (...args) => console.warn(tag, ...args),
        error: (...args) => console.error(tag, ...args),
      };
    },
  };

  const CommandService = {
    execute(commandId, ...args){
      const command = HLM.registries.commands.get(commandId);
      if(!command) throw new Error(`Unknown command "${commandId}"`);
      return command.run(...args);
    },
    list(){
      return HLM.registries.commands.list();
    },
  };

  HLM.services = { notifications: NotificationService, storage: StorageService, history: HistoryService, settings: SettingsService, logging: LoggingService, commands: CommandService };
})(window.HLM = window.HLM || {});
