/* =====================================================================
   CORE WIDGETS — registers the platform's built-in widget kinds.
   HLM.registries.widgets.get("circular-gauge") returns a *factory*,
   not an instance — nothing is constructed until a caller resolves and
   invokes it, which is what "support lazy loading" means in practice
   for a synchronous, single-file app (no dynamic import() needed to
   get the benefit: construction cost is deferred, not file loading).
   ===================================================================== */
(function(HLM){
  "use strict";

  HLM.createPlugin({
    id: "core-widgets",
    name: "Core Widgets",
    version: "1.0.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Built-in widget kinds (gauges, counters, progress bars, device cards) available to any plugin.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerWidget("circular-gauge", () => HLM.ui.createCircularGauge);
      ctx.registerWidget("linear-gauge", () => HLM.ui.createLinearGauge);
      ctx.registerWidget("counter", () => HLM.ui.createCounter);
      ctx.registerWidget("progress-bar", () => HLM.ui.createProgressBar);
      ctx.registerWidget("device-card", () => HLM.ui.createDeviceCard);
    },
  });
})(window.HLM = window.HLM || {});
