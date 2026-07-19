/* =====================================================================
   CORE DEVICES — the platform's own "built-in plugin".
   These are general-purpose device types (a Windows box, a switch, a
   NAS) rather than specific third-party services. They're shipped by
   default, but they go through HLM.createPlugin() exactly like a
   downloaded plugin would — there is no special hardcoded path for
   "built-in" device types. That's the point of the architecture.
   ===================================================================== */
(function(HLM){
  "use strict";

  const { defineDeviceType, defineSensor } = HLM.sdk;

  const cpuSensor      = (o) => defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 2, volatility: 3, ...o });
  const ramSensor       = (o) => defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 2, volatility: 2, ...o });
  const storageSensor    = (o) => defineSensor({ key: "storage", label: "Disk", unit: "%", warn: 80, critical: 93, weight: 1, volatility: .3, ...o });
  const tempSensor         = (o) => defineSensor({ key: "temp", label: "Temperature", unit: "°C", min: 25, max: 95, warn: 70, critical: 85, weight: 1, volatility: 1.5, ...o });
  const netInSensor          = (o) => defineSensor({ key: "netIn", label: "Net In", unit: " MB/s", max: 120, warn: 95, critical: 112, weight: .5, volatility: 6, ...o });
  const netOutSensor           = (o) => defineSensor({ key: "netOut", label: "Net Out", unit: " MB/s", max: 120, warn: 95, critical: 112, weight: .5, volatility: 5, ...o });
  const latencySensor            = (o) => defineSensor({ key: "latency", label: "Latency", unit: "ms", max: 200, warn: 80, critical: 150, weight: 1, volatility: 4, ...o });
  const clientsSensor              = (o) => defineSensor({ key: "clients", label: "Clients", unit: "", max: 60, warn: 45, critical: 55, weight: .3, volatility: 1, ...o });

  HLM.createPlugin({
    id: "core-devices",
    name: "Core Device Types",
    version: "1.0.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "General-purpose device types (compute, network, storage, power) that ship with the platform.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      const { registerDevice } = ctx;

      registerDevice("windows", defineDeviceType({ label: "Windows", icon: "windows", group: "servers", sensors: [cpuSensor(), ramSensor(), storageSensor(), tempSensor()] }));
      registerDevice("linux",   defineDeviceType({ label: "Linux",   icon: "linux",   group: "servers", sensors: [cpuSensor(), ramSensor(), storageSensor(), tempSensor()] }));
      registerDevice("nas",     defineDeviceType({ label: "NAS",     icon: "storage", group: "storage", sensors: [cpuSensor({ weight: .5 }), ramSensor({ weight: .5 }), storageSensor({ weight: 3, warn: 78, critical: 92 }), tempSensor()] }));
      registerDevice("switch",  defineDeviceType({ label: "Switch",  icon: "network", group: "network", sensors: [cpuSensor({ weight: .5, warn: 85 }), netInSensor(), netOutSensor()] }));
      registerDevice("router",  defineDeviceType({ label: "Router",  icon: "network", group: "network", sensors: [cpuSensor({ weight: .5, warn: 85 }), netInSensor(), netOutSensor(), latencySensor()] }));
      registerDevice("ap",      defineDeviceType({ label: "Access Point", icon: "wifi", group: "network", sensors: [clientsSensor({ weight: 1 }), netInSensor(), netOutSensor()] }));
      registerDevice("ups",     defineDeviceType({ label: "UPS", icon: "battery", group: "infrastructure", sensors: [
        defineSensor({ key: "battery", label: "Battery", unit: "%", warn: 50, critical: 25, weight: 3, volatility: .5, invert: true }),
        defineSensor({ key: "load", label: "Load", unit: "%", warn: 70, critical: 90, weight: 2, volatility: 1 }),
      ] }));
      registerDevice("openwebui", defineDeviceType({ label: "Open WebUI", icon: "cpu", group: "ai", sensors: [cpuSensor({ weight: 1 }), ramSensor({ weight: 1 }), latencySensor({ label: "Response", warn: 900, critical: 2000, max: 2500 })] }));
      registerDevice("qdrant",    defineDeviceType({ label: "Qdrant",     icon: "cpu", group: "ai", sensors: [cpuSensor({ weight: 1 }), ramSensor({ weight: 2 }), storageSensor({ weight: 1 })] }));
      registerDevice("immich",    defineDeviceType({ label: "Immich",     icon: "image", group: "infrastructure", sensors: [cpuSensor({ weight: 1 }), ramSensor({ weight: 1 }), storageSensor({ weight: 2 })] }));
      registerDevice("portainer", defineDeviceType({ label: "Portainer",  icon: "docker", group: "docker", sensors: [cpuSensor({ weight: .5 }), ramSensor({ weight: .5 })] }));
      registerDevice("n8n",       defineDeviceType({ label: "n8n",        icon: "workflow", group: "infrastructure", sensors: [cpuSensor({ weight: 1 }), ramSensor({ weight: 1 })] }));
    },
  });
})(window.HLM = window.HLM || {});
