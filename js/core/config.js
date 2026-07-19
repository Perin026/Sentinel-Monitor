/* =====================================================================
   CONFIG — the single source of truth for the whole app.
   Phase 1/2 only wire up app meta + navigation. Phase 3 will populate
   DEVICES / SERVICES below; every renderer downstream is written to
   read from here so adding a device later means adding one entry,
   nothing else.
   ===================================================================== */
(function(HLM){
  "use strict";

  const APP = {
    name: "Sentinel Monitor",
    shortName: "Sentinel",
    version: "0.4.0-alpha",
    refreshMs: 2500,
    historyPoints: 120,
    dataUrl: null,          // set to an /api/dashboard endpoint to enable ApiProvider
    dataProvider: "simulation", // "simulation" | "api" | "websocket" — see js/engine/data-provider.js
  };

  // Sidebar navigation. One entry == one view. `id` must match a
  // <section data-view="id"> in index.html and a case in router.js.
  const NAV = [
    {
      section: "Monitoring",
      items: [
        { id: "overview",       label: "Overview",       icon: "grid" },
        { id: "infrastructure", label: "Infrastructure", icon: "topology" },
        { id: "servers",        label: "Servers",        icon: "server" },
        { id: "network",        label: "Network",        icon: "network" },
        { id: "storage",        label: "Storage",        icon: "storage" },
        { id: "docker",         label: "Docker",         icon: "docker" },
        { id: "ai",             label: "AI",             icon: "cpu" },
        { id: "minecraft",      label: "Minecraft",      icon: "cube" },
      ]
    },
    {
      section: "System",
      items: [
        { id: "logs",     label: "Logs",     icon: "logs" },
        { id: "settings", label: "Settings", icon: "settings" },
      ]
    }
  ];

  // Static identity only — id/name/type/hostname/ip. Live sensor state,
  // status, group and history are hydrated at runtime by HLM.deviceModel
  // from whichever plugin registered `type` in HLM.registries.deviceTypes.
  // Adding a device to the fleet means adding one entry here; adding a
  // new *kind* of device means adding a plugin, not editing this file.
  const DEVICES = [
    { id: "pve-01",       name: "pve-01",         type: "proxmox",       hostname: "pve-01.lan",         ip: "10.0.1.10" },
    { id: "pve-02",       name: "pve-02",         type: "proxmox",       hostname: "pve-02.lan",         ip: "10.0.1.11" },
    { id: "win-desktop",  name: "win-workstation",type: "windows",       hostname: "win-workstation",    ip: "10.0.1.40" },
    { id: "linux-01",     name: "svc-linux-01",   type: "linux",         hostname: "svc-linux-01.lan",   ip: "10.0.1.20" },
    { id: "core-switch",  name: "core-switch",    type: "switch",        hostname: "core-switch.lan",    ip: "10.0.0.2" },
    { id: "edge-router",  name: "edge-router",    type: "router",        hostname: "edge-router.lan",    ip: "10.0.0.1" },
    { id: "ap-livingroom",name: "ap-livingroom",  type: "ap",            hostname: "ap-livingroom.lan",  ip: "10.0.0.30" },
    { id: "truenas-01",   name: "truenas-01",     type: "nas",           hostname: "truenas-01.lan",     ip: "10.0.1.30" },
    { id: "docker-01",    name: "docker-host-01", type: "docker",        hostname: "docker-host-01.lan", ip: "10.0.1.21" },
    { id: "portainer-01", name: "portainer",      type: "portainer",     hostname: "docker-host-01.lan", ip: "10.0.1.21" },
    { id: "ollama-01",    name: "ollama-01",      type: "ollama",        hostname: "ai-worker-01.lan",   ip: "10.0.1.50" },
    { id: "openwebui-01", name: "open-webui",     type: "openwebui",     hostname: "ai-worker-01.lan",   ip: "10.0.1.50" },
    { id: "qdrant-01",    name: "qdrant",         type: "qdrant",        hostname: "ai-worker-01.lan",   ip: "10.0.1.50" },
    { id: "mc-smp",       name: "smp-survival",   type: "minecraft",     hostname: "docker-host-01.lan", ip: "10.0.1.21" },
    { id: "mc-creative",  name: "creative-build", type: "minecraft",     hostname: "docker-host-01.lan", ip: "10.0.1.21" },
    { id: "ups-01",       name: "rack-ups",       type: "ups",           hostname: "rack-ups.lan",       ip: "10.0.0.5" },
    { id: "pihole-01",    name: "pi-hole",        type: "pihole",        hostname: "pihole.lan",         ip: "10.0.0.3" },
    { id: "hass-01",      name: "home-assistant", type: "homeassistant", hostname: "hass.lan",           ip: "10.0.1.60" },
    { id: "n8n-01",       name: "n8n",            type: "n8n",           hostname: "n8n.lan",            ip: "10.0.1.61" },
    { id: "immich-01",    name: "immich",         type: "immich",        hostname: "docker-host-01.lan", ip: "10.0.1.21" },
  ];

  const SERVICES = [];

  HLM.config = { APP, NAV, DEVICES, SERVICES };
})(window.HLM = window.HLM || {});
