/* =====================================================================
   STORE — tiny observable store for state that multiple, unrelated
   parts of the UI need to read ("is the sidebar collapsed", "how many
   unread notifications are there"). One-off UI state that only a
   single component cares about (a dropdown's open/closed flag) should
   stay local to that component instead of living here.
   ===================================================================== */
(function(HLM){
  "use strict";

  function createStore(initial){
    let state = { ...initial };
    const listeners = new Set();

    function get(){ return state; }

    function set(patch){
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach(fn => {
        try{ fn(state); }
        catch(err){ console.error("[HLM.store] listener threw:", err); }
      });
    }

    /**
     * @param {function} fn        called with the full state on every change
     * @param {function} [select]  optional selector; fn only fires when the
     *                              selected slice changes (by reference/value).
     *                              fn always receives the full state, never
     *                              the selected slice — select only gates
     *                              *when* fn runs, not what it's given.
     */
    function subscribe(fn, select){
      if(!select) { listeners.add(fn); return () => listeners.delete(fn); }
      let prev = select(state);
      const wrapped = (s) => {
        const next = select(s);
        if(next !== prev){ prev = next; fn(s); }
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    }

    return { get, set, subscribe };
  }

  HLM.store = createStore({
    // shell
    activeView: "overview",
    sidebarCollapsed: false,
    mobileNavOpen: false,
    connection: "simulated",   // "simulated" | "live" | "reconnecting"
    bootTime: Date.now(),

    // connection quality (Phase 5.2) — written by js/engine/connection-manager.js,
    // meaningful only while connection is "live"/"reconnecting" (ApiProvider active
    // or attempting to be)
    connectionLatencyMs: null,     // number | null
    connectionQuality: "unknown",   // "good" | "fair" | "poor" | "unknown"
    backendHealth: null,             // SystemInfoResponse | null — see js/engine/backend-health.js

    // notifications / toasts (Phase 2 UI slices)
    notifications: [],         // { id, title, message, level, read, timestamp }
    toasts: [],

    // monitoring engine (Phase 3)
    devices: {},                // id -> hydrated device (see js/engine/device-model.js)
    alerts: [],                  // active + resolved alert records
    events: [],                   // live event timeline, newest first, capped
    systemHealth: { score: 100, status: "ok" },
    lastTick: 0,
  });
})(window.HLM = window.HLM || {});
