/* =====================================================================
   CORE MONITORING — Phase 4's generic sensor providers, shipped as a
   builtin plugin exactly like core-devices.js/core-widgets.js: there is
   no special hardcoded path for "the providers that come with the app."

   Browser reality check (see docs/architecture.md — Sentinel Monitor is
   a zero-backend static page, by design): a browser cannot open a raw
   ICMP or TCP socket, and it cannot read another machine's CPU/RAM/disk
   without something running on that machine to ask. So:
     - "http" is a real, direct HTTP check (fetch, cors) — response code
       and timing are exactly what they claim to be.
     - "ping" is an HTTP(S)/no-cors reachability probe used *as* a latency
       + rough packet-loss proxy, not real ICMP. That's an honest
       approximation, not a fake one — no-cors mode resolves on any
       response and rejects only on a genuine network failure, so it
       still answers "is this host up, and how long did it take" without
       needing CORS headers from the target.
     - "system" is structurally complete but expects a local agent
       serving JSON metrics at a configurable URL — the same "nothing
       real to talk to unless you run one" honesty as ApiProvider.
     - "dummy" is synthetic on purpose, for exercising the scheduler
       (concurrency, retries, backoff) without depending on a network.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  /** fetch() wrapper that actually cancels the in-flight request past `timeoutMs`. */
  async function timedFetch(url, opts, timeoutMs){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try{
      return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** `monitor.host` overrides the device's own hostname — lets one device type
   *  point different sensors at different hosts (e.g. a reachability probe
   *  against one target, a readable HTTP check against another). */
  function targetUrl(seed, monitor){
    const host = monitor.host || seed.hostname || seed.ip;
    const scheme = monitor.scheme || "https";
    const port = monitor.port ? `:${monitor.port}` : "";
    const path = monitor.path || "/";
    return `${scheme}://${host}${port}${path}`;
  }

  const dummyProvider = {
    /** Random walk in [min,max] with a small artificial delay — proves the scheduler works, nothing more. */
    async poll(seed, sensorDef){
      await sleep(50 + Math.random() * 150);
      const { min = 0, max = 100 } = sensorDef;
      return { value: Math.round((min + Math.random() * (max - min)) * 10) / 10, meta: null };
    },
  };

  const httpProvider = {
    /** A real HTTP check: response code + wall-clock time. A non-2xx counts as a failed poll. */
    async poll(seed, sensorDef){
      const monitor = sensorDef.monitor;
      const url = targetUrl(seed, monitor);
      const start = performance.now();
      const res = await timedFetch(url, { method: monitor.method || "GET", mode: "cors", cache: "no-store" }, monitor.timeoutMs);
      const elapsed = Math.round(performance.now() - start);
      if(!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return { value: elapsed, meta: { code: res.status, url } };
    },
  };

  const pingProvider = {
    /**
     * Reachability + latency via a small burst of no-cors HTTP(S) probes.
     * no-cors resolves for *any* response (even one we can't read), and
     * only rejects on a real network failure — exactly the reachability
     * signal a ping needs, without requiring CORS support from the target.
     */
    async poll(seed, sensorDef){
      const monitor = sensorDef.monitor;
      const url = targetUrl(seed, monitor);
      const attempts = monitor.probes || 3;
      let succeeded = 0, totalMs = 0;

      for(let i = 0; i < attempts; i++){
        const start = performance.now();
        try{
          await timedFetch(url, { mode: "no-cors", cache: "no-store" }, monitor.timeoutMs);
          succeeded += 1;
          totalMs += performance.now() - start;
        } catch(err){ /* counts as a lost probe */ }
      }

      if(succeeded === 0) throw new Error(`${url} unreachable (0/${attempts} probes succeeded)`);
      return {
        value: Math.round(totalMs / succeeded),
        meta: { packetLossPct: Math.round(((attempts - succeeded) / attempts) * 100), probes: attempts, succeeded },
      };
    },
  };

  const systemProvider = {
    /** Structurally complete; needs a local agent exposing JSON metrics. Fails honestly until one exists. */
    async poll(seed, sensorDef){
      const monitor = sensorDef.monitor;
      const metric = monitor.metric || "cpu";
      const url = monitor.agentUrl || `http://${seed.hostname || seed.ip}:9182/metrics`;
      const res = await timedFetch(url, { cache: "no-store" }, monitor.timeoutMs);
      if(!res.ok) throw new Error(`Agent at ${url} responded HTTP ${res.status}`);
      const data = await res.json();
      if(typeof data[metric] !== "number") throw new Error(`Agent response from ${url} missing numeric "${metric}"`);
      return { value: data[metric], meta: data };
    },
  };

  HLM.createPlugin({
    id: "core-monitoring",
    name: "Core Monitoring",
    version: "1.0.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Generic sensor providers (ping, HTTP, system, dummy) and a generic HTTP Endpoint device type.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerSensorProvider("dummy", dummyProvider);
      ctx.registerSensorProvider("http", httpProvider);
      ctx.registerSensorProvider("ping", pingProvider);
      ctx.registerSensorProvider("system", systemProvider);

      ctx.registerDevice("http-endpoint", defineDeviceType({
        label: "HTTP Endpoint", icon: "network", group: "infrastructure",
        sensors: [
          // Reachability/latency probe. Points at 1.1.1.1 by default (`monitor.host`
          // overrides the device's own hostname) — Cloudflare's resolver is built
          // for public internet-scale traffic, unlike most API hosts, so it tolerates
          // a probe burst every poll without rate-limiting a demo device into "down".
          defineSensor({
            key: "latency", label: "Latency", unit: "ms", min: 0, max: 1000, warn: 400, critical: 800, weight: 1, volatility: 0,
            monitor: { provider: "ping", intervalMs: 30000, timeoutMs: 4000, retries: 2, primary: true, host: "1.1.1.1", probes: 2 },
          }),
          // Readable HTTP check against the device's own hostname. A real status
          // API (not a rate-limited REST API) so a demo device polling every 45s
          // indefinitely doesn't eventually start failing on request volume alone.
          defineSensor({
            key: "responseTime", label: "HTTP Response", unit: "ms", min: 0, max: 2000, warn: 800, critical: 1500, weight: 1, volatility: 0,
            monitor: { provider: "http", intervalMs: 45000, timeoutMs: 6000, retries: 1, primary: false, path: "/api/v2/status.json" },
          }),
        ],
      }));
    },
  });
})(window.HLM = window.HLM || {});
