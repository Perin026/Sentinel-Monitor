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

  /**
   * Polls HLM.config.APP.dataUrl on the configured interval and expects
   * a JSON body shaped like { devices: {}, services: {}, environment: {},
   * alerts: [], events: [] } — the contract documented in the Phase 1 brief.
   * Structurally complete; there is no live backend yet, so this will
   * simply fail to fetch and report "reconnecting" until one exists.
   */
  class ApiProvider extends DataProvider {
    constructor(opts){
      super(opts);
      this.url = opts.url;
      this.intervalMs = opts.intervalMs || 2500;
      this._timer = null;
    }
    async _poll(){
      try{
        const res = await fetch(this.url, { cache: "no-store" });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const snapshot = await res.json();
        this.onStatus("live");
        this.onTick({ ...snapshot, timestamp: Date.now() });
      } catch(err){
        this.onStatus("reconnecting");
      }
    }
    start(){
      this._poll();
      this._timer = setInterval(() => this._poll(), this.intervalMs);
    }
    stop(){
      clearInterval(this._timer);
    }
    refresh(){
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
