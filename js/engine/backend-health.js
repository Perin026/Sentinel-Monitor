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
      return HLM.http.deriveEndpoint(dashboardUrl, "/api/system");
    } catch(err){
      return null;
    }
  }

  async function poll(url, intervalMs){
    if(!active) return;
    try{
      const res = await HLM.http.fetchWithTimeout(url);
      HLM.store.set({ backendHealth: await res.json() });
    } catch(err){
      HLM.store.set({ backendHealth: null }); // honestly "unknown/unreachable", not stale data
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
