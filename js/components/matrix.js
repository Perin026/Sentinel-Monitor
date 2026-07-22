/* =====================================================================
   MATRIX — two cell-grid visualizations (Phase 4.6):

     createStatusMatrix()  one cell per device, colored by health — the
                           classic "whole fleet at a glance" wall panel
     createHeatmap()       devices (rows) x sensor keys (columns), each
                           cell's intensity scaled by that sensor's value

   Deliberately HTML/CSS grid rather than SVG, unlike treemap.js and
   chart.js. Those two need real geometry (area partitioning, path
   projection) so SVG earns its keep; these are *labeled tables of cells*,
   where CSS grid gives correct text alignment, wrapping, and native
   accessibility (a real `title`, focusable cells) for free. Picking the
   markup that fits the shape of the data beats being dogmatic about
   using one technology everywhere.

   Same contract as the other visual components: `{ el, update(devices) }`,
   rendering only. Both rebuild only when the device/sensor set changes
   and otherwise patch cells in place — the fleet's composition changes
   far less often than its numbers do.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, clamp } = HLM.utils;

  const STATUS_ORDER = ["ok", "warn", "critical", "offline", "maintenance"];
  const STATUS_LABEL = { ok: "OK", warn: "Warning", critical: "Critical", offline: "Offline", maintenance: "Maintenance" };

  function statusOf(device){
    return device.health?.status || device.status || "unknown";
  }
  function cssStatus(status){
    return status === "maintenance" ? "paused" : status;
  }
  function idSignature(devices){
    return devices.map(d => d.id).sort().join("|");
  }

  // ------------------------------------------------------------------
  // Status matrix
  // ------------------------------------------------------------------

  /**
   * @param {object} opts
   *   devices  array of live device objects
   */
  function createStatusMatrix(opts){
    const grid = el("div", { class: "status-matrix-grid" });
    const legend = el("div", { class: "status-matrix-legend" });
    const root = el("div", { class: "status-matrix" }, [grid, legend]);
    const emptyEl = el("div", { class: "status-matrix-empty" }, ["No devices to show"]);
    root.append(emptyEl);

    let signature = null;
    const cellsById = new Map();

    function rebuild(devices){
      grid.innerHTML = "";
      cellsById.clear();
      devices.forEach(device => {
        const cell = el("div", {
          class: `status-matrix-cell status-${cssStatus(statusOf(device))}`,
          tabindex: "0",
          title: `${device.name || device.id} — ${statusOf(device)}`,
        });
        cellsById.set(device.id, cell);
        grid.append(cell);
      });
    }

    function renderLegend(devices){
      const counts = {};
      devices.forEach(d => {
        const s = statusOf(d);
        counts[s] = (counts[s] || 0) + 1;
      });
      legend.innerHTML = "";
      STATUS_ORDER.forEach(status => {
        if(!counts[status]) return;
        legend.append(el("span", { class: "status-matrix-legend-item" }, [
          el("span", { class: `status-matrix-swatch status-${cssStatus(status)}` }),
          el("span", {}, [`${STATUS_LABEL[status] || status} · ${counts[status]}`]),
        ]));
      });
    }

    function update(devices){
      const list = devices || [];
      if(!list.length){
        root.classList.add("is-empty");
        return;
      }
      root.classList.remove("is-empty");

      const next = idSignature(list);
      if(next !== signature){
        signature = next;
        rebuild(list);
      } else {
        list.forEach(d => {
          const cell = cellsById.get(d.id);
          if(!cell) return;
          const status = statusOf(d);
          cell.className = `status-matrix-cell status-${cssStatus(status)}`;
          cell.title = `${d.name || d.id} — ${status}`;
        });
      }
      renderLegend(list);
    }

    update(opts && opts.devices);
    return { el: root, update };
  }

  // ------------------------------------------------------------------
  // Sensor heatmap
  // ------------------------------------------------------------------

  /**
   * Picks the sensor keys worth showing as columns: the most widely
   * shared ones across the fleet. A key only present on one device makes
   * a column that's empty for everyone else, so frequency-rank and cap.
   */
  function commonSensorKeys(devices, limit){
    const freq = new Map();
    devices.forEach(d => {
      Object.keys(d.sensors || {}).forEach(k => freq.set(k, (freq.get(k) || 0) + 1));
    });
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key]) => key);
  }

  /** 0..1 position of a sensor's value within its own defined range. */
  function normalized(sensor){
    const def = sensor.def || {};
    const min = typeof def.min === "number" ? def.min : 0;
    const max = typeof def.max === "number" ? def.max : 100;
    const span = (max - min) || 1;
    return clamp((sensor.value - min) / span, 0, 1);
  }

  /**
   * How many of `keys` this device actually has a sensor for. Used to
   * order rows: a real homelab fleet is heterogeneous (a switch has no
   * disk, a UPS has no CPU), so some sparsity is honest and unavoidable
   * — but interleaving full and near-empty rows makes the grid unreadable.
   * Sorting the dense rows to the top keeps every cell visible while
   * giving the eye a solid block to read first.
   */
  function coverage(device, keys){
    return keys.reduce((n, k) => n + (device.sensors?.[k] ? 1 : 0), 0);
  }

  /**
   * @param {object} opts
   *   devices, maxColumns (default 4 — past the four broadly-shared
   *   sensors the fleet's key frequency falls off a cliff, and every
   *   extra column is mostly empty)
   */
  function createHeatmap(opts){
    const maxColumns = (opts && opts.maxColumns) || 4;
    const table = el("div", { class: "heatmap-table" });
    const root = el("div", { class: "heatmap" }, [table]);
    const emptyEl = el("div", { class: "heatmap-empty" }, ["No sensor data to show"]);
    root.append(emptyEl);

    let signature = null;
    let keys = [];
    const cellsByKey = new Map(); // `${deviceId}::${sensorKey}` -> cell el

    function paintCell(cell, sensor){
      if(!sensor){
        cell.className = "heatmap-cell is-missing";
        cell.title = "—";
        cell.textContent = "";
        return;
      }
      cell.className = `heatmap-cell status-${cssStatus(sensor.status || "ok")}`;
      cell.style.setProperty("--heat", normalized(sensor).toFixed(3));
      cell.title = `${sensor.def?.label || ""}: ${sensor.value}${sensor.def?.unit || ""}`;
      cell.textContent = Math.round(sensor.value);
    }

    function rebuild(devices){
      table.innerHTML = "";
      cellsByKey.clear();
      keys = commonSensorKeys(devices, maxColumns);
      table.style.gridTemplateColumns = `minmax(90px, 1.4fr) repeat(${keys.length}, minmax(38px, 1fr))`;

      // header row
      table.append(el("div", { class: "heatmap-corner" }));
      keys.forEach(key => {
        const anyDef = devices.map(d => d.sensors?.[key]?.def).find(Boolean);
        table.append(el("div", { class: "heatmap-col-head", title: anyDef?.label || key }, [anyDef?.label || key]));
      });

      const ordered = devices
        .slice()
        .sort((a, b) => coverage(b, keys) - coverage(a, keys) || String(a.name || a.id).localeCompare(String(b.name || b.id)));

      ordered.forEach(device => {
        table.append(el("div", { class: "heatmap-row-head", title: device.name || device.id }, [device.name || device.id]));
        keys.forEach(key => {
          const cell = el("div", { class: "heatmap-cell" });
          paintCell(cell, device.sensors?.[key]);
          cellsByKey.set(`${device.id}::${key}`, cell);
          table.append(cell);
        });
      });
    }

    function update(devices){
      const list = devices || [];
      if(!list.length){
        root.classList.add("is-empty");
        return;
      }
      root.classList.remove("is-empty");

      // Signature covers both the fleet *and* which columns it implies —
      // a device gaining a sensor changes the table's shape, not just a value.
      const next = `${idSignature(list)}#${commonSensorKeys(list, maxColumns).join(",")}`;
      if(next !== signature){
        signature = next;
        rebuild(list);
        return;
      }
      list.forEach(device => {
        keys.forEach(key => {
          const cell = cellsByKey.get(`${device.id}::${key}`);
          if(cell) paintCell(cell, device.sensors?.[key]);
        });
      });
    }

    update(opts && opts.devices);
    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createStatusMatrix = createStatusMatrix;
  HLM.ui.createHeatmap = createHeatmap;
})(window.HLM = window.HLM || {});
