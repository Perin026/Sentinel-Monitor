/* =====================================================================
   ENGINE — the only module that knows a "tick" exists.
   Everything else (widgets, views) reads the store; nothing but this
   file writes to the devices/alerts/events/systemHealth slices.
   ===================================================================== */
(function(HLM){
  "use strict";

  let currentProvider = null;
  let consecutiveReconnects = 0;
  const FALLBACK_THRESHOLD = 3;

  /**
   * Phase 4 — overlays real polled values (js/engine/monitoring-scheduler.js)
   * onto this tick's snapshot for any device instance marked `monitored: true`.
   * Runs before health computation, so it needs zero changes to health-engine.js:
   * a monitored sensor's real value flows through the exact same
   * computeSensorStatus() thresholding an ordinary simulated sensor uses, and a
   * failed *primary* sensor sets device.status = "offline", which
   * computeDeviceHealth() already short-circuits on — the same mechanism the
   * simulator's own incident engine relies on.
   */
  function overlayLiveSensors(devices){
    Object.values(devices).forEach(device => {
      if(!HLM.monitoringScheduler.isMonitored(device.id)) return;

      let anyPrimaryDown = false;
      Object.entries(device.sensors).forEach(([key, sensor]) => {
        const monitor = sensor.def.monitor;
        if(!monitor) return;

        const live = HLM.monitoringScheduler.getSensorState(device.id, key);
        if(!live){ sensor.monitorStatus = "unknown"; return; }

        sensor.monitorStatus = live.monitorStatus;
        sensor.responseTimeMs = live.responseTimeMs;
        sensor.lastUpdate = live.lastUpdate;
        sensor.lastSuccessfulUpdate = live.lastSuccessfulUpdate;
        sensor.nextCheckAt = live.nextCheckAt;
        sensor.meta = live.meta;
        if(live.monitorStatus === "up") sensor.value = live.value;
        if(live.monitorStatus === "down" && monitor.primary) anyPrimaryDown = true;
      });

      if(!device.maintenance) device.status = anyPrimaryDown ? "offline" : "ok";
    });
  }

  function runPipeline(snapshot){
    const prevDevices = HLM.store.get().devices;
    const prevIncidentById = new Map(Object.values(prevDevices).map(d => [d.id, !!d.incident]));

    const devices = snapshot.devices;
    overlayLiveSensors(devices);
    Object.values(devices).forEach(device => {
      device.health = HLM.healthEngine.computeDeviceHealth(device);

      const prevSensors = prevDevices[device.id]?.sensors || {};
      Object.entries(device.sensors).forEach(([key, sensor]) => {
        const prevHistory = prevSensors[key]?.history || [];
        sensor.history = HLM.historyEngine.pushSample(prevHistory, sensor.value, HLM.config.APP.historyPoints);
      });
    });

    const transitions = HLM.alertEngine.processTick(devices);
    const newEvents = HLM.eventEngine.processTick(devices, transitions, prevIncidentById);
    const systemHealth = HLM.healthEngine.computeGlobalHealth(devices);
    const alerts = HLM.alertEngine.snapshot();

    HLM.store.set(s => ({
      devices,
      systemHealth,
      alerts,
      events: [...newEvents, ...s.events].slice(0, 300),
      lastTick: snapshot.timestamp,
    }));

    notifyForEvents(newEvents);
  }

  function notifyForEvents(events){
    events.forEach(evt => {
      if(evt.severity === "critical"){
        HLM.ui.pushNotification({ title: evt.description, level: "critical" });
        HLM.ui.toast({ title: evt.origin, message: evt.description, level: "critical" });
      } else if(evt.severity === "warn" && evt.category !== "backup"){
        HLM.ui.pushNotification({ title: evt.description, level: "warn" });
      } else if(evt.category === "availability" && evt.severity === "ok"){
        HLM.ui.pushNotification({ title: evt.description, level: "ok" });
      }
      // Routine flavor events (container restarts, completed backups) land
      // in the event log only — surfacing every one as a toast would be noise.
    });
  }

  function handleStatus(status){
    HLM.store.set({ connection: status });
    if(status === "reconnecting"){
      consecutiveReconnects += 1;
      if(consecutiveReconnects >= FALLBACK_THRESHOLD && HLM.config.APP.dataProvider !== "simulation"){
        HLM.ui.toast({ title: "Falling back to simulation", message: "The live data source is unreachable.", level: "warn" });
        switchProvider("simulation");
      }
    } else {
      consecutiveReconnects = 0;
    }
  }

  function switchProvider(name){
    currentProvider?.stop();
    currentProvider = HLM.dataProvider.createProvider(name, {
      onTick: runPipeline,
      onStatus: handleStatus,
      url: HLM.config.APP.dataUrl,
      intervalMs: HLM.config.APP.refreshMs,
    });
    currentProvider.start();
  }

  function start(){
    switchProvider(HLM.config.APP.dataProvider);
    HLM.monitoringScheduler.start(); // independent of which DataProvider is active — see overlayLiveSensors()
  }

  function refresh(){
    currentProvider?.refresh();
  }

  function setMaintenance(deviceId, isUnderMaintenance){
    currentProvider?.setMaintenance?.(deviceId, isUnderMaintenance);
  }

  function acknowledgeAlert(alertId){
    if(HLM.alertEngine.acknowledge(alertId)){
      HLM.store.set({ alerts: HLM.alertEngine.snapshot() });
    }
  }

  HLM.engine = { start, refresh, setMaintenance, acknowledgeAlert, switchProvider };
})(window.HLM = window.HLM || {});
