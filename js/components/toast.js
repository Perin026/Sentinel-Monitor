/* =====================================================================
   TOAST — transient notification stack.
   Call HLM.ui.toast({ title, message, level }) from anywhere, or emit
   the "toast:show" event with the same payload — useful for modules
   that shouldn't take a direct dependency on this file.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, uid } = HLM.utils;

  const LEVEL_ICON = { ok: "check", warn: "alert-triangle", critical: "alert-circle", info: "info" };
  const DEFAULT_DURATION = 4500;

  let stack = null;
  function ensureStack(){
    if(stack) return stack;
    stack = el("div", { class: "toast-stack", role: "region", "aria-label": "Notifications" });
    document.body.append(stack);
    return stack;
  }

  function toast({ title, message = "", level = "info", duration = DEFAULT_DURATION } = {}){
    const container = ensureStack();
    const id = uid("toast");

    function dismiss(){
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 200);
    }

    const node = el("div", {
      class: `toast ${level}`,
      dataset: { toastId: id },
      role: "status",
    }, [
      el("div", { class: "toast-icon", html: HLM.icon(LEVEL_ICON[level] || "info") }),
      el("div", { class: "toast-content" }, [
        el("div", { class: "toast-title" }, [title]),
        message ? el("div", { class: "toast-message" }, [message]) : null,
      ]),
      el("button", { class: "icon-btn toast-close btn-icon-only", "aria-label": "Dismiss", html: HLM.icon("close"), onclick: dismiss }),
      duration ? el("div", { class: "toast-progress", style: `--toast-duration:${duration}ms` }) : null,
    ]);

    container.append(node);
    if(duration) setTimeout(dismiss, duration);

    return { id, dismiss };
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.toast = toast;
  HLM.events.on("toast:show", (payload) => toast(payload));
})(window.HLM = window.HLM || {});
