/* =====================================================================
   SIMULATION PROVIDER — models realistic fleet behavior instead of
   emitting pure random noise:
     - each sensor has a slow-drifting "target" it wanders toward
       (normal fluctuation + slow trend)
     - sensors occasionally spike toward their critical band and decay
       back down (random spike)
     - devices occasionally enter a temporary incident — "offline" or
       "degraded" — for a random duration, then recover on their own
       (temporary failure + automatic recovery)
     - devices flagged `maintenance` are exempt from random incidents

   This is the only place in the app that invents numbers. Everything
   downstream (health/alert/event engines, all UI) treats this exactly
   like it would treat a real backend snapshot.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { rnd, clamp } = HLM.utils;

  const INCIDENT_CHANCE_PER_TICK = 0.0015;   // per device, per tick
  const SPIKE_CHANCE_PER_TICK = 0.02;         // per sensor, per tick
  const SPIKE_DECAY = 0.35;                    // fraction spike shrinks by, per tick

  function gaussianNoise(scale){
    // Box-Muller, cheap approximation is fine for a UI simulator.
    const u = Math.random() || 1e-6, v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale;
  }

  function stepSensor(sensor){
    const { def } = sensor;
    const range = def.max - def.min;

    if(sensor._target == null){
      sensor._target = sensor.value;
      sensor._spike = 0;
    }

    // Slow trend: the target itself wanders occasionally.
    if(Math.random() < 0.04){
      const driftBand = def.invert ? [def.min, def.min + range * 0.35] : [def.min + range * 0.15, def.min + range * 0.55];
      sensor._target = clamp(sensor._target + rnd(-1, 1) * range * 0.05, driftBand[0], driftBand[1]);
    }

    // Random acute spike, decaying back down over subsequent ticks.
    if(sensor._spike <= 0.5 && Math.random() < SPIKE_CHANCE_PER_TICK){
      sensor._spike = range * rnd(0.3, 0.7);
    } else {
      sensor._spike *= SPIKE_DECAY;
    }

    const pull = (sensor._target - sensor.value) * 0.18;
    const noise = gaussianNoise(def.volatility);
    const spikeDirection = def.invert ? -1 : 1;
    const next = sensor.value + pull + noise + sensor._spike * spikeDirection * 0.15;

    sensor.value = Math.round(clamp(next, def.min, def.max) * 10) / 10;
  }

  function forceIncidentValues(device){
    const kind = device.incident.kind;
    Object.values(device.sensors).forEach(sensor => {
      const { def } = sensor;
      if(kind === "offline"){
        sensor.value = def.invert ? def.min : def.min; // flatlined
      } else if(kind === "degraded"){
        const band = def.invert ? [def.min, def.min + (def.max - def.min) * 0.2] : [def.critical, def.max];
        sensor.value = clamp(sensor.value + rnd(-1, 1) * 2, band[0], band[1]);
      }
    });
  }

  function stepDevice(device){
    if(device.incident){
      device.incident.ticksRemaining -= 1;
      if(device.incident.ticksRemaining <= 0){
        device.incident = null;
        device.status = "ok";
      } else {
        forceIncidentValues(device);
        device.status = device.incident.kind === "offline" ? "offline" : "warn";
        device.lastCheck = Date.now();
        return;
      }
    } else if(!device.maintenance && Math.random() < INCIDENT_CHANCE_PER_TICK){
      device.incident = {
        kind: Math.random() < 0.3 ? "offline" : "degraded",
        ticksRemaining: Math.round(rnd(4, 14)),
      };
      forceIncidentValues(device);
      device.status = device.incident.kind === "offline" ? "offline" : "warn";
      device.lastCheck = Date.now();
      return;
    }

    Object.values(device.sensors).forEach(stepSensor);
    device.status = "ok";
    device.lastCheck = Date.now();
  }

  class SimulationProvider extends HLM.dataProvider.DataProvider {
    constructor(opts){
      super(opts);
      this.intervalMs = opts.intervalMs || 2500;
      this._timer = null;
      this._devices = null;
    }

    _seedDevices(){
      this._devices = {};
      HLM.config.DEVICES.forEach(seed => {
        this._devices[seed.id] = HLM.deviceModel.hydrateDevice(seed);
      });
    }

    _toSnapshotDevice(device){
      const sensors = {};
      Object.entries(device.sensors).forEach(([key, sensor]) => {
        sensors[key] = { def: sensor.def, value: sensor.value, status: sensor.status };
      });
      return {
        id: device.id, name: device.name, type: device.type,
        hostname: device.hostname, ip: device.ip, group: device.group,
        status: device.status, maintenance: device.maintenance,
        incident: device.incident ? { kind: device.incident.kind, ticksRemaining: device.incident.ticksRemaining } : null,
        bootedAt: device.bootedAt, lastCheck: device.lastCheck,
        sensors,
      };
    }

    _tick(){
      Object.values(this._devices).forEach(stepDevice);
      const snapshotDevices = {};
      Object.entries(this._devices).forEach(([id, device]) => {
        snapshotDevices[id] = this._toSnapshotDevice(device);
      });
      this.onTick({ devices: snapshotDevices, timestamp: Date.now() });
    }

    start(){
      if(!this._devices) this._seedDevices();
      this.onStatus("simulated");
      this._tick();
      this._timer = setInterval(() => this._tick(), this.intervalMs);
    }

    stop(){
      clearInterval(this._timer);
    }

    refresh(){
      this._tick();
    }

    /** Toggle maintenance mode for a device; exempts it from random incidents. */
    setMaintenance(deviceId, isUnderMaintenance){
      const device = this._devices?.[deviceId];
      if(!device) return;
      device.maintenance = isUnderMaintenance;
      if(isUnderMaintenance) device.incident = null;
    }
  }

  HLM.SimulationProvider = SimulationProvider;
  HLM.registries.dataProviders.register("simulation", SimulationProvider, "core");
})(window.HLM = window.HLM || {});
