/* =====================================================================
   CLOCK — header wall clock + dashboard session uptime.
   ===================================================================== */
(function(HLM){
  "use strict";
  const { qs, formatClock, formatDate, formatDuration } = HLM.utils;

  function tick(){
    const now = new Date();
    const clockEl = qs("#headerClock");
    const dateEl  = qs("#headerDate");
    const uptimeEl = qs("#headerUptime");

    if(clockEl) clockEl.textContent = formatClock(now);
    if(dateEl)  dateEl.textContent = formatDate(now);
    if(uptimeEl) uptimeEl.textContent = formatDuration(Date.now() - HLM.store.get().bootTime);
  }

  function initClock(){
    tick();
    setInterval(tick, 1000);
  }

  HLM.clock = { initClock };
})(window.HLM = window.HLM || {});
