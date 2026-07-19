/* =====================================================================
   EXAMPLE PLUGIN — Ollama.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { defineDeviceType, defineSensor } = HLM.sdk;

  const OLLAMA_ICON = `<circle cx="12" cy="12" r="8"/><path d="M9 10c0-1 .8-1.8 1.8-1.8M9 15c1 .6 2.2.9 3 .9M15 10c0-1-.8-1.8-1.8-1.8"/>`;

  HLM.createPlugin({
    id: "ollama",
    name: "Ollama",
    version: "0.1.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Ollama local-LLM hosts as a device type. Demonstration plugin — no live API integration.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerIcon("ollama", OLLAMA_ICON);

      ctx.registerDevice("ollama", defineDeviceType({
        label: "Ollama", icon: "ollama", group: "ai",
        sensors: [
          defineSensor({ key: "cpu", label: "CPU", unit: "%", warn: 75, critical: 90, weight: 1, volatility: 3 }),
          defineSensor({ key: "ram", label: "Memory", unit: "%", warn: 80, critical: 93, weight: 1, volatility: 2 }),
          defineSensor({ key: "gpu", label: "GPU", unit: "%", warn: 85, critical: 96, weight: 2, volatility: 4 }),
        ],
      }));

      ctx.registerWidget("ollama.model-list", () => ({
        title: "Loaded Models",
        render(container, { device }){
          container.textContent = `${device.name}: loaded model list widget (demo — active models would render here)`;
        },
      }));

      ctx.registerCommand("ollama.pullModel", {
        label: "Ollama: Pull model…",
        icon: "plus",
        run(){
          ctx.services.notifications.notify({ title: "Ollama", message: "Model management isn't wired up in this demo plugin.", level: "info" });
        },
      });

      ctx.registerSettingsPanel("ollama", {
        title: "Ollama",
        icon: "ollama",
        render(container){
          container.textContent = "Ollama plugin settings (API host, default model) would live here.";
        },
      });
    },
  });
})(window.HLM = window.HLM || {});
