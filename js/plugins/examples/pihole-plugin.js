/* =====================================================================
   EXAMPLE PLUGIN — Pi-hole.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const PIHOLE_ICON = `<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="M9.5 12a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"/>`;

  HLM.createPlugin({
    id: "pihole",
    name: "Pi-hole",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Pi-hole DNS sinkholes as a device type. Demonstration plugin — no live API integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("pihole", PIHOLE_ICON);

      ctx.registerDevice("pihole", defineDeviceType({
        label: "Pi-hole", icon: "pihole", group: "infrastructure",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: .5, volatility: 3 }),
          defineSensor({ key: "blocked", label: "Blocked", unit: "%", max: 100, weight: 0, volatility: 2 }),
        ],
      }));

      ctx.registerWidget("pihole.query-summary", () => ({
        title: "Query Summary",
        render(container, { device }){
          container.textContent = `${device.name}: query summary widget (demo — blocked/allowed query counts would render here)`;
        },
      }));

      ctx.registerCommand("pihole.toggleBlocking", {
        label: "Pi-hole: Toggle blocking",
        icon: "shield",
        run(){
          ctx.services.notifications.notify({ title: "Pi-hole", message: "Blocking toggle isn't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("pihole", {
        title: "Pi-hole",
        icon: "pihole",
        render(container){
          container.textContent = "Pi-hole plugin settings (API host, API token) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
