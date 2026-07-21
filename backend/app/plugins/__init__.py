"""
Plugin bootstrap — the backend mirror of the frontend's plugin system
(js/plugins/). Same shape, same reasoning: one generic registry per
extension point, a single Plugin Manager as the only load path, and the
core knowing nothing about what any specific plugin does.

Phase 5.1 builds only the loading framework (registry, manifest, manager).
No real plugins (collectors, notification providers, ...) exist yet —
those are later-phase business logic, not architecture.
"""
