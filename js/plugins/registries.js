/* =====================================================================
   REGISTRIES — one createRegistry() per extension point.
   Core code reads from these. Plugins write to them (through the SDK,
   never directly). Nothing here knows what a "Proxmox" or "Docker" is.
   ===================================================================== */
(function(HLM){
  "use strict";

  HLM.registries = {
    deviceTypes:          HLM.createRegistry("deviceTypes"),          // Step 5
    widgets:               HLM.createRegistry("widgets"),              // Step 4
    pages:                   HLM.createRegistry("pages"),                // nav pages/routes
    commands:                 HLM.createRegistry("commands"),
    dataProviders:              HLM.createRegistry("dataProviders"),      // Step 6
    notificationProviders:        HLM.createRegistry("notificationProviders"),
    settingsPanels:                 HLM.createRegistry("settingsPanels"),
    actions:                          HLM.createRegistry("actions"),        // toolbar/FAB/context-menu actions
    healthCalculators:                  HLM.createRegistry("healthCalculators"),
    alertRules:                           HLM.createRegistry("alertRules"),
    backgroundTasks:                        HLM.createRegistry("backgroundTasks"),
    themes:                                   HLM.createRegistry("themes"),
    translations:                               HLM.createRegistry("translations"),
    icons:                                        HLM.createRegistry("icons"),
  };
})(window.HLM = window.HLM || {});
