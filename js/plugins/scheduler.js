/* =====================================================================
   SCHEDULER — runs plugin-registered background tasks on their own
   interval, each isolated so a failing task doesn't affect the others
   or the engine tick loop.
   task shape: { run(), intervalMs }
   ===================================================================== */
(function(HLM){
  "use strict";

  const timers = new Map(); // taskId -> intervalHandle

  function startAll(){
    HLM.registries.backgroundTasks.list().forEach(({ id, value: task }) => {
      if(timers.has(id)) return;
      const handle = setInterval(() => {
        try{ task.run(); }
        catch(err){ console.error(`[scheduler] background task "${id}" threw:`, err); }
      }, task.intervalMs || 60000);
      timers.set(id, handle);
    });
  }

  function stop(id){
    clearInterval(timers.get(id));
    timers.delete(id);
  }

  function stopAll(){
    timers.forEach(handle => clearInterval(handle));
    timers.clear();
  }

  HLM.scheduler = { startAll, stop, stopAll };
})(window.HLM = window.HLM || {});
