/* =====================================================================
   CONTEXT MENU — right-click menu for any container.
   The caller supplies a resolver so this file never has to know what
   a "device card" or "widget" is: enableContextMenu(container, (target, evt) => items|null).
   ===================================================================== */
(function(HLM){
  "use strict";

  function enableContextMenu(container, resolveItems){
    function onContextMenu(e){
      const items = resolveItems(e.target, e);
      if(!items || !items.length) return; // fall back to the native menu
      e.preventDefault();
      HLM.ui.openMenuAt(e.clientX, e.clientY, items);
    }
    container.addEventListener("contextmenu", onContextMenu);
    return () => container.removeEventListener("contextmenu", onContextMenu);
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.enableContextMenu = enableContextMenu;
})(window.HLM = window.HLM || {});
