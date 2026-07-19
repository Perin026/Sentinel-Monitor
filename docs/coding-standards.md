# Coding Standards

## JavaScript

- **No build step, no bundler, no framework.** Plain ES2017+ JavaScript,
  loaded via classic `<script>` tags.
- **Module pattern:** every file is `(function(HLM){ "use strict"; ... })(window.HLM = window.HLM || {});`.
  Nothing is a bare global except `HLM` itself.
- **One global namespace.** Public API surfaces attach to `HLM`:
  `HLM.utils`, `HLM.store`, `HLM.registries`, `HLM.ui.*`, etc. Don't
  introduce a second top-level global.
- **Small functions, descriptive names.** If a function needs a comment to
  explain *what* it does, it's usually a sign it should be split or
  renamed. Comments should explain *why*, not *what*.
- **Prefer composition over inheritance.** The one place the codebase uses
  `class`/`extends` is the `DataProvider` hierarchy, because "swap the
  implementation, keep the interface" is exactly what that models.
  Elsewhere, prefer plain functions and factories (see `createWidget()`,
  `createRegistry()`).
- **Immutable-by-convention state updates.** `HLM.store.set()` always
  merges a fresh object; don't mutate `HLM.store.get()`'s return value
  directly.
- **Error isolation at trust boundaries.** Anywhere core code calls into
  something that isn't core (a plugin hook, a store listener, a
  background task), wrap the call in `try/catch` and degrade gracefully.
  This is not optional — see `plugin-manager.js`'s `runIsolated()` and
  `store.js`'s listener loop for the pattern.

## Naming

- Files: `kebab-case.js`
- Functions/variables: `camelCase`
- "Classes" (factories or actual `class`): `PascalCase` for the
  constructor/factory name, `camelCase` for the instance
- Registry/plugin ids: `kebab-case`, prefixed by owner for anything
  plugin-registered (`"docker.restartContainer"`)
- CSS classes: `kebab-case`, component-scoped (`.device-card-summary`, not
  `.summary`)

## CSS

- **Design tokens only.** Every color, spacing value, font size, radius,
  shadow, and duration comes from `css/tokens.css`'s CSS custom
  properties. No hardcoded hex codes or magic pixel values in component
  files.
- **One file per component**, named to match its JS counterpart where one
  exists (`gauge.css` ↔ `gauge.js`).
- **Dark-mode-first.** There is currently one theme; when a second is
  added, it must work by swapping token values, not by component-level
  overrides.

## Documentation

- Every file starts with a header comment explaining its **responsibility**
  and, where non-obvious, **why** it's structured the way it is — not a
  changelog of what's in the file.
- Public functions get a JSDoc-style comment when their contract isn't
  obvious from the name and signature alone. Not every function needs one.
- Architectural decisions that aren't obvious from the code go in
  `docs/architecture.md`, not scattered as inline comments.

## Testing

See [`docs/developer-guide.md`](developer-guide.md#testing). A committed
test suite is planned; until then, changes to `js/` should be verified
with an equivalent ad hoc smoke test before opening a PR.

## Git

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for commit conventions and
branch strategy.
