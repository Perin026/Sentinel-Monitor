/* =====================================================================
   APP — bootstraps the shell, mounts every view against the live
   store, and starts the monitoring engine. Nothing in this file
   invents data or computes health/alerts — it only renders what the
   engine already put in the store, and patches DOM in place on every
   tick instead of rebuilding it.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { qs, qsa, el, formatDuration } = HLM.utils;

  // ---------------------------------------------------------------
  // Shell wiring (unchanged in spirit from Phase 2)
  // ---------------------------------------------------------------

  function initSidebarCollapse(){
    const shell = qs(".app-shell");
    const btn = qs("#sidebarCollapseBtn");
    if(!btn) return;
    btn.addEventListener("click", () => {
      const collapsed = !shell.classList.contains("is-collapsed");
      shell.classList.toggle("is-collapsed", collapsed);
      HLM.store.set({ sidebarCollapsed: collapsed });
    });
  }

  function initMobileNav(){
    const shell = qs(".app-shell");
    const openBtn = qs("#mobileNavToggle");
    const scrim = qs("#navScrim");
    const close = () => { shell.classList.remove("is-nav-open"); HLM.store.set({ mobileNavOpen: false }); };
    const open  = () => { shell.classList.add("is-nav-open"); HLM.store.set({ mobileNavOpen: true }); };
    openBtn?.addEventListener("click", () => shell.classList.contains("is-nav-open") ? close() : open());
    scrim?.addEventListener("click", close);
    HLM.store.subscribe(s => { if(!s.mobileNavOpen) shell.classList.remove("is-nav-open"); });
  }

  function initRefreshIndicator(){
    const btn = qs("#refreshIndicator");
    if(!btn) return;
    let spinning = false;
    const spin = () => {
      if(spinning) return;
      spinning = true;
      btn.classList.add("is-spinning");
      setTimeout(() => { btn.classList.remove("is-spinning"); spinning = false; }, 500);
    };
    btn.addEventListener("click", () => HLM.engine.refresh());
    HLM.store.subscribe(spin, s => s.lastTick); // spins in lockstep with real ticks, not a guess
  }

  function initHealthPill(){
    const pill = qs("#healthPill");
    const label = qs("#healthPillLabel", pill);
    if(!pill || !label) return;
    const CONNECTION_LABEL = { simulated: "Simulated data", live: "Live", reconnecting: "Reconnecting…" };

    function render(s){
      const health = s.systemHealth;
      pill.className = `health-pill${health.status === "ok" ? "" : ` ${health.status === "critical" ? "critical" : "warn"}`}`;
      if(s.connection === "reconnecting"){
        label.textContent = CONNECTION_LABEL.reconnecting;
      } else if(health.status === "ok"){
        label.textContent = "All systems nominal";
      } else if(health.status === "critical"){
        label.textContent = `${health.criticalCount} device${health.criticalCount === 1 ? "" : "s"} critical`;
      } else {
        const count = health.warnCount + health.offlineCount;
        label.textContent = count === 1 ? "1 device needs attention" : `${count} devices need attention`;
      }
    }
    HLM.store.subscribe(render, s => `${s.connection}|${s.systemHealth.status}|${s.systemHealth.warnCount}|${s.systemHealth.criticalCount}|${s.systemHealth.offlineCount}`);
    render(HLM.store.get());
  }

  function initNotificationBell(){
    const btn = qs("#notificationBell");
    if(!btn) return;
    const dot = qs(".badge-dot", btn);
    btn.addEventListener("click", () => HLM.ui.toggleNotificationPanel(btn));
    const syncBadge = () => { if(dot) dot.style.display = HLM.ui.unreadNotificationCount() ? "block" : "none"; };
    HLM.store.subscribe(syncBadge, s => s.notifications);
    syncBadge();
  }

  function initFab(){
    HLM.ui.initFab([
      { label: "Search", icon: "search", onClick: () => HLM.ui.openSearch() },
      { label: "Refresh now", icon: "refresh", onClick: () => HLM.engine.refresh() },
      { label: "Add device", icon: "plus", onClick: () => {
          const modal = HLM.ui.openModal({
            title: "Add a device",
            subtitle: "Configuration UI arrives with the backend integration",
            body: el("p", {}, ["For now, devices are added by editing the fleet list in js/core/config.js — every device type already registered in DEVICE_TYPES picks up sensors, thresholds and rendering automatically."]),
            footer: el("div", { style: "display:flex;justify-content:flex-end;" }, [
              el("button", { class: "btn btn-primary", onclick: () => modal.close() }, ["Got it"]),
            ]),
          });
        },
      },
    ]);
  }

  function renderNav(){
    const nav = qs("#sidebarNav");
    if(!nav) return;
    nav.innerHTML = "";
    HLM.config.NAV.forEach(group => {
      nav.append(el("div", { class: "nav-section-label" }, [group.section]));
      group.items.forEach(item => {
        nav.append(el("button", { class: "nav-item", type: "button", dataset: { view: item.id }, html: `${HLM.icon(item.icon)}<span class="nav-label">${item.label}</span>` }));
      });
    });

    const pluginPages = HLM.registries.pages.list();
    if(pluginPages.length){
      nav.append(el("div", { class: "nav-section-label" }, ["Plugins"]));
      pluginPages.forEach(({ id, value: page }) => {
        nav.append(el("button", { class: "nav-item", type: "button", dataset: { view: id }, html: `${HLM.icon(page.icon || "grid")}<span class="nav-label">${page.label}</span>` }));
      });
    }
  }

  /** Materializes each plugin-registered page as a real <section class="view"> the router can target. */
  function mountPluginPages(){
    const main = qs(".app-main");
    if(!main) return;
    HLM.registries.pages.list().forEach(({ id, value: page }) => {
      const body = el("div", { class: "widget-grid" });
      const section = el("section", { class: "view", dataset: { view: id } }, [
        el("div", { class: "view-header" }, [
          el("div", {}, [el("h1", {}, [page.label]), page.subtitle ? el("p", { class: "view-subtitle" }, [page.subtitle]) : null]),
        ]),
        body,
      ]);
      main.append(section);
      try{ page.render?.(body); }
      catch(err){ console.error(`[app] plugin page "${id}" failed to render:`, err); }
    });
  }

  // ---------------------------------------------------------------
  // Overview — a handful of fleet-wide widgets, updated in place
  // ---------------------------------------------------------------

  function sensorDefaults(key){
    for(const { value: def } of HLM.registries.deviceTypes.list()){
      const found = def.sensors.find(s => s.key === key);
      if(found) return found;
    }
    return { warn: 75, critical: 90 };
  }

  function avgSensor(devices, key){
    const values = devices.filter(d => d.sensors[key] && !d.maintenance).map(d => d.sensors[key].value);
    if(!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function mountOverview(grid){
    const health = HLM.ui.createWidget({ title: "Fleet Health", subtitle: `${HLM.config.DEVICES.length} devices tracked`, icon: "shield", status: "ok" });
    health.el.classList.add("span-3");
    const healthGauge = HLM.ui.createCircularGauge({ value: 100, unit: "%", warn: 85, critical: 70, invert: true, size: "lg" });
    health.setContent(healthGauge.el);

    const cpuDef = sensorDefaults("cpu"), ramDef = sensorDefaults("ram"), storageDef = sensorDefaults("storage");

    const cpu = HLM.ui.createWidget({ title: "Avg. CPU Load", subtitle: "across compute devices", icon: "cpu", status: "ok" });
    cpu.el.classList.add("span-3");
    const cpuGauge = HLM.ui.createCircularGauge({ value: 0, unit: "%", warn: cpuDef.warn, critical: cpuDef.critical, size: "lg" });
    cpu.setContent(cpuGauge.el);

    const mem = HLM.ui.createWidget({ title: "Avg. Memory", subtitle: "across compute devices", icon: "memory", status: "ok" });
    mem.el.classList.add("span-3");
    const memGauge = HLM.ui.createCircularGauge({ value: 0, unit: "%", warn: ramDef.warn, critical: ramDef.critical, size: "lg" });
    mem.setContent(memGauge.el);

    const storage = HLM.ui.createWidget({ title: "Avg. Storage", subtitle: "across storage-bearing devices", icon: "storage", status: "ok" });
    storage.el.classList.add("span-3");
    const storageGauge = HLM.ui.createLinearGauge({ value: 0, unit: "%", warn: storageDef.warn, critical: storageDef.critical, label: "Used" });
    storage.setContent(storageGauge.el);

    const alerts = HLM.ui.createWidget({ title: "Active Alerts", icon: "alert-triangle", collapsible: false });
    alerts.el.classList.add("span-4");
    const alertsCounter = HLM.ui.createCounter({ value: 0, size: "lg", label: "Open across the fleet" });
    alerts.setContent(alertsCounter.el);

    const online = HLM.ui.createWidget({ title: "Devices Online", icon: "server", collapsible: false });
    online.el.classList.add("span-4");
    const onlineBar = HLM.ui.createProgressBar({ value: 0, max: HLM.config.DEVICES.length, status: "ok" });
    online.setContent(onlineBar.el);

    const uptime = HLM.ui.createWidget({ title: "Longest Uptime", icon: "clock", collapsible: false });
    uptime.el.classList.add("span-4");
    const uptimeCounter = HLM.ui.createCounter({ value: 0, size: "lg", suffix: "d", label: "—" });
    uptime.setContent(uptimeCounter.el);

    grid.append(health.el, cpu.el, mem.el, storage.el, alerts.el, online.el, uptime.el);

    function render(s){
      const devices = Object.values(s.devices);
      if(!devices.length) return;

      healthGauge.update(s.systemHealth.score);
      health.setStatus(s.systemHealth.status === "ok" ? "ok" : s.systemHealth.status === "critical" ? "critical" : "warn");

      const cpuAvg = avgSensor(devices, "cpu"), ramAvg = avgSensor(devices, "ram"), storageAvg = avgSensor(devices, "storage");
      cpuGauge.update(cpuAvg);
      memGauge.update(ramAvg);
      storageGauge.update(storageAvg);
      cpu.setStatus(HLM.healthEngine.computeSensorStatus(cpuAvg, cpuDef));
      mem.setStatus(HLM.healthEngine.computeSensorStatus(ramAvg, ramDef));
      storage.setStatus(HLM.healthEngine.computeSensorStatus(storageAvg, storageDef));

      alertsCounter.update(s.alerts.filter(a => !a.resolved).length);

      const onlineCount = devices.length - s.systemHealth.offlineCount;
      onlineBar.update(onlineCount, s.systemHealth.offlineCount > 0 ? "warn" : "ok");

      const longest = devices.reduce((max, d) => (Date.now() - d.bootedAt) > max.ms ? { ms: Date.now() - d.bootedAt, device: d } : max, { ms: 0, device: null });
      if(longest.device){
        uptimeCounter.update(Math.floor(longest.ms / 86400000));
        uptime.el.querySelector(".counter-label").textContent = longest.device.name;
      }
    }

    HLM.store.subscribe(render, s => s.lastTick);
    render(HLM.store.get());
  }

  // ---------------------------------------------------------------
  // Device-category views (Infrastructure / Servers / Network / ...)
  // ---------------------------------------------------------------

  function mountDeviceGroupView(viewId, grid){
    // `grid` is the .widget-grid already in index.html (repeat(12,1fr) by
    // default). Reconfigure it directly to a single full-width column instead
    // of nesting a second .widget-grid inside it — nesting left the inner
    // list as an unspanned grid *item* of the outer 12-column grid, collapsing
    // every device card to one twelfth of the page width.
    const cardsById = new Map();
    grid.style.gridTemplateColumns = "1fr";
    grid.style.gap = "12px";

    function render(s){
      const devices = Object.values(s.devices).filter(d => d.group === viewId).sort((a, b) => a.name.localeCompare(b.name));
      if(!devices.length){
        if(!cardsById.size && !grid.querySelector(".empty-state")){
          grid.append(el("div", { class: "empty-state compact" }, [el("h3", {}, ["No devices in this group yet"])]));
        }
        return;
      }
      grid.querySelector(".empty-state")?.remove();

      devices.forEach(device => {
        let card = cardsById.get(device.id);
        if(!card){
          card = HLM.ui.createDeviceCard(device);
          cardsById.set(device.id, card);
          grid.append(card.el);
        } else {
          card.update(device);
        }
      });
    }

    HLM.store.subscribe(render, s => s.lastTick);
    render(HLM.store.get());
  }

  // ---------------------------------------------------------------
  // Logs — live event stream with severity filtering
  // ---------------------------------------------------------------

  const EVENT_ICON = { critical: "alert-circle", warn: "alert-triangle", ok: "check", info: "info" };
  const MAX_LOG_ROWS = 150;

  function eventRow(evt){
    const node = el("div", { class: `notification-item ${evt.severity}`, dataset: { severity: evt.severity } }, [
      el("div", { class: "notification-icon", html: HLM.icon(EVENT_ICON[evt.severity] || "info") }),
      el("div", { class: "notification-content" }, [
        el("div", { class: "notification-title" }, [evt.description]),
        el("div", { class: "notification-message" }, [`${evt.origin} · ${evt.category}`]),
        el("div", { class: "notification-time" }, [new Date(evt.timestamp).toLocaleTimeString()]),
      ]),
    ]);
    return node;
  }

  function mountEventLog(){
    const listEl = qs("#eventLogList");
    const filtersEl = qs("#eventLogFilters");
    if(!listEl || !filtersEl) return;

    let currentFilter = "all";
    let lastRenderedId = null;

    function applyFilter(){
      qsa(".notification-item", listEl).forEach(node => {
        node.style.display = (currentFilter === "all" || node.dataset.severity === currentFilter) ? "" : "none";
      });
    }

    filtersEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if(!btn) return;
      currentFilter = btn.dataset.filter;
      qsa("[data-filter]", filtersEl).forEach(b => b.classList.toggle("is-active", b === btn));
      applyFilter();
    });

    function render(events){
      if(!events.length){
        if(!listEl.children.length){
          listEl.append(el("div", { class: "empty-state compact" }, [el("h3", {}, ["No events yet"])]));
        }
        return;
      }
      listEl.querySelector(".empty-state")?.remove();

      const freshEvents = [];
      for(const evt of events){
        if(evt.id === lastRenderedId) break;
        freshEvents.push(evt);
      }
      lastRenderedId = events[0].id;

      freshEvents.slice().reverse().forEach(evt => {
        const node = eventRow(evt);
        if(currentFilter !== "all" && evt.severity !== currentFilter) node.style.display = "none";
        listEl.prepend(node);
      });

      while(listEl.children.length > MAX_LOG_ROWS){
        listEl.removeChild(listEl.lastElementChild);
      }
    }

    HLM.store.subscribe(s => render(s.events), s => s.events);
    render(HLM.store.get().events);
  }

  // ---------------------------------------------------------------
  // Settings — read-only system info, wired to real config/state
  // ---------------------------------------------------------------

  function mountSettings(){
    const grid = qs("#settingsGrid");
    if(!grid) return;

    const source = HLM.ui.createWidget({ title: "Data Source", icon: "workflow", collapsible: false });
    source.el.classList.add("span-4");
    source.setContent(el("div", {}, [
      el("div", { class: "counter size-md" }, [HLM.config.APP.dataProvider === "simulation" ? "Simulation" : HLM.config.APP.dataProvider]),
      el("div", { class: "counter-label" }, [HLM.config.APP.dataUrl || "No external endpoint configured — set HLM.config.APP.dataUrl and dataProvider to go live."]),
    ]));

    const refresh = HLM.ui.createWidget({ title: "Refresh Interval", icon: "refresh", collapsible: false });
    refresh.el.classList.add("span-4");
    refresh.setContent(HLM.ui.createCounter({ value: HLM.config.APP.refreshMs / 1000, size: "lg", suffix: "s", label: "Between ticks" }).el);

    const fleet = HLM.ui.createWidget({ title: "Fleet Size", icon: "grid", collapsible: false });
    fleet.el.classList.add("span-4");
    const sensorCount = HLM.config.DEVICES.reduce((sum, d) => sum + (HLM.registries.deviceTypes.get(d.type)?.sensors.length || 0), 0);
    fleet.setContent(el("div", {}, [
      el("div", { class: "counter size-lg" }, [String(HLM.config.DEVICES.length)]),
      el("div", { class: "counter-label" }, [`${sensorCount} sensors across ${HLM.config.DEVICES.length} devices`]),
    ]));

    grid.append(source.el, refresh.el, fleet.el);
    mountMonitoringPanel(grid);
    mountPluginsPanel(grid);
    mountPluginSettingsPanels(grid);
  }

  // ---------------------------------------------------------------
  // Phase 4 — Live Monitoring panel: one row per real polled sensor
  // (js/engine/monitoring-scheduler.js), independent of the store's
  // tick cadence since polls happen on their own schedule. Ticks the
  // relative "next check" text on the same rAF-free interval the header
  // clock uses, so times don't visibly go stale between polls.
  // ---------------------------------------------------------------

  const MONITOR_STATUS_BADGE = { up: "ok", down: "critical", paused: "paused", unknown: "unknown" };

  function monitoringRow(record){
    const device = HLM.store.get().devices[record.deviceId];
    const deviceName = device?.name || record.deviceId;
    const sensorLabel = device?.sensors?.[record.sensorKey]?.def?.label || record.sensorKey;
    const lastUpdateText = record.lastUpdate ? `${formatDuration(Date.now() - record.lastUpdate)} ago` : "never";
    const nextCheckText = record.nextCheckAt ? `next in ${formatDuration(Math.max(0, record.nextCheckAt - Date.now()))}` : "—";
    const responseText = record.responseTimeMs != null ? `${record.responseTimeMs}ms` : "—";

    return el("div", { class: "device-card-sensor", style: "grid-column:span 1;" }, [
      el("span", { class: "sensor-label" }, [
        el("span", { class: `status-badge ${MONITOR_STATUS_BADGE[record.monitorStatus] || "unknown"}`, style: "margin-right:8px;" }, [record.monitorStatus]),
        `${deviceName} · ${sensorLabel} (${record.provider})`,
      ]),
      el("span", { class: "sensor-value" }, [`${responseText} · ${lastUpdateText} · ${nextCheckText}`]),
    ]);
  }

  function mountMonitoringPanel(grid){
    // Checked against static config, not the scheduler's live state: this mounts
    // before HLM.engine.start() (and so before monitoringScheduler.start()) runs,
    // same as every other view here — it renders once engine ticks arrive.
    if(!HLM.config.DEVICES.some(d => d.monitored)) return; // nothing configured for live polling

    const widget = HLM.ui.createWidget({ title: "Live Monitoring", subtitle: "Sensors polled for real, via js/engine/monitoring-scheduler.js", icon: "workflow", collapsible: false });
    widget.el.classList.add("span-12");
    const body = el("div", { class: "device-card-detail-inner", style: "padding:0; grid-template-columns:1fr;" });
    widget.setContent(body);
    grid.append(widget.el);

    function render(){
      body.innerHTML = "";
      HLM.monitoringScheduler.getAll().forEach(record => body.append(monitoringRow(record)));
    }
    render();
    HLM.store.subscribe(render, s => s.lastTick);
  }

  const PLUGIN_STATUS_BADGE = { enabled: "ok", disabled: "unknown", failed: "critical", incompatible: "warn", "missing-dependency": "warn" };

  function mountPluginsPanel(grid){
    const widget = HLM.ui.createWidget({ title: "Plugins", subtitle: "Registered through HLM.pluginManager", icon: "layers", collapsible: false });
    widget.el.classList.add("span-12");

    const rows = HLM.pluginManager.list().map(p => el("div", { class: "device-card-sensor", style: "grid-column:span 1;" }, [
      el("span", { class: "sensor-label" }, [
        el("span", { class: `status-badge ${PLUGIN_STATUS_BADGE[p.status] || "unknown"}`, style: "margin-right:8px;" }, [p.status]),
        `${p.name} · v${p.version}`,
      ]),
      el("span", { class: "sensor-value" }, [p.error || p.description || ""]),
    ]));

    widget.setContent(el("div", { class: "device-card-detail-inner", style: "padding:0; grid-template-columns:1fr;" }, rows));
    grid.append(widget.el);
  }

  function mountPluginSettingsPanels(grid){
    HLM.registries.settingsPanels.list().forEach(({ id, value: panel }) => {
      const widget = HLM.ui.createWidget({ title: panel.title || id, icon: panel.icon || "settings", collapsible: false });
      widget.el.classList.add("span-4");
      const body = el("div", { class: "counter-label" });
      panel.render(body);
      widget.setContent(body);
      grid.append(widget.el);
    });
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------

  function mountViews(){
    const overviewGrid = qs('.view[data-view="overview"] .widget-grid');
    if(overviewGrid) mountOverview(overviewGrid);

    const groupViews = HLM.config.NAV.flatMap(g => g.items.map(i => i.id)).filter(id => !["overview", "logs", "settings"].includes(id));
    groupViews.forEach(viewId => {
      const grid = qs(`.view[data-view="${viewId}"] .widget-grid`);
      if(grid) mountDeviceGroupView(viewId, grid);
    });

    mountEventLog();
    mountSettings();
  }

  function init(){
    HLM.theme.initTheme();
    renderNav();
    mountPluginPages();
    HLM.router.initRouter();
    HLM.clock.initClock();
    initSidebarCollapse();
    initMobileNav();
    initRefreshIndicator();
    initHealthPill();
    initNotificationBell();
    HLM.ui.initSearchTrigger();
    initFab();
    mountViews();
    HLM.scheduler.startAll();
    HLM.engine.start();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window.HLM = window.HLM || {});
