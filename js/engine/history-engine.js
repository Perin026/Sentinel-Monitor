/* =====================================================================
   HISTORY ENGINE — one rolling buffer shape used everywhere a sensor's
   past values are recorded, whether the value came from the simulator
   or a real poll (js/engine/monitoring-scheduler.js). Timestamped from
   the start (not just an array of numbers) so a future graphing layer
   (docs/roadmap.md, Phase 4-visualization) can plot against real time
   without a migration — variable-interval live sensors and fixed-tick
   simulated ones can share one buffer format.
   ===================================================================== */
(function(HLM){
  "use strict";

  /**
   * @param {Array<{t:number,v:number}>} history  existing buffer, oldest first
   * @param {number} value                         new sample's value
   * @param {number} maxPoints                       buffer cap
   * @returns {Array<{t:number,v:number}>} a new array — never mutates `history`
   */
  function pushSample(history, value, maxPoints){
    const next = (history || []).slice(-(Math.max(1, maxPoints) - 1));
    next.push({ t: Date.now(), v: value });
    return next;
  }

  HLM.historyEngine = { pushSample };
})(window.HLM = window.HLM || {});
