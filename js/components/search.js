/* =====================================================================
   SEARCH — command palette. Indexes navigation today; device/service
   entries plug in automatically once HLM.config.DEVICES is populated
   in Phase 3 (see buildIndex()).
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, qsa } = HLM.utils;

  let backdrop = null;

  function buildIndex(){
    const navEntries = HLM.config.NAV.flatMap(group => group.items.map(item => ({
      type: "view",
      label: item.label,
      meta: group.section,
      icon: item.icon,
      onSelect: () => HLM.router.goTo(item.id),
    })));

    const deviceEntries = HLM.config.DEVICES.map(d => ({
      type: "device",
      label: d.name,
      meta: d.ip || d.hostname || "",
      icon: (HLM.registries.deviceTypes.get(d.type) || {}).icon || "server",
      onSelect: () => HLM.events.emit("search:select-device", d.id),
    }));

    const commandEntries = HLM.registries.commands.list().map(({ id, value: command }) => ({
      type: "command",
      label: command.label || id,
      meta: "Command",
      icon: command.icon || "external-link",
      onSelect: () => command.run(),
    }));

    return [...navEntries, ...deviceEntries, ...commandEntries];
  }

  function close(){
    if(!backdrop) return;
    const node = backdrop;
    node.classList.add("is-closing");
    setTimeout(() => node.remove(), 150);
    backdrop = null;
  }

  function renderResults(list, query, container){
    container.innerHTML = "";
    const filtered = query
      ? list.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
      : list;

    if(!filtered.length){
      container.append(el("div", { class: "search-empty" }, [`No results for "${query}"`]));
      return;
    }

    filtered.slice(0, 20).forEach((item, i) => {
      container.append(el("button", {
        class: `search-result${i === 0 ? " is-active" : ""}`,
        type: "button",
        html: HLM.icon(item.icon),
        onclick: () => { item.onSelect(); close(); },
      }, [
        el("span", {}, [item.label]),
        el("span", { class: "result-meta" }, [item.meta]),
      ]));
    });
  }

  function open(){
    if(backdrop) return;
    const index = buildIndex();

    const input = el("input", { type: "text", placeholder: "Search views, devices, logs…", "aria-label": "Search" });
    const results = el("div", { class: "search-results" });

    const palette = el("div", { class: "search-palette" }, [
      el("div", { class: "search-palette-input-row" }, [
        el("span", { html: HLM.icon("search") }),
        input,
        el("kbd", {}, ["esc"]),
      ]),
      results,
    ]);

    backdrop = el("div", { class: "search-backdrop" }, [palette]);
    document.body.append(backdrop);
    input.focus();
    renderResults(index, "", results);

    input.addEventListener("input", () => renderResults(index, input.value, results));

    function moveActive(dir){
      const items = qsa(".search-result", results);
      const idx = items.findIndex(i => i.classList.contains("is-active"));
      items[idx]?.classList.remove("is-active");
      const next = items[(idx + dir + items.length) % items.length];
      next?.classList.add("is-active");
      next?.scrollIntoView({ block: "nearest" });
    }

    function onKeydown(e){
      if(e.key === "Escape"){ close(); }
      else if(e.key === "ArrowDown"){ e.preventDefault(); moveActive(1); }
      else if(e.key === "ArrowUp"){ e.preventDefault(); moveActive(-1); }
      else if(e.key === "Enter"){ qsa(".search-result", results).find(i => i.classList.contains("is-active"))?.click(); }
    }
    backdrop.addEventListener("keydown", onKeydown);
    backdrop.addEventListener("mousedown", (e) => { if(e.target === backdrop) close(); });
  }

  function initSearchTrigger(){
    const field = HLM.utils.qs(".header-search");
    if(!field) return;
    field.addEventListener("focus", (e) => { e.preventDefault(); field.querySelector("input").blur(); open(); });
    field.addEventListener("click", open);
    document.addEventListener("keydown", (e) => {
      if(e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA"){
        e.preventDefault();
        open();
      }
    });
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.openSearch = open;
  HLM.ui.initSearchTrigger = initSearchTrigger;
})(window.HLM = window.HLM || {});
