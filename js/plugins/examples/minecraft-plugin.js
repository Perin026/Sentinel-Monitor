/* =====================================================================
   EXAMPLE PLUGIN — Minecraft.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const MINECRAFT_ICON = `<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>`;

  HLM.createPlugin({
    id: "minecraft",
    name: "Minecraft Server",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Minecraft Java servers as a device type. Demonstration plugin — no live RCON/Query integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("minecraft", MINECRAFT_ICON);

      ctx.registerDevice("minecraft", defineDeviceType({
        label: "Minecraft Server", icon: "minecraft", group: "minecraft",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 1, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 2, volatility: 2 }),
          defineSensor({ key: "players", label: "Players", unit: "", max: 20, weight: 0, volatility: 1 }),
        ],
      }));

      ctx.registerWidget("minecraft.player-list", () => ({
        title: "Players Online",
        render(container, { device }){
          container.textContent = `${device.name}: player list widget (demo — online players would render here)`;
        },
      }));

      ctx.registerCommand("minecraft.triggerBackup", {
        label: "Minecraft: Trigger world backup",
        icon: "layers",
        run(){
          ctx.services.notifications.notify({ title: "Minecraft", message: "Manual backups aren't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("minecraft", {
        title: "Minecraft",
        icon: "minecraft",
        render(container){
          container.textContent = "Minecraft plugin settings (RCON host/port/password) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
