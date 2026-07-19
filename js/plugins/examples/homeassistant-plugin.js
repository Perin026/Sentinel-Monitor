/* =====================================================================
   EXAMPLE PLUGIN — Home Assistant.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const HASS_ICON = `<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>`;

  HLM.createPlugin({
    id: "homeassistant",
    name: "Home Assistant",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Home Assistant core as a device type. Demonstration plugin — no live API integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("homeassistant", HASS_ICON);

      ctx.registerDevice("homeassistant", defineDeviceType({
        label: "Home Assistant", icon: "homeassistant", group: "infrastructure",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 1, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 1, volatility: 2 }),
        ],
      }));

      ctx.registerWidget("homeassistant.automation-summary", () => ({
        title: "Automations",
        render(container, { device }){
          container.textContent = `${device.name}: automation summary widget (demo — active automations would render here)`;
        },
      }));

      ctx.registerCommand("homeassistant.runAutomation", {
        label: "Home Assistant: Run automation…",
        icon: "workflow",
        run(){
          ctx.services.notifications.notify({ title: "Home Assistant", message: "Automation triggers aren't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("homeassistant", {
        title: "Home Assistant",
        icon: "homeassistant",
        render(container){
          container.textContent = "Home Assistant plugin settings (base URL, long-lived token) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
