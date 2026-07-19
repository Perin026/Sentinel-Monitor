/* =====================================================================
   FAB — floating action button + quick action stack.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el } = HLM.utils;

  function initFab(actions){
    const container = el("div", { class: "fab-container" });

    const actionsEl = el("div", { class: "fab-actions" }, actions.map(a =>
      el("div", { class: "fab-action" }, [
        el("span", { class: "fab-action-label" }, [a.label]),
        el("button", { class: "fab-action-btn", type: "button", "aria-label": a.label, html: HLM.icon(a.icon), onclick: () => { a.onClick(); close(); } }),
      ])
    ));

    const mainBtn = el("button", { class: "fab-main", type: "button", "aria-label": "Quick actions", html: HLM.icon("plus"), onclick: toggle });

    container.append(actionsEl, mainBtn);
    document.body.append(container);

    function open(){ container.classList.add("is-open"); document.addEventListener("mousedown", onDocClick, true); }
    function close(){ container.classList.remove("is-open"); document.removeEventListener("mousedown", onDocClick, true); }
    function toggle(){ container.classList.contains("is-open") ? close() : open(); }
    function onDocClick(e){ if(!container.contains(e.target)) close(); }

    return { el: container, open, close, toggle };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.initFab = initFab;
})(window.HLM = window.HLM || {});
