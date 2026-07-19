/* =====================================================================
   DEVICE CARD — presentation-only. Renders a live engine device object;
   never computes health/status itself (that's health-engine.js) and
   never fetches data (that's the provider). update() patches the
   existing DOM in place so a 500-device view doesn't rebuild on every
   tick — only the numbers that changed touch the DOM.

   device shape (see js/engine/device-model.js + health-engine.js):
   {
     id, name, type, hostname, ip,
     health: { score, status },      // "ok"|"warn"|"critical"|"offline"|"maintenance"
     maintenance, bootedAt, lastCheck,
     sensors: { key: { def:{label,unit,weight}, value, status } },
   }
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, formatDuration } = HLM.utils;

  const SUMMARY_KEYS = ["cpu", "ram", "storage", "battery", "gpu"];

  function badgeClass(status){
    return status === "maintenance" ? "paused" : status;
  }

  function fmtValue(sensor){
    return `${sensor.value}${sensor.def.unit}`;
  }

  function buildMetricPill(key, sensor){
    const fill = el("div", { class: "progress-bar-fill", style: `width:${Math.min(100, Math.max(0, sensor.value))}%` });
    const bar = el("div", { class: `progress-bar status-${sensor.status}` }, [fill]);
    const valueEl = el("span", { class: "metric-value" }, [fmtValue(sensor)]);
    const node = el("div", { class: "device-card-metric" }, [
      el("span", { class: "metric-label" }, [sensor.def.label]),
      bar,
      valueEl,
    ]);
    return { node, fill, bar, valueEl };
  }

  function buildSensorRow(key, sensor){
    const label = el("span", { class: "sensor-label" }, [sensor.def.label]);
    const valueEl = el("span", { class: "sensor-value" }, [fmtValue(sensor)]);
    const node = el("div", { class: `device-card-sensor status-${sensor.status}` }, [label, valueEl]);
    return { node, valueEl };
  }

  function createDeviceCard(device){
    const typeInfo = HLM.registries.deviceTypes.get(device.type) || { label: device.type || "Device", icon: "server" };
    const refs = { metrics: {}, sensors: {} };

    // ---------- summary row ----------
    const summaryMetricKeys = SUMMARY_KEYS.filter(k => device.sensors[k]);
    const metricsRow = el("div", { class: "device-card-metrics" });
    summaryMetricKeys.forEach(key => {
      const pill = buildMetricPill(key, device.sensors[key]);
      refs.metrics[key] = pill;
      metricsRow.append(pill.node);
    });

    const statusBadge = el("span", { class: `status-badge ${badgeClass(device.health.status)}` }, [device.health.status]);
    const chevron = el("span", { class: "device-card-chevron", html: HLM.icon("chevron-down") });

    const summary = el("button", { class: "device-card-summary", type: "button", "aria-expanded": "false" }, [
      el("span", { class: "device-card-icon", html: HLM.icon(typeInfo.icon) }),
      el("div", { class: "device-card-identity" }, [
        el("div", { class: "device-card-name" }, [device.name || "Unnamed device"]),
        el("div", { class: "device-card-meta" }, [
          device.hostname ? el("span", {}, [device.hostname]) : null,
          device.ip ? el("span", {}, [device.ip]) : null,
          el("span", {}, [typeInfo.label]),
        ]),
      ]),
      metricsRow,
      statusBadge,
      chevron,
    ]);

    // ---------- expandable detail ----------
    const detailInner = el("div", { class: "device-card-detail-inner" });
    Object.entries(device.sensors).forEach(([key, sensor]) => {
      const row = buildSensorRow(key, sensor);
      refs.sensors[key] = row;
      detailInner.append(row.node);
    });

    const uptimeValue = el("span", { class: "sensor-value" }, [formatDuration(Date.now() - device.bootedAt)]);
    const lastCheckValue = el("span", { class: "sensor-value" }, ["just now"]);
    detailInner.append(
      el("div", { class: "device-card-sensor status-ok" }, [el("span", { class: "sensor-label" }, ["Uptime"]), uptimeValue]),
      el("div", { class: "device-card-sensor status-ok" }, [el("span", { class: "sensor-label" }, ["Last check"]), lastCheckValue]),
    );

    const detail = el("div", { class: "device-card-detail" }, [detailInner]);
    const root = el("div", { class: `device-card status-${badgeClass(device.health.status)}`, dataset: { deviceId: device.id } }, [summary, detail]);

    summary.addEventListener("click", () => {
      const expanded = root.classList.toggle("is-expanded");
      summary.setAttribute("aria-expanded", String(expanded));
    });

    /** Patches the existing DOM to reflect a fresh device object — no rebuild. */
    function update(nextDevice){
      const status = badgeClass(nextDevice.health.status);
      root.className = `device-card status-${status}${root.classList.contains("is-expanded") ? " is-expanded" : ""}`;
      statusBadge.className = `status-badge ${status}`;
      statusBadge.textContent = nextDevice.health.status;

      summaryMetricKeys.forEach(key => {
        const sensor = nextDevice.sensors[key];
        const pill = refs.metrics[key];
        if(!sensor || !pill) return;
        pill.fill.style.width = `${Math.min(100, Math.max(0, sensor.value))}%`;
        pill.bar.className = `progress-bar status-${sensor.status}`;
        pill.valueEl.textContent = fmtValue(sensor);
      });

      Object.entries(nextDevice.sensors).forEach(([key, sensor]) => {
        const row = refs.sensors[key];
        if(!row) return;
        row.node.className = `device-card-sensor status-${sensor.status}`;
        row.valueEl.textContent = fmtValue(sensor);
      });

      uptimeValue.textContent = nextDevice.maintenance ? "—" : formatDuration(Date.now() - nextDevice.bootedAt);
      lastCheckValue.textContent = `${formatDuration(Date.now() - nextDevice.lastCheck) || "0s"} ago`;
    }

    return { el: root, update };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createDeviceCard = createDeviceCard;
})(window.HLM = window.HLM || {});
