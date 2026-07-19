/* =====================================================================
   THEME — sets data-theme on <html>. Only "dark" ships today (the app
   is designed dark-first for a wall-mounted NOC display), but state,
   storage and the toggle path already exist so a future light theme
   is a CSS-only addition, not a rewrite.
   ===================================================================== */
(function(HLM){
  "use strict";

  const STORAGE_KEY = "hlm.theme";

  function apply(theme){
    document.documentElement.setAttribute("data-theme", theme);
  }

  function initTheme(){
    const saved = localStorage.getItem(STORAGE_KEY);
    apply(saved || "dark");
  }

  function setTheme(theme){
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
    HLM.events.emit("theme:change", theme);
  }

  function currentTheme(){
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  HLM.theme = { initTheme, setTheme, currentTheme };
})(window.HLM = window.HLM || {});
