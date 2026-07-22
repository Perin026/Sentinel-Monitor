/* =====================================================================
   DATA PROVIDER — abstraction boundary between "where monitoring data
   comes from" and "what the app does with it".

   Every provider implements the same tiny interface:
     start()   begin producing ticks
     stop()    stop producing ticks
     refresh() force an out-of-cycle tick, if the provider supports one

   and calls back with:
     onTick(snapshot)     snapshot = { devices, timestamp }
     onStatus(connection) connection = "simulated" | "live" | "reconnecting"

   Swapping SimulationProvider for ApiProvider/WebSocketProvider is a
   one-value change (HLM.config.APP.dataProvider) — see createProvider()
   at the bottom. Nothing in the state/health/alert/event engines knows
   or cares which provider is active.
   ===================================================================== */
(function(HLM){
  "use strict";

  class DataProvider {
    constructor({ onTick, onStatus }){
      this.onTick = onTick || (() => {});
      this.onStatus = onStatus || (() => {});
    }
    start(){ /* implemented by subclasses */ }
    stop(){ /* implemented by subclasses */ }
    refresh(){ /* optional: subclasses may support forcing a tick */ }
  }

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  /**
   * Polls HLM.config.APP.dataUrl (an `/api/dashboard`-shaped endpoint —
   * see docs/api-contract.md) on the configured interval. Real as of
   * Phase 5.2: fetch with a hard timeout, a short in-poll retry with
   * backoff before giving up on a tick, and per-device hydration that
   * skips (rather than crashes on) a malformed entry.
   *
   * Uses a self-rescheduling `setTimeout` chain rather than `setInterval`
   * — the same reasoning as js/engine/monitoring-scheduler.js: once a
   * poll can retry internally, its worst-case duration can exceed
   * `intervalMs`, and `setInterval` would let a slow poll overlap itself.
   */
  class ApiProvider extends DataProvider {
    constructor(opts){
      super(opts);
      this.url = opts.url;
      this.intervalMs = opts.intervalMs || 2500;
      this.timeoutMs = opts.timeoutMs || 4000;
      this.maxRetries = opts.maxRetries ?? 2;
      this._timer = null;
      this._stopped = true;
    }

    async _fetchOnce(){
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try{
        const res = await fetch(this.url, { cache: "no-store", signal: controller.signal });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    }

    /** Turns { devices: {...} } into hydrated devices, keyed by id — never
     *  throws for one bad entry; skips it and keeps the rest of the tick. */
    _hydrateSnapshot(raw){
      if(!raw || typeof raw !== "object" || typeof raw.devices !== "object" || raw.devices === null){
        throw new Error("Malformed dashboard payload: missing `devices`");
      }
      const devices = {};
      Object.values(raw.devices).forEach(rawDevice => {
        try{
          const device = HLM.deviceModel.hydrateFromSnapshot(rawDevice);
          devices[device.id] = device;
        } catch(err){
          console.error("[ApiProvider] Skipping malformed device in dashboard payload:", err, rawDevice);
        }
      });
      return devices;
    }

    async _poll(){
      let lastError = null;
      for(let attempt = 0; attempt <= this.maxRetries; attempt++){
        const attemptStart = performance.now();
        try{
          const raw = await this._fetchOnce();
          const latencyMs = Math.round(performance.now() - attemptStart);
          const devices = this._hydrateSnapshot(raw);
          HLM.connectionManager?.recordSuccess(latencyMs);
          this.onStatus("live");
          this.onTick({ devices, timestamp: Date.now() });
          lastError = null;
          break;
        } catch(err){
          lastError = err;
          if(attempt < this.maxRetries) await sleep(Math.min(2000, 400 * (attempt + 1)));
        }
      }
      if(lastError){
        console.error(`[ApiProvider] Poll failed after ${this.maxRetries + 1} attempt(s):`, lastError);
        HLM.connectionManager?.recordFailure();
        this.onStatus("reconnecting");
      }
      if(!this._stopped){
        this._timer = setTimeout(() => this._poll(), this.intervalMs);
      }
    }

    start(){
      this._stopped = false;
      this._poll();
    }
    stop(){
      this._stopped = true;
      clearTimeout(this._timer);
    }
    refresh(){
      clearTimeout(this._timer);
      this._poll();
    }
  }

  /**
   * Structural stub for a future push-based backend. Derives a ws(s)://
   * URL from the configured HTTP data URL and expects the same snapshot
   * shape as ApiProvider, pushed instead of polled.
   */
  class WebSocketProvider extends DataProvider {
    constructor(opts){
      super(opts);
      this.url = opts.url;
      this._socket = null;
      this._reconnectTimer = null;
    }
    start(){
      const wsUrl = this.url.replace(/^http/, "ws");
      try{
        this._socket = new WebSocket(wsUrl);
        this._socket.onopen = () => this.onStatus("live");
        this._socket.onmessage = (evt) => {
          try{ this.onTick({ ...JSON.parse(evt.data), timestamp: Date.now() }); }
          catch(err){ /* malformed frame; ignore */ }
        };
        this._socket.onclose = () => { this.onStatus("reconnecting"); this._scheduleReconnect(); };
        this._socket.onerror = () => this.onStatus("reconnecting");
      } catch(err){
        this.onStatus("reconnecting");
        this._scheduleReconnect();
      }
    }
    _scheduleReconnect(){
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this.start(), 4000);
    }
    stop(){
      clearTimeout(this._reconnectTimer);
      this._socket?.close();
    }
    refresh(){ /* push-based: nothing to force */ }
  }

  /**
   * @param {string} name  a provider id registered in HLM.registries.dataProviders
   */
  function createProvider(name, opts){
    const ProviderClass = HLM.registries.dataProviders.get(name) || HLM.registries.dataProviders.get("simulation");
    return new ProviderClass(opts);
  }

  HLM.dataProvider = { DataProvider, ApiProvider, WebSocketProvider, createProvider };

  // Built-in providers register through the exact same registry a
  // plugin-contributed provider (SNMP, Prometheus, MQTT, ...) would use.
  HLM.registries.dataProviders.register("api", ApiProvider, "core");
  HLM.registries.dataProviders.register("websocket", WebSocketProvider, "core");
  // "simulation" is registered by simulation-provider.js once it defines the class.
})(window.HLM = window.HLM || {});
