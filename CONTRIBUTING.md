# Contributing to Sentinel Monitor

Thanks for considering a contribution. This document covers how the project
is developed day to day. Please read it before opening a PR — most review
feedback traces back to one of the points below.

## Architecture Principles (read this first)

1. **Plugins instead of core changes, whenever possible.** If you're adding
   support for a new service (a new device type, a new integration), it
   almost certainly belongs in `js/plugins/examples/` or a new
   `js/plugins/` file, registered through `HLM.createPlugin()`. Core files
   (`js/core/`, `js/engine/`) should have no knowledge of specific services.
   If you find yourself adding an `if (type === "my-service")` branch to a
   core file, stop — that's a sign that Device Registry, Widget Registry, or
   Health Calculator Registry should be handling it instead.
2. **Strong separation of concerns.** UI components never fetch data. The
   monitoring engine never touches the DOM. Plugins never reach into
   `HLM.store` directly — they go through `ctx.services`.
3. **Single responsibility per file.** If a file is doing two unrelated
   things, split it.
4. **Backwards compatibility where practical.** Pre-1.0, breaking changes
   are allowed between minor versions per SemVer, but avoid them if a
   non-breaking path exists.

See [`docs/architecture.md`](docs/architecture.md) for the full reasoning
behind the layering.

## Development Workflow

1. Fork the repository and clone your fork.
2. Create a branch off `develop` (see [Branch Strategy](#branch-strategy)).
3. Make your change. There is no build step — open `index.html` directly to
   test in a browser.
4. If you touched `js/`, run the project's smoke test (see
   [`docs/developer-guide.md`](docs/developer-guide.md)) before opening a PR.
5. Open a PR against `develop`, not `main`.

## Branch Strategy

- `main` — always deployable, tagged releases only
- `develop` — integration branch for the next release
- `feature/<short-description>` — new functionality, branched from `develop`
- `fix/<short-description>` — bug fixes, branched from `develop`
- `plugin/<plugin-name>` — new or updated plugins

## Commit Conventions

Sentinel Monitor uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional detailed body>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.
Scope is usually a top-level directory or subsystem: `core`, `engine`,
`plugins`, `ui`, `docs`.

Example:

```
feat(plugins): add Docker container list widget

Registers a lazy-loaded widget kind for the Docker plugin that renders
per-container status. No live Docker API integration yet — static demo
content only, per the plugin's current scope.
```

## Coding Standards

Full detail in [`docs/coding-standards.md`](docs/coding-standards.md).
The short version:

- Vanilla JS, no build step, no framework. Every file is a self-invoking
  function attaching to the `HLM` namespace.
- Small functions, descriptive names, minimal comments (comment *why*, not
  *what* — the code should explain what).
- CSS uses design tokens (`css/tokens.css`) exclusively — no hardcoded
  colors, spacing, or font sizes in component files.
- New UI components go in `css/components/` + `js/components/`, one file
  per component, matching names.

## Plugin Guidelines

- A plugin manifest requires `id`, `name`, `version`, and `setup(ctx)` at
  minimum. Include `author`, `license`, `description`, and
  `minCoreVersion` for anything intended to be shared.
- Never register an id that could collide with another plugin — prefix
  widget/command/settings ids with your plugin's id
  (e.g. `"docker.restartContainer"`, not `"restartContainer"`).
- Use `ctx.services` for anything that touches shared state or the UI.
  Don't reach for `HLM.store` or `HLM.ui` directly from a plugin.
- Demonstration/example plugins should stay minimal — device type, one
  widget, one command, an icon, and a settings-panel stub is enough to
  prove the surface works. Full integrations belong in Phase 6.
- See [`docs/plugin-development.md`](docs/plugin-development.md) for a
  complete walkthrough.

## Code Review Expectations

- PRs should be scoped to one logical change. Large, mixed-purpose PRs will
  be asked to split.
- If a PR modifies a core file (`js/core/`, `js/engine/`) to accommodate a
  specific service, expect a request to move that logic into a plugin
  instead, unless there's a clear architectural reason it can't be.
- Documentation updates (README/CHANGELOG/architecture/roadmap) are
  expected alongside any change that affects them — see the
  [Future Development Policy](docs/roadmap.md#future-development-policy).

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](./LICENSE).
