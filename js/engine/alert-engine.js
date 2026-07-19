/* =====================================================================
   ALERT ENGINE — turns device/sensor health transitions into alerts.
   Deduplication is structural: one alert per (device, sensor) key,
   looked up and updated rather than recreated, so a sensor sitting in
   "warn" for an hour produces exactly one alert, not one per tick.
   Escalation/resolution are themselves the "notify-worthy" moments —
   there's no separate cooldown timer needed because we only act on
   actual state transitions.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { uid } = HLM.utils;

  const activeAlerts = new Map();   // key -> alert record
  const alertHistory = [];          // resolved alerts, newest first, capped
  const HISTORY_LIMIT = 200;

  function keyFor(deviceId, sensorKey){
    return `${deviceId}:${sensorKey || "device"}`;
  }

  function upsertAlert(key, patch, transitions){
    const existing = activeAlerts.get(key);
    if(!existing){
      const alert = {
        id: uid("alert"),
        key,
        acknowledged: false,
        resolved: false,
        resolvedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
      };
      activeAlerts.set(key, alert);
      transitions.push({ alert, kind: "created" });
      return;
    }
    const severityChanged = patch.severity && patch.severity !== existing.severity;
    Object.assign(existing, patch, { updatedAt: Date.now() });
    if(severityChanged){
      transitions.push({ alert: existing, kind: patch.severity === "critical" ? "escalated" : "downgraded" });
    }
  }

  function resolveAlert(key, transitions){
    const existing = activeAlerts.get(key);
    if(!existing || existing.resolved) return;
    existing.resolved = true;
    existing.resolvedAt = Date.now();
    activeAlerts.delete(key);
    alertHistory.unshift(existing);
    if(alertHistory.length > HISTORY_LIMIT) alertHistory.length = HISTORY_LIMIT;
    transitions.push({ alert: existing, kind: "resolved" });
  }

  /**
   * Walks every device/sensor, reconciles alert state against current
   * health, and returns the transitions that happened this tick so the
   * event engine / notifications can react to just those.
   */
  function processTick(devicesMap){
    const transitions = [];

    Object.values(devicesMap).forEach(device => {
      const deviceKey = keyFor(device.id, null);

      if(device.maintenance){
        // Maintenance suppresses new + existing alerts for this device.
        [...activeAlerts.keys()]
          .filter(k => k.startsWith(`${device.id}:`))
          .forEach(k => resolveAlert(k, transitions));
        return;
      }

      if(device.health.status === "offline"){
        upsertAlert(deviceKey, {
          deviceId: device.id, deviceName: device.name, sensorKey: null, sensorLabel: null,
          severity: "critical", message: `${device.name} is offline`,
        }, transitions);
        // Sensor-level alerts don't matter while the device itself is down.
        [...activeAlerts.keys()]
          .filter(k => k.startsWith(`${device.id}:`) && k !== deviceKey)
          .forEach(k => resolveAlert(k, transitions));
        return;
      }
      resolveAlert(deviceKey, transitions); // device back online

      Object.entries(device.sensors).forEach(([sensorKey, sensor]) => {
        if(sensor.def.weight === 0) return; // informational, never alerts
        const key = keyFor(device.id, sensorKey);

        if(sensor.status === "ok"){
          resolveAlert(key, transitions);
          return;
        }

        upsertAlert(key, {
          deviceId: device.id, deviceName: device.name, sensorKey, sensorLabel: sensor.def.label,
          severity: sensor.status,
          message: `${sensor.def.label} on ${device.name} is ${sensor.status} (${sensor.value}${sensor.def.unit})`,
        }, transitions);
      });
    });

    return transitions;
  }

  function acknowledge(alertId){
    for(const alert of activeAlerts.values()){
      if(alert.id === alertId){ alert.acknowledged = true; return true; }
    }
    return false;
  }

  function snapshot(){
    return [...activeAlerts.values(), ...alertHistory];
  }

  HLM.alertEngine = { processTick, acknowledge, snapshot };
})(window.HLM = window.HLM || {});
