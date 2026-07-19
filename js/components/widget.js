/* =====================================================================
   WIDGET — reusable dashboard tile.
   Owns: header chrome (icon/title/subtitle/status/actions), collapse,
   loading/error/empty states, and a refresh affordance.
   Does NOT own: what the content actually is. Callers pass a render
   function and are responsible for their own data; this keeps the
   framework usable for a gauge today and a chart in Phase 4 without
   changes here.

   Usage:
     const widget = HLM.ui.createWidget({
       title: "CPU Load",
       subtitle: "pve-01",
       icon: "cpu",
       status: "ok",
       collapsible: true,
       onRefresh: () => widget.setLoading(true),
       actions: [{ label: "Open device", icon: "external-link", onClick: () => {} }],
     });
     container.append(widget.el);
     widget.setContent(someNode);
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, uid } = HLM.utils;
  const { icon } = HLM;

  function createWidget(opts){
    const {
      id = uid("widget"),
      icon: iconName = "grid",
      title = "Untitled widget",
      subtitle = "",
      status = null,           // "ok" | "warn" | "critical" | "offline" | null
      collapsible = true,
      startCollapsed = false,
      onRefresh = null,
      actions = [],             // [{ label, icon, onClick, danger }]
    } = opts;

    const bodyInner = el("div", { class: "widget-body-inner" });
    const body = el("div", { class: "widget-body" }, [bodyInner]);

    const statusBadge = status
      ? el("span", { class: `status-badge ${status}`, text: status })
      : null;

    const refreshBtn = onRefresh
      ? el("button", {
          class: "icon-btn widget-refresh",
          type: "button",
          "aria-label": "Refresh",
          "data-tooltip": "Refresh",
          html: icon("refresh"),
          onclick: () => onRefresh(),
        })
      : null;

    const collapseBtn = collapsible
      ? el("button", {
          class: "icon-btn widget-collapse-btn",
          type: "button",
          "aria-label": "Collapse widget",
          "data-tooltip": "Collapse",
          html: icon("chevron-down"),
          onclick: () => toggleCollapse(),
        })
      : null;

    let menuTrigger = null;
    if(actions.length){
      menuTrigger = el("button", {
        class: "icon-btn widget-menu-trigger",
        type: "button",
        "aria-label": "Widget actions",
        "data-tooltip": "More",
        html: icon("more-horizontal"),
        onclick: (e) => {
          e.stopPropagation();
          HLM.ui.openDropdown(menuTrigger, actions);
        },
      });
    }

    const header = el("div", { class: "widget-header" }, [
      el("span", { class: "widget-drag-handle", html: icon("drag-handle") }),
      el("div", { class: "widget-heading" }, [
        el("span", { class: "widget-icon", html: icon(iconName) }),
        el("div", { class: "widget-titles" }, [
          el("div", { class: "widget-title" }, [title]),
          subtitle ? el("div", { class: "widget-subtitle" }, [subtitle]) : null,
        ]),
      ]),
      statusBadge,
      el("div", { class: "widget-actions" }, [refreshBtn, collapseBtn, menuTrigger]),
    ]);

    const root = el("div", {
      class: "widget",
      dataset: { widgetId: id },
    }, [header, body]);

    if(startCollapsed) root.classList.add("is-collapsed");

    function toggleCollapse(){
      root.classList.toggle("is-collapsed");
      HLM.events.emit("widget:collapse", { id, collapsed: root.classList.contains("is-collapsed") });
    }
    function collapse(){ root.classList.add("is-collapsed"); }
    function expand(){ root.classList.remove("is-collapsed"); }

    function setContent(node){
      bodyInner.innerHTML = "";
      if(node) bodyInner.append(node);
    }

    function setLoading(isLoading, skeletonRows=2){
      if(!isLoading) return;
      const rows = Array.from({ length: skeletonRows }).map((_, i) =>
        el("div", { class: "skeleton skeleton-text", style: `width:${i === 0 ? "50%" : "80%"}; margin-bottom:8px;` })
      );
      setContent(el("div", {}, [...rows, el("div", { class: "skeleton skeleton-block" })]));
    }

    function setEmpty(message="No data yet"){
      setContent(el("div", { class: "empty-state compact" }, [
        el("h3", {}, [message]),
      ]));
    }

    function setError(message="Something went wrong"){
      setContent(el("div", { class: "error-state" }, [
        el("div", { html: icon("alert-triangle", "error-icon") }),
        el("h3", {}, ["Widget failed to load"]),
        el("p", {}, [message]),
        onRefresh ? el("button", { class: "btn btn-ghost btn-sm", onclick: onRefresh }, ["Retry"]) : null,
      ]));
    }

    function setStatus(nextStatus){
      if(!statusBadge) return;
      statusBadge.className = `status-badge ${nextStatus}`;
      statusBadge.textContent = nextStatus;
    }

    function destroy(){
      root.remove();
    }

    return { id, el: root, setContent, setLoading, setEmpty, setError, setStatus, collapse, expand, toggleCollapse, destroy };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.createWidget = createWidget;
})(window.HLM = window.HLM || {});
