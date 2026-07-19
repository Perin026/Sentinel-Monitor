/* =====================================================================
   ROUTER — swaps the visible <section data-view="..."> and keeps the
   sidebar, page title and URL hash in sync. No history library needed
   for a single-page dashboard with a flat view list.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { qs, qsa } = HLM.utils;

  function viewLabel(id){
    for(const group of HLM.config.NAV){
      const match = group.items.find(i => i.id === id);
      if(match) return match.label;
    }
    return id;
  }

  function goTo(viewId){
    if(!qs(`.view[data-view="${viewId}"]`)) return;

    qsa(".view").forEach(v => v.classList.toggle("is-active", v.dataset.view === viewId));
    qsa(".nav-item").forEach(n => {
      const active = n.dataset.view === viewId;
      n.classList.toggle("is-active", active);
      if(active) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });

    const titleEl = qs("#currentViewTitle");
    if(titleEl) titleEl.textContent = viewLabel(viewId);

    document.title = `${viewLabel(viewId)} · ${HLM.config.APP.name}`;
    if(history.replaceState) history.replaceState(null, "", `#${viewId}`);

    HLM.store.set({ activeView: viewId, mobileNavOpen: false });
    HLM.events.emit("route:change", viewId);
  }

  function initRouter(){
    qsa(".nav-item[data-view]").forEach(item => {
      item.addEventListener("click", () => goTo(item.dataset.view));
    });

    const initial = (location.hash || "").replace("#", "") || HLM.store.get().activeView;
    goTo(qs(`.view[data-view="${initial}"]`) ? initial : "overview");
  }

  HLM.router = { goTo, initRouter, viewLabel };
})(window.HLM = window.HLM || {});
