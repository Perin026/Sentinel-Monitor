/* =====================================================================
   MODAL — dialog system. openModal() is the primitive; confirmDialog()
   is a thin convenience wrapper for the common "are you sure?" case.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { el, trapFocus } = HLM.utils;

  let activeClose = null;

  function openModal(opts){
    const {
      title = "",
      subtitle = "",
      body = null,             // DOM node
      footer = null,            // DOM node (usually a row of buttons)
      width = 480,
      closable = true,
      onClose = null,
    } = opts;

    const previouslyFocused = document.activeElement;

    const closeBtn = closable
      ? el("button", { class: "icon-btn modal-close btn-icon-only", "aria-label": "Close", html: HLM.icon("close"), onclick: () => close() })
      : null;

    const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true", style: `--modal-width:${width}px` }, [
      el("div", { class: "modal-header" }, [
        el("div", {}, [
          el("div", { class: "modal-title" }, [title]),
          subtitle ? el("div", { class: "modal-subtitle" }, [subtitle]) : null,
        ]),
        closeBtn,
      ]),
      body ? el("div", { class: "modal-body" }, [body]) : null,
      footer ? el("div", { class: "modal-footer" }, [footer]) : null,
    ]);

    const backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    document.body.append(backdrop);
    document.body.style.overflow = "hidden";

    const releaseFocusTrap = trapFocus(backdrop);
    modal.setAttribute("tabindex", "-1");
    modal.focus();

    function onKeydown(e){
      if(e.key === "Escape" && closable) close();
    }
    function onBackdropClick(e){
      if(e.target === backdrop && closable) close();
    }
    document.addEventListener("keydown", onKeydown);
    backdrop.addEventListener("mousedown", onBackdropClick);

    function close(){
      backdrop.classList.add("is-closing");
      document.removeEventListener("keydown", onKeydown);
      releaseFocusTrap();
      setTimeout(() => {
        backdrop.remove();
        document.body.style.overflow = "";
        previouslyFocused?.focus?.();
      }, 180);
      activeClose = null;
      onClose?.();
    }

    activeClose = close;
    return { close, el: modal };
  }

  /**
   * @returns {Promise<boolean>} resolves true on confirm, false on cancel/dismiss
   */
  function confirmDialog({ title = "Are you sure?", message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false } = {}){
    return new Promise((resolve) => {
      let settled = false;
      const settle = (val) => { if(settled) return; settled = true; resolve(val); };

      const body = el("div", {}, [
        el("div", { class: `confirm-icon`, html: HLM.icon(danger ? "alert-triangle" : "info") }),
        el("p", {}, [message]),
      ]);

      const footer = el("div", {}, [
        el("button", { class: "btn btn-ghost", onclick: () => { settle(false); modal.close(); } }, [cancelLabel]),
        el("button", { class: `btn ${danger ? "btn-danger" : "btn-primary"}`, onclick: () => { settle(true); modal.close(); } }, [confirmLabel]),
      ]);
      footer.style.display = "flex";
      footer.style.gap = "12px";

      const modal = openModal({
        title, body, footer, width: 400,
        onClose: () => settle(false),
      });
      modal.el.classList.add("confirm");
      if(danger) modal.el.classList.add("danger");
    });
  }

  HLM.ui = HLM.ui || {};
  HLM.ui.openModal = openModal;
  HLM.ui.confirmDialog = confirmDialog;
})(window.HLM = window.HLM || {});
