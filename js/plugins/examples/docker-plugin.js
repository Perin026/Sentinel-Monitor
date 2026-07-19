/* =====================================================================
   EXAMPLE PLUGIN — Docker.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const DOCKER_ICON = `<path d="M3 11h4v4H3zM8 11h4v4H8zM13 11h4v4h-4zM8 6h4v4H8z"/><path d="M2 15c0 4 3.5 6.5 9 6.5 6 0 10-3 11-8-1 .5-2 .3-2.6-.4-.8 1-2 1-2.8 0"/>`;

  HLM.createPlugin({
    id: "docker",
    name: "Docker",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Docker hosts as a device type. Demonstration plugin — no live Docker API integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("docker", DOCKER_ICON);

      ctx.registerDevice("docker", defineDeviceType({
        label: "Docker Host", icon: "docker", group: "docker",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 2, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 2, volatility: 2 }),
          defineSensor({ key: "storage", label: "Disk", unit: "%", warn: 80, critical: 93, weight: .5, volatility: .3 }),
        ],
      }));

      ctx.registerWidget("docker.container-list", () => ({
        title: "Containers",
        render(container, { device }){
          container.textContent = `${device.name}: container list widget (demo — live container states would render here)`;
        },
      }));

      ctx.registerCommand("docker.restartContainer", {
        label: "Docker: Restart container…",
        icon: "refresh",
        run(){
          ctx.services.notifications.notify({ title: "Docker", message: "Container control isn't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("docker", {
        title: "Docker",
        icon: "docker",
        render(container){
          container.textContent = "Docker plugin settings (socket path, API version) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
