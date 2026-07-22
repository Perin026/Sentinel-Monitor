/* =====================================================================
   TREEMAP — fleet composition as a two-level squarified treemap
   (Phase 4.6). Top level: one rectangle per device *group*, area
   proportional to how many devices are in it. Second level: that
   rectangle subdivided into one cell per device, colored by health
   status. Answers "what is this fleet actually made of, and where is the
   trouble concentrated" in one glance.

   Squarified (Bruls/Huizing/van Wijk) rather than naive slice-and-dice:
   slice-and-dice degenerates into unreadable slivers as soon as one
   group dominates, which is exactly the shape a real homelab has (lots
   of docker, one UPS).

   Same component contract as gauge.js/chart.js: a factory returning
   `{ el, update(devices) }`. Rendering only — it never fetches, and it
   derives group/status from the device objects it is handed.

   Relayout is guarded: recomputing the partition on every tick would be
   wasted work, since composition (which devices exist, in which group)
   changes far more rarely than status does. A composition signature
   decides rebuild-vs-recolor — same "patch, don't rebuild" discipline as
   device-card.js.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el } = HLM.utils;
  const SVGNS = "http://www.w3.org/2000/svg";

  const W = 800, H = 420;
  const HEADER = 16;   // group label strip
  const GAP = 2;       // gutter between group rectangles

  function svg(tag, attrs){
    const node = document.createElementNS(SVGNS, tag);
    for(const [k, v] of Object.entries(attrs || {})){
      if(v == null) continue;
      node.setAttribute(k, String(v));
    }
    return node;
  }

  /** Worst (largest) aspect ratio in a candidate row — the squarify heuristic. */
  function worstRatio(row, short, areaScale){
    if(!row.length || short <= 0) return Infinity;
    let sum = 0, max = -Infinity, min = Infinity;
    for(const it of row){
      const a = it.value * areaScale;
      sum += a;
      if(a > max) max = a;
      if(a < min) min = a;
    }
    if(sum <= 0 || min <= 0) return Infinity;
    const s2 = short * short, sum2 = sum * sum;
    return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
  }

  /**
   * @param {Array<{value:number}>} items  weights, any order (sorted here)
   * @param {{x,y,w,h}} rect
   * @returns {Array<{item,x,y,w,h}>}
   */
  function squarify(items, rect){
    const out = [];
    let remaining = items.slice().sort((a, b) => b.value - a.value).filter(i => i.value > 0);
    let { x, y, w, h } = rect;
    const totalValue = remaining.reduce((s, i) => s + i.value, 0);
    if(totalValue <= 0 || w <= 0 || h <= 0) return out;
    const areaScale = (w * h) / totalValue;

    while(remaining.length){
      const short = Math.min(w, h);
      // Grow the row while the worst aspect ratio keeps improving.
      let row = [remaining[0]];
      let best = worstRatio(row, short, areaScale);
      for(let k = 2; k <= remaining.length; k++){
        const candidate = remaining.slice(0, k);
        const ratio = worstRatio(candidate, short, areaScale);
        if(ratio <= best){ best = ratio; row = candidate; }
        else break;
      }

      const rowSum = row.reduce((s, i) => s + i.value, 0);
      const rowArea = rowSum * areaScale;
      if(w >= h){
        const rowW = h > 0 ? rowArea / h : 0;
        let cy = y;
        row.forEach(it => {
          const cellH = rowSum > 0 ? (it.value / rowSum) * h : 0;
          out.push({ item: it, x, y: cy, w: rowW, h: cellH });
          cy += cellH;
        });
        x += rowW; w -= rowW;
      } else {
        const rowH = w > 0 ? rowArea / w : 0;
        let cx = x;
        row.forEach(it => {
          const cellW = rowSum > 0 ? (it.value / rowSum) * w : 0;
          out.push({ item: it, x: cx, y, w: cellW, h: rowH });
          cx += cellW;
        });
        y += rowH; h -= rowH;
      }
      remaining = remaining.slice(row.length);
    }
    return out;
  }

  function statusOf(device){
    return device.health?.status || device.status || "unknown";
  }
  function cssStatus(status){
    return status === "maintenance" ? "paused" : status;
  }

  /** Stable description of "what the fleet is made of" — not its health. */
  function compositionSignature(devices){
    return devices
      .map(d => `${d.group || "other"}:${d.id}`)
      .sort()
      .join("|");
  }

  function groupLabel(groupId){
    for(const section of (HLM.config.NAV || [])){
      const hit = section.items.find(i => i.id === groupId);
      if(hit) return hit.label;
    }
    return groupId;
  }

  /**
   * @param {object} opts
   *   devices  array of live device objects (from HLM.store)
   */
  function createTreemap(opts){
    const svgEl = svg("svg", { class: "treemap-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet" });
    const root = el("div", { class: "treemap" }, [svgEl]);
    const emptyEl = el("div", { class: "treemap-empty" }, ["No devices to show"]);
    root.append(emptyEl);

    let signature = null;
    const cellsById = new Map(); // deviceId -> <rect>

    function rebuild(devices){
      svgEl.innerHTML = "";
      cellsById.clear();

      const byGroup = new Map();
      devices.forEach(d => {
        const g = d.group || "other";
        if(!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(d);
      });

      const groupItems = Array.from(byGroup.entries()).map(([id, list]) => ({ id, list, value: list.length }));
      const groupRects = squarify(groupItems, { x: 0, y: 0, w: W, h: H });

      groupRects.forEach(({ item, x, y, w, h }) => {
        if(w <= GAP || h <= GAP) return;
        const gx = x + GAP / 2, gy = y + GAP / 2;
        const gw = Math.max(0, w - GAP), gh = Math.max(0, h - GAP);

        const groupNode = svg("g", { class: "treemap-group" });
        groupNode.append(svg("rect", { class: "treemap-group-bg", x: gx, y: gy, width: gw, height: gh, rx: 4 }));

        // Label strip, only if there's vertical room for it to be legible.
        const showHeader = gh > HEADER + 10;
        if(showHeader){
          const text = svg("text", { class: "treemap-group-label", x: gx + 6, y: gy + 11 });
          text.textContent = `${groupLabel(item.id)} · ${item.list.length}`;
          groupNode.append(text);
        }

        const inner = {
          x: gx + 2,
          y: gy + (showHeader ? HEADER : 2),
          w: Math.max(0, gw - 4),
          h: Math.max(0, gh - (showHeader ? HEADER + 2 : 4)),
        };
        // Devices weigh equally — the group's size already encodes count,
        // and no per-device metric is honestly comparable across types.
        const deviceRects = squarify(item.list.map(d => ({ device: d, value: 1 })), inner);

        deviceRects.forEach(dr => {
          if(dr.w <= 1 || dr.h <= 1) return;
          const device = dr.item.device;
          const rect = svg("rect", {
            class: `treemap-cell status-${cssStatus(statusOf(device))}`,
            x: dr.x + 0.5, y: dr.y + 0.5,
            width: Math.max(0, dr.w - 1), height: Math.max(0, dr.h - 1),
            rx: 2,
          });
          const title = document.createElementNS(SVGNS, "title");
          title.textContent = `${device.name || device.id} — ${statusOf(device)}`;
          rect.append(title);
          cellsById.set(device.id, rect);
          groupNode.append(rect);
        });

        svgEl.append(groupNode);
      });
    }

    function recolor(devices){
      devices.forEach(d => {
        const rect = cellsById.get(d.id);
        if(!rect) return;
        const status = statusOf(d);
        rect.setAttribute("class", `treemap-cell status-${cssStatus(status)}`);
        const title = rect.querySelector("title");
        if(title) title.textContent = `${d.name || d.id} — ${status}`;
      });
    }

    function update(devices){
      const list = devices || [];
      if(!list.length){
        root.classList.add("is-empty");
        return;
      }
      root.classList.remove("is-empty");

      const nextSignature = compositionSignature(list);
      if(nextSignature !== signature){
        signature = nextSignature;
        rebuild(list);       // composition changed — repartition
      } else {
        recolor(list);       // same fleet, new health — just repaint
      }
    }

    update(opts && opts.devices);
    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createTreemap = createTreemap;
})(window.HLM = window.HLM || {});
