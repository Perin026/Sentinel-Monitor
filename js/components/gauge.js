/* =====================================================================
   GAUGE — circular radial gauge + linear threshold gauge.
   Both take a value/min/max/thresholds and return { el, update(value) }.
   No polling or data-fetching lives here — callers (Phase 3 renderers)
   own the data and call update() on their own cadence.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, clamp, round } = HLM.utils;

  function statusFor(value, warn, critical, invert){
    if(invert){
      if(critical != null && value <= critical) return "critical";
      if(warn != null && value <= warn) return "warn";
      return "ok";
    }
    if(critical != null && value >= critical) return "critical";
    if(warn != null && value >= warn) return "warn";
    return "ok";
  }

  /**
   * @param {object} opts
   *   value, min, max, unit, warn, critical, size ("sm"|"md"|"lg"), label
   */
  function createCircularGauge(opts){
    const { value = 0, min = 0, max = 100, unit = "%", warn = null, critical = null, size = "md", label = "", invert = false } = opts;

    const RADIUS = 42;
    const CIRC = 2 * Math.PI * RADIUS;

    const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("class", "gauge-track");
    track.setAttribute("cx", "50"); track.setAttribute("cy", "50"); track.setAttribute("r", String(RADIUS));

    const valueCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    valueCircle.setAttribute("class", "gauge-value");
    valueCircle.setAttribute("cx", "50"); valueCircle.setAttribute("cy", "50"); valueCircle.setAttribute("r", String(RADIUS));
    valueCircle.setAttribute("stroke-dasharray", String(CIRC));

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.append(track, valueCircle);

    const valueEl = el("span", { class: "value" }, ["--"]);
    const unitEl = el("span", { class: "unit" }, [label || unit]);
    const readout = el("div", { class: "gauge-circular-readout" }, [valueEl, unitEl]);

    const root = el("div", { class: `gauge-circular size-${size}` }, [svg, readout]);

    function update(nextValue){
      const pct = clamp((nextValue - min) / (max - min), 0, 1);
      const offset = CIRC * (1 - pct);
      valueCircle.style.strokeDashoffset = String(offset);
      valueEl.textContent = round(nextValue, nextValue >= 100 ? 0 : 1);
      const st = statusFor(nextValue, warn, critical, invert);
      root.className = `gauge-circular size-${size} status-${st}`;
    }

    update(value);
    return { el: root, update };
  }

  /**
   * @param {object} opts
   *   value, min, max, unit, warn, critical, label
   */
  function createLinearGauge(opts){
    const { value = 0, min = 0, max = 100, unit = "%", warn = null, critical = null, label = "", invert = false } = opts;

    const fill = el("div", { class: "gauge-linear-fill" });
    const track = el("div", { class: "gauge-linear-track" }, [fill]);

    if(warn != null){
      const pos = clamp((warn - min) / (max - min), 0, 1) * 100;
      track.append(el("span", { class: "gauge-linear-threshold", style: `left:${pos}%` }));
    }
    if(critical != null){
      const pos = clamp((critical - min) / (max - min), 0, 1) * 100;
      track.append(el("span", { class: "gauge-linear-threshold", style: `left:${pos}%` }));
    }

    const currentEl = el("span", { class: "current" }, ["--"]);
    const meta = el("div", { class: "gauge-linear-meta" }, [
      el("span", {}, [label]),
      currentEl,
    ]);

    const root = el("div", { class: "gauge-linear" }, [track, meta]);

    function update(nextValue){
      const pct = clamp((nextValue - min) / (max - min), 0, 1) * 100;
      fill.style.width = `${pct}%`;
      currentEl.textContent = `${round(nextValue, nextValue >= 100 ? 0 : 1)}${unit}`;
      const st = statusFor(nextValue, warn, critical, invert);
      root.className = `gauge-linear status-${st}`;
    }

    update(value);
    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createCircularGauge = createCircularGauge;
  HLM.ui.createLinearGauge = createLinearGauge;
})(window.HLM = window.HLM || {});
