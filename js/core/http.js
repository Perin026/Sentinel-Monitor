/* =====================================================================
   HTTP — the one place the frontend's own backend calls share their
   plumbing. Three separate Phase 5.2 modules talk to the Sentinel Core
   Server (js/engine/data-provider.js polls /api/dashboard,
   js/engine/backend-health.js polls /api/system, and
   js/engine/connection-manager.js probes /health), and every one of them
   needs the same two things: a fetch that actually cancels itself past a
   deadline, and a way to derive a sibling endpoint from the configured
   dashboard URL. Before this module those were copy-pasted three times;
   this is the single implementation they now share.

   Deliberately NOT used by plugins (js/plugins/examples/minecraft-plugin.js,
   js/plugins/builtin/core-monitoring.js each keep their own fetch): a
   plugin depends on the SDK surface, not on core internals, and reaching
   into HLM.http would weaken exactly the isolation boundary the plugin
   architecture exists to enforce. Their duplication is the price of that
   boundary and is intentional.
   ===================================================================== */
(function(HLM){
  "use strict";

  /**
   * fetch() that aborts itself after `timeoutMs` and throws on a non-2xx
   * status, so callers only ever get a Response they can trust (or an
   * error to handle). Returns the raw Response — callers that need a body
   * call `.json()` themselves; callers that only need liveness (the
   * heartbeat) ignore it. `cache: "no-store"` because every one of these
   * is polling for the *current* state, never a cacheable document.
   *
   * @param {string} url
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs=4000]
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, { timeoutMs = 4000, ...options } = {}){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try{
      const res = await fetch(url, { cache: "no-store", signal: controller.signal, ...options });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Derives a sibling endpoint from the configured dashboard URL, e.g.
   * `http://host/api/dashboard` -> `http://host/health`. Resolves relative
   * URLs against the current page. Throws (rather than returning garbage)
   * if `baseUrl` can't be parsed — callers decide the fallback.
   *
   * @param {string} baseUrl   typically HLM.config.APP.dataUrl
   * @param {string} pathname  the absolute path to swap in (e.g. "/health")
   * @returns {string}
   */
  function deriveEndpoint(baseUrl, pathname){
    const url = new URL(baseUrl, window.location.href);
    url.pathname = pathname;
    url.search = "";
    return url.toString();
  }

  HLM.http = { fetchWithTimeout, deriveEndpoint };
})(window.HLM = window.HLM || {});
