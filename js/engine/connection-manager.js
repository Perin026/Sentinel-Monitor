/* =====================================================================
   CONNECTION MANAGER — owns everything about *reaching* a real backend
   that isn't "parse this specific response" (that's ApiProvider's job).

   The gap this exists to close: once engine.js falls back to
   SimulationProvider, the ApiProvider that was failing gets `.stop()`ped
   — nothing is polling the backend anymore, so nothing could ever notice
   it came back. This module's heartbeat is independent of whichever
   DataProvider is actually active specifically so "the backend recovered"
   can be noticed while simulation is running.

   Responsibilities:
     - Track consecutive success/failure and derive connection quality
       from measured latency (good/fair/poor/unknown)
     - A lightweight heartbeat against /health (the cheap liveness probe,
       not /api/dashboard — this only needs to know "is it up", not fetch
       real data) that runs only while a fallback is active
     - Publish connection state to the Store so any widget can read it
       without touching fetch/XHR itself (js/core/store.js already
       enforces the shape of what's read; this is what writes the new
       connection-related fields)
   ===================================================================== */
(function(HLM){
  "use strict";

  const QUALITY_GOOD_MS = 150;
  const QUALITY_FAIR_MS = 500;

  function qualityFor(latencyMs){
    if(latencyMs == null) return "unknown";
    if(latencyMs <= QUALITY_GOOD_MS) return "good";
    if(latencyMs <= QUALITY_FAIR_MS) return "fair";
    return "poor";
  }

  function healthUrlFor(dashboardUrl){
    // /api/dashboard -> /health (the root liveness probe — see
    // backend/app/core/application.py). Falls back to the dashboard URL
    // itself if it doesn't match the expected shape, rather than throwing.
    try{
      return HLM.http.deriveEndpoint(dashboardUrl, "/health");
    } catch(err){
      return dashboardUrl;
    }
  }

  class ConnectionManager {
    constructor(){
      this._consecutiveFailures = 0;
      this._latencyMs = null;
      this._heartbeatTimer = null;
      this._heartbeatActive = false;
      this._publish();
    }

    /** Called by ApiProvider (or anything else probing a real backend) on
     *  every successful request, with how long it took. */
    recordSuccess(latencyMs){
      this._consecutiveFailures = 0;
      this._latencyMs = latencyMs;
      this._publish();
    }

    recordFailure(){
      this._consecutiveFailures += 1;
      this._latencyMs = null;
      this._publish();
    }

    get consecutiveFailures(){
      return this._consecutiveFailures;
    }

    /**
     * Starts probing `dashboardUrl`'s backend independently of any active
     * DataProvider. Calls `onRecovered()` the moment it succeeds, then
     * stops itself — the caller (engine.js) decides what "recovered"
     * means (switching back to the preferred provider).
     */
    startHeartbeat(dashboardUrl, { intervalMs = 10000, onRecovered } = {}){
      if(this._heartbeatActive) return;
      this._heartbeatActive = true;
      const url = healthUrlFor(dashboardUrl);

      const probe = async () => {
        if(!this._heartbeatActive) return;
        const start = performance.now();
        try{
          await HLM.http.fetchWithTimeout(url); // liveness only — body ignored
          const latencyMs = Math.round(performance.now() - start);
          this.recordSuccess(latencyMs);
          this.stopHeartbeat();
          onRecovered?.();
          return;
        } catch(err){
          this.recordFailure();
        }
        if(this._heartbeatActive){
          this._heartbeatTimer = setTimeout(probe, intervalMs);
        }
      };
      probe();
    }

    stopHeartbeat(){
      this._heartbeatActive = false;
      clearTimeout(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }

    get isHeartbeatActive(){
      return this._heartbeatActive;
    }

    _publish(){
      HLM.store.set({
        connectionLatencyMs: this._latencyMs,
        connectionQuality: qualityFor(this._latencyMs),
      });
    }
  }

  HLM.connectionManager = new ConnectionManager();
})(window.HLM = window.HLM || {});
