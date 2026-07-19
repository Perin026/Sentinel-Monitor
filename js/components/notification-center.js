/* =====================================================================
   NOTIFICATION CENTER — panel opened from the header bell.
   Reads/writes HLM.store's `notifications` slice so the header badge
   and the panel list always agree, no matter what added a notification.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, formatDuration } = HLM.utils;

  let panelEl = null;
  let cleanupListeners = null;

  function close(){
    panelEl?.remove();
    panelEl = null;
    cleanupListeners?.();
    cleanupListeners = null;
  }

  function timeAgo(timestamp){
    return `${formatDuration(Date.now() - timestamp)} ago`;
  }

  function renderList(notifications){
    if(!notifications.length){
      return el("div", { class: "empty-state compact" }, [
        el("h3", {}, ["You're all caught up"]),
        el("p", {}, ["Alerts and events will show up here as they happen."]),
      ]);
    }
    return el("div", { class: "notification-list" }, notifications.map(n =>
      el("div", { class: `notification-item ${n.level || "ok"}${n.read ? "" : " is-unread"}` }, [
        el("div", { class: "notification-icon", html: HLM.icon(n.level === "critical" ? "alert-circle" : n.level === "warn" ? "alert-triangle" : "check") }),
        el("div", { class: "notification-content" }, [
          el("div", { class: "notification-title" }, [n.title]),
          n.message ? el("div", { class: "notification-message" }, [n.message]) : null,
          el("div", { class: "notification-time" }, [timeAgo(n.timestamp)]),
        ]),
      ])
    ));
  }

  function toggleNotificationPanel(triggerEl){
    if(panelEl){ close(); return; }

    const state = HLM.store.get();
    const rect = triggerEl.getBoundingClientRect();

    const markAllBtn = el("button", { class: "notification-panel-action", onclick: () => {
      HLM.store.set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) }));
      close();
    }}, ["Mark all read"]);

    panelEl = el("div", {
      class: "notification-panel",
      style: `right:${Math.max(8, window.innerWidth - rect.right)}px; top:${rect.bottom + 8}px;`,
      role: "dialog",
      "aria-label": "Notifications",
    }, [
      el("div", { class: "notification-panel-header" }, [
        el("div", { class: "notification-panel-title" }, ["Notifications"]),
        state.notifications.length ? markAllBtn : null,
      ]),
      renderList(state.notifications),
    ]);

    document.body.append(panelEl);

    function onDocClick(e){
      if(panelEl && !panelEl.contains(e.target) && e.target !== triggerEl) close();
    }
    function onKeydown(e){ if(e.key === "Escape") close(); }
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKeydown, true);
    cleanupListeners = () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKeydown, true);
    };
  }

  function unreadCount(){
    return HLM.store.get().notifications.filter(n => !n.read).length;
  }

  function pushNotification({ title, message = "", level = "ok" }){
    HLM.store.set(s => ({
      notifications: [{ id: HLM.utils.uid("notif"), title, message, level, read: false, timestamp: Date.now() }, ...s.notifications].slice(0, 50),
    }));
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.toggleNotificationPanel = toggleNotificationPanel;
  HLM.ui.pushNotification = pushNotification;
  HLM.ui.unreadNotificationCount = unreadCount;
})(window.HLM = window.HLM || {});
