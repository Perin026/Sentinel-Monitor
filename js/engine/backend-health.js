/* =====================================================================
   BACKEND HEALTH — polls the backend's own self-monitoring endpoint
   (GET /api/system — see backend/app/api/routes/system.py) and publishes
   the result to the Store. "Sentinel should monitor itself before
   monitoring anything else" (Phase 5.2): this runs unconditionally,
   independent of which DataProvider is active — even while fully on
   SimulationProvider, Settings can still show whether a real backend is
   reachable and how it's doing.

   Kept separate from connection-manager.js on purpose: that module
   answers "can we reach the backend, how fast" (connectivity), this one
   answers "how is the backend itself doing" (self-monitoring) — two
   different concerns the Phase 5.2 brief lists separately (Steps 5 and 7).

   Never lets a widget fetch this directly — same reasoning as
   ApiProvider owning all HTTP for dashboard data.
   ===================================================================== */
(function(HLM){
  "use strict";

  let timer = null;
  let active = false;

  function systemUrlFor(dashboardUrl){
    try{
      const url = new URL(dashboardUrl, window.location.href);
      url.pathname = "/api/system";
      url.search = "";
      return url.toString();
    } catch(err){
      return null;
    }
  }

  async function poll(url, intervalMs){
    if(!active) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try{
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      HLM.store.set({ backendHealth: data });
    } catch(err){
      HLM.store.set({ backendHealth: null }); // honestly "unknown/unreachable", not stale data
    } finally {
      clearTimeout(timeoutId);
    }
    if(active) timer = setTimeout(() => poll(url, intervalMs), intervalMs);
  }

  /** @param {string} dashboardUrl  HLM.config.APP.dataUrl — this derives /api/system from it */
  function start(dashboardUrl, intervalMs = 8000){
    if(active) return;
    const url = systemUrlFor(dashboardUrl);
    if(!url) return;
    active = true;
    poll(url, intervalMs);
  }

  function stop(){
    active = false;
    clearTimeout(timer);
  }

  HLM.backendHealth = { start, stop };
})(window.HLM = window.HLM || {});
