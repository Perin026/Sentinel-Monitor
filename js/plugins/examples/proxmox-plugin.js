/* =====================================================================
   EXAMPLE PLUGIN — Proxmox VE.
   Registers a device type, a summary widget, a command, a custom icon
   and a settings panel. No real Proxmox API calls — this proves the
   plugin surface works, it isn't a Proxmox integration.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const PROXMOX_ICON = `<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><circle cx="12" cy="12" r="3.2"/>`;

  HLM.createPlugin({
    id: "proxmox",
    name: "Proxmox VE",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Proxmox VE hypervisor hosts as a device type. Demonstration plugin — no live API integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("proxmox", PROXMOX_ICON);

      ctx.registerDevice("proxmox", defineDeviceType({
        label: "Proxmox VE", icon: "proxmox", group: "servers",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 3, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 3, volatility: 2 }),
          defineSensor({ key: "storage", label: "Disk", unit: "%", warn: 80, critical: 93, weight: 1, volatility: .3 }),
          defineSensor({ key: "temp", label: "Temperature", unit: "°C", min: 25, max: 95, warn: 70, critical: 85, weight: 1, volatility: 1.5 }),
        ],
      }));

      ctx.registerWidget("proxmox.node-summary", () => ({
        title: "Proxmox Node",
        render(container, { device }){
          container.textContent = `${device.name}: node summary widget (demo — VM/CT counts would render here)`;
        },
      }));

      ctx.registerCommand("proxmox.openConsole", {
        label: "Proxmox: Open node console",
        icon: "external-link",
        run(){
          ctx.services.notifications.notify({ title: "Proxmox", message: "Console access isn't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("proxmox", {
        title: "Proxmox VE",
        icon: "proxmox",
        render(container){
          container.textContent = "Proxmox plugin settings (API host, token) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
