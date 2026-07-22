/* =====================================================================
   CHART — hand-rolled SVG time-series charts (Phase 4.6). No charting
   library, same as the rest of this codebase: `createElementNS`, a
   `{ el, update(history) }` return, colors from CSS tokens only. Follows
   gauge.js's contract exactly — the component owns rendering, the caller
   owns the data and calls update() on its own cadence.

   Both consume the one history-buffer shape the whole app already
   produces (js/engine/history-engine.js): an array of `{t, v}` samples,
   oldest first. Nothing here fetches, polls, or aggregates — a chart is
   handed a buffer and draws it.

     createSparkline(opts)  -> tiny, axis-less inline trend (device rows)
     createTimeChart(opts)  -> full chart: axes, gridlines, threshold
                               bands, hover readout

   Responsive trick (both): a fixed logical viewBox plus
   `vector-effect: non-scaling-stroke` on the line, so the SVG stretches
   to whatever width its container gives it while the stroke stays 1.5px
   crisp — no width measurement, no ResizeObserver needed.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, clamp, round } = HLM.utils;
  const SVGNS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs){
    const node = document.createElementNS(SVGNS, tag);
    for(const [k, v] of Object.entries(attrs || {})){
      if(v == null) continue;
      node.setAttribute(k, String(v));
    }
    return node;
  }

  /** status ("ok"|"warn"|"critical"|...) for a value against thresholds. */
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
   * Maps a `{t,v}` buffer onto viewBox coordinates. X is sample *index*
   * (evenly spaced) rather than real timestamp: the buffers are sampled
   * on a near-fixed cadence, index spacing reads cleaner than true-time
   * spacing, and it degrades gracefully for a 1-point buffer. Y is the
   * value scaled into [pad, h-pad], flipped (SVG y grows downward).
   */
  function project(history, min, max, w, h, padY){
    const n = history.length;
    const span = (max - min) || 1;
    const innerH = h - padY * 2;
    return history.map((sample, i) => {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
      const norm = clamp((sample.v - min) / span, 0, 1);
      const y = padY + (1 - norm) * innerH;
      return [x, y];
    });
  }

  function toPath(points){
    if(!points.length) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p[0], 2)} ${round(p[1], 2)}`).join(" ");
  }

  /**
   * @param {object} opts
   *   history [{t,v}], min, max, warn, critical, invert, status (override)
   * A ~sparkline: no axes, no labels, just the trend line + a soft fill
   * and a dot on the latest point. Stretches to its container's width.
   */
  function createSparkline(opts){
    const { min = 0, max = 100, warn = null, critical = null, invert = false } = opts;
    const W = 100, H = 30, PAD = 3;

    const area = svg("path", { class: "chart-spark-area" });
    const line = svg("path", { class: "chart-spark-line" });
    const dot = svg("circle", { class: "chart-spark-dot", r: 2 });
    const svgEl = svg("svg", { class: "chart-spark-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" });
    svgEl.append(area, line, dot);

    const root = el("div", { class: "chart-spark" }, [svgEl]);
    const empty = el("span", { class: "chart-spark-empty" }, ["—"]);
    root.append(empty);

    function update(history, statusOverride){
      const buf = history || [];
      if(buf.length === 0){
        root.classList.add("is-empty");
        return;
      }
      root.classList.remove("is-empty");

      const points = project(buf, min, max, W, H, PAD);
      const linePath = toPath(points);
      line.setAttribute("d", linePath);
      // Close the area down to the baseline for the soft fill.
      area.setAttribute("d", `${linePath} L${round(points[points.length - 1][0], 2)} ${H} L${round(points[0][0], 2)} ${H} Z`);

      const last = points[points.length - 1];
      dot.setAttribute("cx", round(last[0], 2));
      dot.setAttribute("cy", round(last[1], 2));

      const latest = buf[buf.length - 1].v;
      const st = statusOverride || statusFor(latest, warn, critical, invert);
      root.className = `chart-spark status-${st}`;
    }

    update(opts.history);
    return { el: root, update };
  }

  /**
   * @param {object} opts
   *   history [{t,v}], min, max, unit, warn, critical, invert,
   *   label, valueFormat(v)->string, gridLines (number, default 4)
   * A full chart: y-axis gridlines + labels, warn/critical threshold
   * bands drawn behind the line, a live line + area fill, and a hover
   * crosshair with a floating readout of the sample under the pointer.
   */
  function createTimeChart(opts){
    const {
      min = 0, max = 100, unit = "", warn = null, critical = null,
      invert = false, label = "", gridLines = 4,
    } = opts;
    const valueFormat = opts.valueFormat || (v => `${round(v, v >= 100 ? 0 : 1)}${unit}`);

    const W = 600, H = 240, PAD_L = 44, PAD_R = 12, PAD_T = 14, PAD_B = 22;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const svgEl = svg("svg", { class: "chart-time-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });

    // ---- threshold bands (behind everything) ----
    function bandRect(from, to, cls){
      const yTo = PAD_T + (1 - clamp((to - min) / ((max - min) || 1), 0, 1)) * plotH;
      const yFrom = PAD_T + (1 - clamp((from - min) / ((max - min) || 1), 0, 1)) * plotH;
      const top = Math.min(yFrom, yTo), height = Math.abs(yFrom - yTo);
      return svg("rect", { class: `chart-band ${cls}`, x: PAD_L, y: round(top, 2), width: plotW, height: round(height, 2) });
    }
    // For a normal (non-inverted) metric, warn..critical is the amber
    // zone and critical..max is the red zone; inverted flips the ends.
    if(warn != null && critical != null){
      if(invert){
        svgEl.append(bandRect(min, critical, "chart-band-critical"), bandRect(critical, warn, "chart-band-warn"));
      } else {
        svgEl.append(bandRect(warn, critical, "chart-band-warn"), bandRect(critical, max, "chart-band-critical"));
      }
    }

    // ---- gridlines + y labels ----
    const axis = svg("g", { class: "chart-axis" });
    for(let i = 0; i <= gridLines; i++){
      const t = i / gridLines;
      const y = PAD_T + t * plotH;
      const value = max - t * (max - min);
      axis.append(svg("line", { class: "chart-gridline", x1: PAD_L, y1: round(y, 2), x2: W - PAD_R, y2: round(y, 2) }));
      const text = svg("text", { class: "chart-axis-label", x: PAD_L - 6, y: round(y + 3, 2), "text-anchor": "end" });
      text.textContent = round(value, value >= 100 ? 0 : 1);
      axis.append(text);
    }
    svgEl.append(axis);

    // ---- the series ----
    const area = svg("path", { class: "chart-time-area" });
    const line = svg("path", { class: "chart-time-line" });
    svgEl.append(area, line);

    // ---- hover crosshair + dot ----
    const crosshair = svg("line", { class: "chart-crosshair", y1: PAD_T, y2: PAD_T + plotH });
    const hoverDot = svg("circle", { class: "chart-hover-dot", r: 3.5 });
    const hoverLayer = svg("g", { class: "chart-hover-layer" });
    hoverLayer.append(crosshair, hoverDot);
    svgEl.append(hoverLayer);

    const readout = el("div", { class: "chart-readout" });
    const titleEl = el("div", { class: "chart-time-title" }, [label]);
    const root = el("div", { class: "chart-time" }, [titleEl, el("div", { class: "chart-time-plot" }, [svgEl, readout])]);
    const emptyEl = el("div", { class: "chart-time-empty" }, ["Collecting data…"]);
    root.append(emptyEl);

    let currentBuf = [];
    let currentPoints = [];

    function update(history){
      currentBuf = history || [];
      if(currentBuf.length === 0){
        root.classList.add("is-empty");
        return;
      }
      root.classList.remove("is-empty");

      // project() works in full-viewBox space; here we need the plot area
      // inset, so scale its x/y into [PAD_L..] / [PAD_T..].
      const span = (max - min) || 1;
      currentPoints = currentBuf.map((s, i) => {
        const x = currentBuf.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (currentBuf.length - 1)) * plotW;
        const y = PAD_T + (1 - clamp((s.v - min) / span, 0, 1)) * plotH;
        return [x, y];
      });

      const linePath = toPath(currentPoints);
      line.setAttribute("d", linePath);
      const first = currentPoints[0], lastP = currentPoints[currentPoints.length - 1];
      area.setAttribute("d", `${linePath} L${round(lastP[0], 2)} ${PAD_T + plotH} L${round(first[0], 2)} ${PAD_T + plotH} Z`);

      const latest = currentBuf[currentBuf.length - 1].v;
      const st = statusFor(latest, warn, critical, invert);
      root.className = `chart-time status-${st}`;
    }

    // Map a pointer's clientX to the nearest sample and show the readout.
    function onMove(evt){
      if(currentPoints.length === 0) return;
      const rect = svgEl.getBoundingClientRect();
      const relX = ((evt.clientX - rect.left) / rect.width) * W;
      // nearest sample by projected x
      let nearest = 0, best = Infinity;
      for(let i = 0; i < currentPoints.length; i++){
        const d = Math.abs(currentPoints[i][0] - relX);
        if(d < best){ best = d; nearest = i; }
      }
      const [px, py] = currentPoints[nearest];
      const sample = currentBuf[nearest];
      crosshair.setAttribute("x1", round(px, 2));
      crosshair.setAttribute("x2", round(px, 2));
      hoverDot.setAttribute("cx", round(px, 2));
      hoverDot.setAttribute("cy", round(py, 2));
      hoverLayer.classList.add("is-visible");

      const when = new Date(sample.t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      readout.innerHTML = "";
      readout.append(
        el("span", { class: "chart-readout-value" }, [valueFormat(sample.v)]),
        el("span", { class: "chart-readout-time" }, [when]),
      );
      // Position the readout near the pointer, clamped inside the plot.
      const leftPct = clamp((px / W) * 100, 6, 82);
      readout.style.left = `${leftPct}%`;
      readout.classList.add("is-visible");
    }
    function onLeave(){
      hoverLayer.classList.remove("is-visible");
      readout.classList.remove("is-visible");
    }
    svgEl.addEventListener("pointermove", onMove);
    svgEl.addEventListener("pointerleave", onLeave);

    update(opts.history);
    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createSparkline = createSparkline;
  HLM.ui.createTimeChart = createTimeChart;
})(window.HLM = window.HLM || {});
