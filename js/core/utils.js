/* =====================================================================
   UTILS — small, dependency-free helpers shared across modules.
   ===================================================================== */
(function(HLM){
  "use strict";

  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rnd   = (min, max) => min + Math.random() * (max - min);
  const round = (v, dp=1) => Number(v.toFixed(dp));

  function debounce(fn, wait=150){
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function throttle(fn, wait=150){
    let last = 0, pending;
    return (...args) => {
      const now = Date.now();
      clearTimeout(pending);
      if(now - last >= wait){ last = now; fn(...args); }
      else pending = setTimeout(() => { last = Date.now(); fn(...args); }, wait - (now - last));
    };
  }

  function formatClock(date){
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function formatDate(date){
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function formatDuration(ms){
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;
    if(d > 0) return `${d}d ${h}h ${m}m`;
    if(h > 0) return `${h}h ${m}m ${s}s`;
    if(m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatBytes(bytes, dp=1){
    if(bytes === 0) return "0 B";
    const units = ["B","KB","MB","GB","TB","PB"];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
    return `${round(bytes / Math.pow(1024, i), dp)} ${units[i]}`;
  }

  /**
   * Minimal, dependency-free element builder.
   * el("button", { class:"btn", onclick: fn }, ["Save"])
   */
  function el(tag, attrs={}, children=[]){
    const node = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs)){
      if(v == null || v === false) continue;
      if(k === "class") node.className = v;
      else if(k === "dataset") Object.assign(node.dataset, v);
      else if(k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if(k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    [].concat(children).forEach(c => {
      if(c == null) return;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  /** Generates a short, non-cryptographic id — enough to key DOM nodes / list items. */
  let idCounter = 0;
  function uid(prefix="id"){
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
  }

  /** Traps Tab focus within a container. Returns a release function. */
  function trapFocus(container){
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    function handleKeydown(e){
      if(e.key !== "Tab") return;
      const focusable = qsa(FOCUSABLE, container).filter(n => n.offsetParent !== null);
      if(!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    container.addEventListener("keydown", handleKeydown);
    return () => container.removeEventListener("keydown", handleKeydown);
  }

  HLM.utils = { qs, qsa, clamp, rnd, round, debounce, throttle, formatClock, formatDate, formatDuration, formatBytes, el, uid, trapFocus };
})(window.HLM = window.HLM || {});
