/* =====================================================================
   EVENT ENGINE — the live event stream. Two sources feed it:
     1. Alert transitions (created/escalated/downgraded/resolved) —
        objective, derived from the health engine, always accurate.
     2. Flavor events — small, type-specific happenings (a container
        restarting, a Minecraft backup finishing) that make the fleet
        feel busy even when nothing is actually wrong. These are
        cosmetic and never drive health/alerts.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { uid, rnd } = HLM.utils;

  function eventsFromAlertTransitions(transitions){
    return transitions.map(({ alert, kind }) => {
      const base = { id: uid("evt"), timestamp: Date.now(), origin: alert.deviceName, deviceId: alert.deviceId };
      switch(kind){
        case "created":
          return { ...base, severity: alert.severity, category: alert.sensorKey ? "sensor" : "availability", description: alert.message };
        case "escalated":
          return { ...base, severity: "critical", category: alert.sensorKey ? "sensor" : "availability", description: `${alert.message} — escalated` };
        case "downgraded":
          return { ...base, severity: "warn", category: alert.sensorKey ? "sensor" : "availability", description: `${alert.message} — improving` };
        case "resolved":
          return {
            ...base, severity: "ok",
            category: alert.sensorKey ? "sensor" : "availability",
            description: alert.sensorKey
              ? `${alert.sensorLabel} on ${alert.deviceName} is back to normal`
              : `${alert.deviceName} is back online`,
          };
      }
    }).filter(Boolean);
  }

  const CONTAINER_NAMES = ["immich_server", "qdrant", "n8n", "homeassistant", "watchtower", "authelia", "traefik"];
  const FLAVOR_CHANCE = 0.01; // per eligible device, per tick

  function flavorEventFor(device){
    if(Math.random() >= FLAVOR_CHANCE) return null;
    const base = { id: uid("evt"), timestamp: Date.now(), origin: device.name, deviceId: device.id };

    if(device.type === "docker" || device.type === "portainer"){
      const container = CONTAINER_NAMES[Math.floor(Math.random() * CONTAINER_NAMES.length)];
      return { ...base, severity: "info", category: "docker", description: `Container ${container} restarted on ${device.name}` };
    }
    if(device.type === "minecraft"){
      return Math.random() < 0.85
        ? { ...base, severity: "ok", category: "backup", description: `World backup completed on ${device.name}` }
        : { ...base, severity: "warn", category: "backup", description: `World backup failed on ${device.name}, retrying` };
    }
    return null;
  }

  function upsPowerEventFor(device, wasInIncident){
    if(device.type !== "ups") return null;
    const nowInIncident = !!device.incident;
    if(nowInIncident && !wasInIncident){
      return { id: uid("evt"), timestamp: Date.now(), origin: device.name, deviceId: device.id, severity: "warn", category: "power", description: `${device.name} switched to battery power` };
    }
    if(!nowInIncident && wasInIncident){
      return { id: uid("evt"), timestamp: Date.now(), origin: device.name, deviceId: device.id, severity: "ok", category: "power", description: `${device.name} returned to mains power` };
    }
    return null;
  }

  /**
   * @param devicesMap        current device state (post-simulation-step)
   * @param transitions         this tick's alert transitions
   * @param prevIncidentById      Map<deviceId, boolean> — incident state before this tick, for UPS edge detection
   */
  function processTick(devicesMap, transitions, prevIncidentById){
    const events = eventsFromAlertTransitions(transitions);

    Object.values(devicesMap).forEach(device => {
      const wasInIncident = prevIncidentById.get(device.id) || false;
      const upsEvent = upsPowerEventFor(device, wasInIncident);
      if(upsEvent){ events.push(upsEvent); return; }
      if(device.status === "offline" || device.maintenance) return;
      const flavor = flavorEventFor(device);
      if(flavor) events.push(flavor);
    });

    return events;
  }

  HLM.eventEngine = { processTick };
})(window.HLM = window.HLM || {});
