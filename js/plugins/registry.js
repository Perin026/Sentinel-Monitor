/* =====================================================================
   REGISTRY — generic "named things, contributed by plugins" store.
   Every extension point in the app (device types, widgets, pages,
   commands, data providers, ...) is one of these, not a bespoke class.
   That's deliberate: the shape of "register/get/list/unregister with
   an owner for cleanup" doesn't change between a device-type registry
   and a command registry, so there's exactly one implementation of it.
   ===================================================================== */
(function(HLM){
  "use strict";

  /**
   * @param {string} name  human-readable name, used in error messages
   */
  function createRegistry(name){
    const entries = new Map(); // id -> { value, ownerId, meta }

    function register(id, value, ownerId = "core", meta = {}){
      if(entries.has(id)){
        throw new Error(`[${name}] "${id}" is already registered (owned by ${entries.get(id).ownerId}).`);
      }
      entries.set(id, { value, ownerId, meta });
      HLM.events.emit(`registry:${name}:register`, { id, ownerId });
      return () => unregister(id, ownerId);
    }

    function unregister(id, ownerId){
      const entry = entries.get(id);
      if(!entry) return false;
      if(ownerId && entry.ownerId !== ownerId){
        throw new Error(`[${name}] "${id}" is owned by ${entry.ownerId}, not ${ownerId} — refusing to unregister.`);
      }
      entries.delete(id);
      HLM.events.emit(`registry:${name}:unregister`, { id, ownerId: entry.ownerId });
      return true;
    }

    /** Removes every entry owned by a given plugin — used on plugin unload. */
    function unregisterAllBy(ownerId){
      [...entries.entries()].filter(([, e]) => e.ownerId === ownerId).forEach(([id]) => unregister(id, ownerId));
    }

    function get(id){
      return entries.get(id)?.value;
    }

    function getMeta(id){
      return entries.get(id)?.meta;
    }

    function has(id){
      return entries.has(id);
    }

    function list(){
      return [...entries.entries()].map(([id, e]) => ({ id, value: e.value, ownerId: e.ownerId, meta: e.meta }));
    }

    return { register, unregister, unregisterAllBy, get, getMeta, has, list };
  }

  HLM.createRegistry = createRegistry;
})(window.HLM = window.HLM || {});
