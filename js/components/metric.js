/* =====================================================================
   METRIC — animated counter + progress bar.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, clamp, round } = HLM.utils;

  /**
   * Animated numeric counter. Counts from its current displayed value
   * to a new target whenever update() is called — not just on mount —
   * so live re-renders (Phase 3) get a motion cue for free.
   */
  function createCounter(opts){
    const { value = 0, size = "md", label = "", decimals = 0, prefix = "", suffix = "" } = opts;

    const valueEl = el("span", { class: `counter size-${size}` }, ["0"]);
    const labelEl = label ? el("div", { class: "counter-label" }, [label]) : null;
    const root = el("div", {}, [valueEl, labelEl]);

    let current = 0;
    let raf = null;

    function update(target, { animate = true } = {}){
      if(!animate){
        current = target;
        valueEl.textContent = `${prefix}${round(target, decimals)}${suffix}`;
        return;
      }
      const start = current;
      const delta = target - start;
      const duration = 500;
      const startTime = performance.now();

      cancelAnimationFrame(raf);
      function frame(now){
        const t = clamp((now - startTime) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        current = start + delta * eased;
        valueEl.textContent = `${prefix}${round(current, decimals)}${suffix}`;
        if(t < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }

    update(value, { animate: false });
    return { el: root, update };
  }

  /**
   * Simple determinate progress bar. `status` recolors the fill;
   * pass `striped: true` for an in-progress / indeterminate feel.
   */
  function createProgressBar(opts){
    const { value = 0, max = 100, status = null, striped = false, showValue = true } = opts;

    const fill = el("div", { class: "progress-bar-fill" });
    const bar = el("div", { class: `progress-bar${striped ? " striped" : ""}${status ? ` status-${status}` : ""}` }, [fill]);
    const valueEl = showValue ? el("span", { class: "progress-bar-value" }, ["0%"]) : null;
    const root = el("div", { class: "progress-bar-row" }, [bar, valueEl]);

    function update(nextValue, nextStatus){
      const pct = clamp((nextValue / max) * 100, 0, 100);
      fill.style.width = `${pct}%`;
      if(valueEl) valueEl.textContent = `${round(pct, 0)}%`;
      if(nextStatus){
        bar.className = `progress-bar${striped ? " striped" : ""} status-${nextStatus}`;
      }
    }

    update(value, status);
    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createCounter = createCounter;
  HLM.ui.createProgressBar = createProgressBar;
})(window.HLM = window.HLM || {});
