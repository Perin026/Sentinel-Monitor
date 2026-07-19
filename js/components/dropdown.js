/* =====================================================================
   DROPDOWN — floating menu anchored to a trigger element.
   Shares the .menu visual language (menu.css) with context-menu.js,
   which anchors the same markup to a cursor position instead.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, qsa } = HLM.utils;

  let activeMenu = null;
  let activeCleanup = null;

  function closeActive(){
    if(!activeMenu) return;
    activeMenu.remove();
    activeMenu = null;
    if(activeCleanup) activeCleanup();
    activeCleanup = null;
  }

  function buildMenuItems(items){
    return items.map(item => {
      if(item.divider) return el("div", { class: "menu-divider" });
      if(item.section) return el("div", { class: "menu-label" }, [item.label]);
      const btn = el("button", {
        class: `menu-item${item.danger ? " danger" : ""}`,
        type: "button",
        disabled: !!item.disabled,
        onclick: () => { closeActive(); item.onClick?.(); },
      }, [
        item.icon ? HLM.utils.el("span", { html: HLM.icon(item.icon) }) : null,
        el("span", {}, [item.label]),
        item.shortcut ? el("span", { class: "menu-item-shortcut" }, [item.shortcut]) : null,
      ]);
      return btn;
    });
  }

  function positionAt(menu, x, y){
    menu.style.left = "0px";
    menu.style.top = "0px";
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    const clampedX = Math.min(x, window.innerWidth - rect.width - 8);
    const clampedY = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, clampedX)}px`;
    menu.style.top = `${Math.max(8, clampedY)}px`;
  }

  function openMenuAt(x, y, items){
    closeActive();
    const menu = el("div", { class: "menu", role: "menu" }, buildMenuItems(items));
    positionAt(menu, x, y);
    activeMenu = menu;

    function onDocClick(e){
      if(!menu.contains(e.target)) closeActive();
    }
    function onKeydown(e){
      const focusable = qsa(".menu-item:not(:disabled)", menu);
      const idx = focusable.indexOf(document.activeElement);
      if(e.key === "Escape"){ closeActive(); }
      else if(e.key === "ArrowDown"){ e.preventDefault(); (focusable[idx + 1] || focusable[0])?.focus(); }
      else if(e.key === "ArrowUp"){ e.preventDefault(); (focusable[idx - 1] || focusable[focusable.length - 1])?.focus(); }
    }
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKeydown, true);
    activeCleanup = () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKeydown, true);
    };

    qsa(".menu-item:not(:disabled)", menu)[0]?.focus();
    return { close: closeActive };
  }

  function openDropdown(triggerEl, items){
    const rect = triggerEl.getBoundingClientRect();
    return openMenuAt(rect.left, rect.bottom + 6, items);
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.openDropdown = openDropdown;
  HLM.ui.openMenuAt = openMenuAt;
  HLM.ui.closeActiveMenu = closeActive;
})(window.HLM = window.HLM || {});
