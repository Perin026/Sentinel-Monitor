/* =====================================================================
   CORE VISUALIZATIONS — registers the Phase 4.6 chart kinds through the
   same widget registry every other built-in and third-party widget uses
   (see core-widgets.js). Kept in its own plugin, not folded into
   core-widgets, because visualization is a distinct capability area with
   more coming (treemap, heatmap, status matrix, topology in later 4.6
   milestones) — one file per capability, same as the rest of the repo.

   Factories, not instances: nothing is constructed until a caller
   resolves the widget and invokes it (lazy by construction, no dynamic
   import needed — see core-widgets.js's header for why that's the shape).
   ===================================================================== */
(function(HLM){
  "use strict";

  HLM.createPlugin({
    id: "core-visualizations",
    name: "Core Visualizations",
    version: "1.0.0",
    author: "Sentinel Monitor",
    license: "MIT",
    description: "Built-in visualization widgets (sparklines, time-series charts) available to any plugin.",
    minCoreVersion: "1.0.0",
    setup(ctx){
      ctx.registerWidget("sparkline", () => HLM.ui.createSparkline);
      ctx.registerWidget("time-chart", () => HLM.ui.createTimeChart);
      ctx.registerWidget("treemap", () => HLM.ui.createTreemap);
      ctx.registerWidget("status-matrix", () => HLM.ui.createStatusMatrix);
      ctx.registerWidget("heatmap", () => HLM.ui.createHeatmap);
    },
  });
})(window.HLM = window.HLM || {});
