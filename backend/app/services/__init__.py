"""
Services — the layer routes depend on instead of touching config, the
database, plugins, or infrastructure singletons directly. Mirrors why the
frontend's plugins receive `ctx.services.*` instead of reaching into
`HLM.store`/`HLM.ui`: it's the indirection that lets an internal
implementation change later without every call site breaking.

Phase 5.1 establishes the architecture for every service listed below.
Business logic (real history storage, real notification delivery, real
authentication) is explicitly out of scope — see each service's docstring
for what it does today versus what it's a seam for.
"""
