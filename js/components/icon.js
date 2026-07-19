/* =====================================================================
   ICON — thin wrapper around the <symbol> sprite defined in index.html.
   Every icon in the app should be produced by HLM.icon(), never by
   hand-writing <svg><use> markup, so renaming or auditing icons is a
   one-file job.
   ===================================================================== */
(function(HLM){
  "use strict";

  // Keep in sync with the <symbol id="icon-*"> sprite in index.html.
  const REGISTRY = new Set([
    "grid","topology","server","network","storage","docker","cpu","cube","logs","settings",
    "search","bell","menu","chevron-left","chevron-right","chevron-down","chevron-up",
    "refresh","wifi","battery","image","shield","home","workflow",
    "close","check","alert-triangle","alert-circle","info","more-horizontal",
    "plus","minus","external-link","trash","edit","expand","minimize","drag-handle",
    "loader","sun","moon","layers","clock","windows","linux"
  ]);

  /**
   * @param {string} name    icon id without the "icon-" prefix
   * @param {string} [cls]   extra class names appended to the base "icon" class
   * @returns {string} inline SVG markup — from a plugin-registered icon
   *   if one exists for `name`, otherwise the shared sprite.
   */
  function icon(name, cls=""){
    const pluginIcon = HLM.registries?.icons?.get(name);
    if(pluginIcon){
      return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${pluginIcon}</svg>`;
    }
    if(!REGISTRY.has(name)){
      console.warn(`[HLM.icon] Unknown icon "${name}" — check the sprite in index.html or register it via ctx.registerIcon().`);
    }
    return `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
  }

  HLM.icon = icon;
})(window.HLM = window.HLM || {});
