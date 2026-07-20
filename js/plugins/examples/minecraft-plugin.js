/* =====================================================================
   EXAMPLE PLUGIN — Minecraft.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const MINECRAFT_ICON = `<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>`;

  /**
   * Real integration (Phase 4), not a demonstration stub: mcsrvstat.us is a
   * public, CORS-enabled JSON API that speaks the actual Minecraft Server
   * List Ping protocol server-side, so the browser gets genuine online
   * status/player count/MOTD/version without needing a raw TCP socket
   * (which browser JS can't open — see docs/architecture.md). Only
   * activates for a device whose config.js seed has `monitored: true`;
   * the two demo-fleet Minecraft devices don't, so they keep simulating.
   */
  const minecraftSensorProvider = {
    async poll(seed, sensorDef){
      const monitor = sensorDef.monitor;
      const host = seed.hostname || seed.ip;
      const port = monitor.port || 25565;
      const url = `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${port}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), monitor.timeoutMs);
      const start = performance.now();
      let res;
      try{
        res = await fetch(url, { cache: "no-store", signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const latencyMs = Math.round(performance.now() - start);
      if(!res.ok) throw new Error(`mcsrvstat.us responded HTTP ${res.status}`);

      const data = await res.json();
      if(!data.online) throw new Error("Server reported offline");

      return {
        value: data.players?.online ?? 0,
        meta: {
          maxPlayers: data.players?.max ?? null,
          motd: data.motd?.clean?.[0] || "",
          version: data.version || "",
          latencyMs,
        },
      };
    },
  };

  HLM.createPlugin({
    id: "minecraft",
    name: "Minecraft Server",
    version: "0.2.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Minecraft Java servers as a device type, with a real player-count/MOTD/version check via mcsrvstat.us for devices marked `monitored: true`.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("minecraft", MINECRAFT_ICON);
      ctx.registerSensorProvider("minecraft", minecraftSensorProvider);

      ctx.registerDevice("minecraft", defineDeviceType({
        label: "Minecraft Server", icon: "minecraft", group: "minecraft",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 1, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 2, volatility: 2 }),
          defineSensor({
            key: "players", label: "Players", unit: "", max: 100, weight: 0, volatility: 1,
            monitor: { provider: "minecraft", intervalMs: 60000, timeoutMs: 8000, retries: 1, primary: true, port: 25565 },
          }),
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
