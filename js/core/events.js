/* =====================================================================
   EVENTS — a minimal pub/sub bus.
   Store (state.js) answers "what is true right now". Events answer
   "something just happened". Keeping them separate means a toast can
   be fired from anywhere without every module depending on a shared
   mutable toast array.
   ===================================================================== */
(function(HLM){
  "use strict";

  function createEventBus(){
    const listeners = new Map();

    function on(event, handler){
      if(!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => off(event, handler);
    }

    function once(event, handler){
      const unsub = on(event, (...args) => { unsub(); handler(...args); });
      return unsub;
    }

    function off(event, handler){
      listeners.get(event)?.delete(handler);
    }

    function emit(event, payload){
      listeners.get(event)?.forEach(fn => fn(payload));
    }

    return { on, once, off, emit };
  }

  HLM.events = createEventBus();
})(window.HLM = window.HLM || {});
