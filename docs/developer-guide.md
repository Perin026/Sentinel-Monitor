# Developer Guide

## Running the App Locally

No build step. Two options:

```bash
# Option 1: just open it
open index.html          # macOS
xdg-open index.html      # Linux

# Option 2: serve it (recommended — some browsers restrict file:// APIs)
python3 -m http.server 8080
# visit http://localhost:8080
```

The app boots automatically: plugins register, the simulation engine
starts, and the fleet begins ticking every 2.5 seconds
(`HLM.config.APP.refreshMs`).

## Project Layout

See the [Project Structure](../README.md#project-structure) section of the
README for the top-level layout, and
[`docs/system-overview.md`](system-overview.md) for a subsystem-by-subsystem
tour.

## Debugging

Everything is on `window.HLM`. Useful things to poke at from the browser
console:

```javascript
HLM.store.get()                      // full current state
HLM.pluginManager.list()             // every plugin's status
HLM.registries.deviceTypes.list()    // every registered device type
HLM.config.DEVICES                   // the fleet seed list
HLM.engine.refresh()                 // force an out-of-cycle tick
HLM.engine.setMaintenance("pve-01", true)  // put a device in maintenance mode
```

Slow down or speed up the simulation for testing by changing the refresh
interval before the engine starts (or restarting it):

```javascript
HLM.config.APP.refreshMs = 250;
```

## Testing

There is no committed test suite yet — Sentinel Monitor has been verified
at each phase using an ad hoc offline smoke test built with
[`jsdom`](https://github.com/jsdom/jsdom), run and then discarded rather
than checked in. If you're working on `js/`, a similar approach is
recommended before opening a PR:

```bash
npm install jsdom --no-save
node -e '
  const fs = require("fs"), path = require("path");
  const { JSDOM } = require("jsdom");
  const raw = fs.readFileSync("index.html", "utf8");
  const order = [...raw.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const html = raw.replace(/<script src="[^"]+"><\/script>\s*/g, "");
  const dom = new JSDOM(html, { url: "http://localhost/index.html", runScripts: "dangerously", pretendToBeVisual: true });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const errors = [];
  dom.window.addEventListener("error", e => errors.push(e.error?.stack || e.message));
  for (const src of order) {
    const s = dom.window.document.createElement("script");
    s.textContent = fs.readFileSync(src, "utf8");
    dom.window.document.body.append(s);
  }
  setTimeout(() => {
    console.log("devices:", Object.keys(dom.window.HLM.store.get().devices).length);
    console.log("plugins enabled:", dom.window.HLM.pluginManager.list().filter(p => p.status === "enabled").length);
    console.log(errors.length ? errors : "No runtime errors.");
    process.exit(errors.length ? 1 : 0);
  }, 400);
'
```

This catches the class of bug that matters most for a script-tag-based app:
load-order mistakes and runtime errors that only surface once the DOM
exists. A committed, proper test suite is tracked for a future phase.

## Formalizing CI

`.github/workflows/` contains a placeholder workflow. There is no CI
running yet — see that file for what's expected to be wired up (syntax
checking every JS file, then running the smoke test above) once the
project is ready to enforce it on every PR.

## Making Sense of Load Order

Because there's no bundler, `index.html`'s `<script>` order **is** the
dependency graph. The order is, in general:

1. `js/core/*` — utilities, config, store, events (no dependencies)
2. `js/plugins/registry.js`, `registries.js`, `services.js`,
   `plugin-manager.js`, `sdk.js`, `scheduler.js` — the plugin architecture
   itself (depends on core)
3. `js/components/*` — the UI component library (depends on core; plugins
   reference these lazily, so exact ordering relative to plugins doesn't
   matter here)
4. `js/plugins/builtin/*`, `js/plugins/examples/*` — plugins that
   self-register on load (depends on the SDK + Plugin Manager)
5. `js/engine/*` — the monitoring engine (depends on plugins being
   registered, since it resolves device types/providers through the
   registries at runtime)
6. `js/app.js` — bootstraps everything, last

If you add a new core file that a plugin or the engine reads from **at its
own top-level execution time** (not deferred inside a function), it needs
to load before anything that depends on it. Most of the codebase avoids
this by deferring registry lookups until a function actually runs, which
is the preferred pattern — see `device-model.js` for an example.
