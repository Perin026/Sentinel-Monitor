/* =====================================================================
   MONITORING SCHEDULER — Phase 4. Polls real sensors independently of
   the simulation tick, one self-rescheduling chain per (device, sensor)
   pair rather than a single interval driving everything. That's what
   makes intervals genuinely per-sensor and keeps a slow poll from ever
   overlapping itself.

   A sensor only gets scheduled here if two things are both true:
     1. its *definition* (device type, from a plugin) declares a
        `monitor` config — see HLM.sdk.defineMonitor()
     2. the *device instance* (its config.js seed) has `monitored: true`

   That split matters: device *types* are shared (every "minecraft"
   device uses the same sensor defs), but only some *instances* point at
   something real. Sensors on non-monitored devices are untouched and
   keep being driven by the simulation, exactly as before.

   This module never touches HLM.store directly except to read
   `maintenance` (to pause polling) — it has no idea a UI exists. Engine.js
   is the only thing that reads getSensorState()/getAll() and merges the
   result into a tick's snapshot (see overlayLiveSensors() there). That
   mirrors the same one-way layering DataProvider already follows: this
   produces data, it doesn't consume or render it.
   ===================================================================== */
(function(HLM){
  "use strict";

  const MAX_CONCURRENT = 6;
  const MAX_BACKOFF_MS = 5000;

  const seedsById = new Map();     // deviceId -> config.js seed (id/name/type/hostname/ip/monitored)
  const states = new Map();        // "deviceId:sensorKey" -> live sensor record
  const timers = new Map();        // "deviceId:sensorKey" -> setTimeout handle
  let started = false;

  let activeCount = 0;
  const waitQueue = [];
  function acquireSlot(){
    if(activeCount < MAX_CONCURRENT){ activeCount++; return Promise.resolve(); }
    return new Promise(resolve => waitQueue.push(resolve));
  }
  function releaseSlot(){
    activeCount--;
    const next = waitQueue.shift();
    if(next){ activeCount++; next(); }
  }

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  function withTimeout(promise, ms){
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  function stateKey(deviceId, sensorKey){ return `${deviceId}:${sensorKey}`; }

  function ensureRecord(deviceId, sensorKey, monitor){
    const key = stateKey(deviceId, sensorKey);
    if(!states.has(key)){
      states.set(key, {
        deviceId, sensorKey, provider: monitor.provider,
        value: null, previousValue: null,
        monitorStatus: "unknown",     // "unknown" | "up" | "down" | "paused"
        responseTimeMs: null,
        lastUpdate: null, lastSuccessfulUpdate: null, nextCheckAt: null,
        intervalMs: monitor.intervalMs,
        meta: null, failureStreak: 0, lastError: null,
      });
    }
    return states.get(key);
  }

  function scheduleNext(deviceId, sensorKey, delayMs){
    const key = stateKey(deviceId, sensorKey);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { runPollCycle(deviceId, sensorKey); }, delayMs));
  }

  /** One full attempt-with-retries cycle for a single sensor, then reschedules itself. */
  async function runPollCycle(deviceId, sensorKey){
    const seed = seedsById.get(deviceId);
    const typeDef = seed && HLM.registries.deviceTypes.get(seed.type);
    const sensorDef = typeDef?.sensors.find(s => s.key === sensorKey);
    if(!seed || !sensorDef?.monitor){
      // Device/sensor/plugin no longer exists (e.g. plugin disabled) — stop this chain for good.
      states.delete(stateKey(deviceId, sensorKey));
      return;
    }
    const monitor = sensorDef.monitor;
    const record = ensureRecord(deviceId, sensorKey, monitor);

    if(HLM.store.get().devices[deviceId]?.maintenance){
      record.monitorStatus = "paused";
      record.lastUpdate = Date.now();
      record.nextCheckAt = Date.now() + monitor.intervalMs;
      scheduleNext(deviceId, sensorKey, monitor.intervalMs);
      return;
    }

    await acquireSlot();
    const start = Date.now();
    let lastError = null;
    try{
      for(let attempt = 0; attempt <= monitor.retries; attempt++){
        try{
          const provider = HLM.registries.sensorProviders.get(monitor.provider);
          if(!provider) throw new Error(`No sensor provider registered for "${monitor.provider}"`);
          const result = await withTimeout(provider.poll(seed, sensorDef), monitor.timeoutMs);

          record.previousValue = record.value;
          record.value = result.value;
          record.meta = result.meta || null;
          record.monitorStatus = "up";
          record.responseTimeMs = Date.now() - start;
          record.lastUpdate = Date.now();
          record.lastSuccessfulUpdate = record.lastUpdate;
          record.failureStreak = 0;
          record.lastError = null;
          lastError = null;
          break;
        } catch(err){
          lastError = err;
          if(attempt < monitor.retries) await sleep(Math.min(MAX_BACKOFF_MS, 750 * (attempt + 1)));
        }
      }
      if(lastError){
        record.monitorStatus = "down";
        record.responseTimeMs = null;
        record.lastUpdate = Date.now();
        record.failureStreak += 1;
        record.lastError = lastError.message || String(lastError);
        console.error(`[monitoring] ${deviceId}:${sensorKey} (${monitor.provider}) failed after ${monitor.retries + 1} attempt(s): ${record.lastError}`);
      }
    } finally {
      releaseSlot();
    }

    record.nextCheckAt = Date.now() + monitor.intervalMs;
    scheduleNext(deviceId, sensorKey, monitor.intervalMs);
  }

  /** Walks the fleet config once, schedules a jittered first poll for every monitored sensor. */
  function start(){
    if(started) return;
    started = true;

    seedsById.clear();
    HLM.config.DEVICES.forEach(seed => seedsById.set(seed.id, seed));

    seedsById.forEach(seed => {
      if(!seed.monitored) return;
      const typeDef = HLM.registries.deviceTypes.get(seed.type);
      if(!typeDef) return;
      typeDef.sensors.forEach(sensorDef => {
        if(!sensorDef.monitor) return;
        ensureRecord(seed.id, sensorDef.key, sensorDef.monitor);
        // Jittered so N sensors on the same interval don't all fire in lockstep.
        scheduleNext(seed.id, sensorDef.key, Math.random() * sensorDef.monitor.intervalMs);
      });
    });
  }

  function stop(){
    timers.forEach(handle => clearTimeout(handle));
    timers.clear();
    started = false;
  }

  function isMonitored(deviceId){
    return !!seedsById.get(deviceId)?.monitored;
  }

  function getSensorState(deviceId, sensorKey){
    return states.get(stateKey(deviceId, sensorKey)) || null;
  }

  function getAll(){
    return [...states.values()];
  }

  HLM.monitoringScheduler = { start, stop, isMonitored, getSensorState, getAll };
})(window.HLM = window.HLM || {});
