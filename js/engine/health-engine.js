/* =====================================================================
   HEALTH ENGINE — sensor status → device health → group health → global
   health. Every level is a pure function of the level below it, which
   is what lets "each device contributes to group health, each group
   contributes to global health" stay true without any level knowing
   how the level below it was computed.
   ===================================================================== */
(function(HLM){
  "use strict";

  const RANK = { ok: 0, warn: 1, critical: 2, offline: 3, maintenance: -1, unknown: -2 };
  const HEALTHINESS = { ok: 100, warn: 60, critical: 20, offline: 0 };

  /** @returns {"ok"|"warn"|"critical"} — never returns offline/maintenance; those are device-level overrides. */
  function computeSensorStatus(value, def){
    if(def.weight === 0) return "ok"; // informational sensors never drive status
    if(def.invert){
      if(value <= def.critical) return "critical";
      if(value <= def.warn) return "warn";
      return "ok";
    }
    if(value >= def.critical) return "critical";
    if(value >= def.warn) return "warn";
    return "ok";
  }

  /**
   * Mutates sensor.status in place (cheap; called every tick for every
   * sensor) and returns the device-level health summary. Checks for a
   * plugin-registered custom calculator for this device's type first;
   * falls back to the generic weighted algorithm otherwise.
   */
  function computeDeviceHealth(device){
    if(device.maintenance){
      return { score: null, status: "maintenance" };
    }
    if(device.status === "offline"){
      Object.values(device.sensors).forEach(s => { s.status = "offline"; });
      return { score: 0, status: "offline" };
    }

    const customCalculator = HLM.registries.healthCalculators.get(device.type);
    if(customCalculator){
      try{
        Object.values(device.sensors).forEach(sensor => { sensor.status = computeSensorStatus(sensor.value, sensor.def); });
        return customCalculator(device);
      } catch(err){
        console.error(`[healthEngine] custom calculator for "${device.type}" threw, falling back to default:`, err);
      }
    }

    let worstRank = RANK.ok;
    let weightedSum = 0, weightTotal = 0;

    Object.values(device.sensors).forEach(sensor => {
      sensor.status = computeSensorStatus(sensor.value, sensor.def);
      if(sensor.def.weight > 0){
        worstRank = Math.max(worstRank, RANK[sensor.status]);
        weightedSum += HEALTHINESS[sensor.status] * sensor.def.weight;
        weightTotal += sensor.def.weight;
      }
    });

    const status = Object.keys(RANK).find(k => RANK[k] === worstRank) || "ok";
    const score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 100;
    return { score, status };
  }

  function bucketFromDevices(devices){
    if(!devices.length) return "unknown";
    const statuses = devices.map(d => d.health.status);
    if(statuses.every(s => s === "maintenance")) return "maintenance";
    if(statuses.includes("critical")) return "critical";
    if(statuses.includes("offline") || statuses.includes("warn")) return "warn";
    return "ok";
  }

  function computeGroupHealth(devices){
    const scored = devices.filter(d => typeof d.health.score === "number");
    const avgScore = scored.length ? Math.round(scored.reduce((sum, d) => sum + d.health.score, 0) / scored.length) : 100;
    return { score: avgScore, status: bucketFromDevices(devices), deviceCount: devices.length };
  }

  function computeGlobalHealth(devicesMap){
    const devices = Object.values(devicesMap);
    const group = computeGroupHealth(devices);
    return {
      score: group.score,
      status: group.status,
      deviceCount: devices.length,
      okCount: devices.filter(d => d.health.status === "ok").length,
      warnCount: devices.filter(d => d.health.status === "warn").length,
      criticalCount: devices.filter(d => d.health.status === "critical").length,
      offlineCount: devices.filter(d => d.health.status === "offline").length,
      maintenanceCount: devices.filter(d => d.health.status === "maintenance").length,
    };
  }

  HLM.healthEngine = { computeSensorStatus, computeDeviceHealth, computeGroupHealth, computeGlobalHealth, RANK };
})(window.HLM = window.HLM || {});
