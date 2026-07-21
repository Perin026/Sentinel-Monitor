"""
Generic registry — the backend equivalent of js/plugins/registry.js.

Every extension point (collectors, commands, notification providers, REST
routers, background tasks, health providers — see plugins/__init__.py) is
an instance of this one class, not a bespoke registry per kind. That's the
same call the frontend made and for the same reason: the shape of
"register/get/list/unregister with an owner for cleanup" doesn't change
between a Collector registry and a Command registry.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Generic, TypeVar

ValueT = TypeVar("ValueT")


class RegistryError(Exception):
    pass


class AlreadyRegisteredError(RegistryError):
    def __init__(self, registry_name: str, key: str, owner: str):
        super().__init__(f'[{registry_name}] "{key}" is already registered (owned by {owner}).')


class NotOwnerError(RegistryError):
    def __init__(self, registry_name: str, key: str, owner: str, requester: str):
        super().__init__(f'[{registry_name}] "{key}" is owned by {owner}, not {requester} — refusing to unregister.')


@dataclass(frozen=True)
class RegistryEntry(Generic[ValueT]):
    value: ValueT
    owner_id: str
    meta: dict = field(default_factory=dict)


class Registry(Generic[ValueT]):
    """@param name  human-readable name, used only in error messages."""

    def __init__(self, name: str):
        self.name = name
        self._entries: dict[str, RegistryEntry[ValueT]] = {}

    def register(self, key: str, value: ValueT, owner_id: str = "core", meta: dict | None = None) -> None:
        if key in self._entries:
            raise AlreadyRegisteredError(self.name, key, self._entries[key].owner_id)
        self._entries[key] = RegistryEntry(value=value, owner_id=owner_id, meta=meta or {})

    def unregister(self, key: str, owner_id: str | None = None) -> bool:
        entry = self._entries.get(key)
        if entry is None:
            return False
        if owner_id is not None and entry.owner_id != owner_id:
            raise NotOwnerError(self.name, key, entry.owner_id, owner_id)
        del self._entries[key]
        return True

    def unregister_all_by(self, owner_id: str) -> None:
        for key in [k for k, e in self._entries.items() if e.owner_id == owner_id]:
            self.unregister(key, owner_id)

    def get(self, key: str) -> ValueT | None:
        entry = self._entries.get(key)
        return entry.value if entry else None

    def has(self, key: str) -> bool:
        return key in self._entries

    def list(self) -> list[tuple[str, RegistryEntry[ValueT]]]:
        return list(self._entries.items())
