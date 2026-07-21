"""
Generic repository pattern.

One generic `BaseRepository[ModelType]`, not a bespoke repository class per
model — deliberately mirroring the frontend's `HLM.createRegistry()`
(js/plugins/registry.js), which made the same call for extension points:
the shape of "get one, list, create, update, delete" doesn't change between
a Device repository and a Plugin repository, so there's exactly one
implementation of it. A model-specific repository subclasses this only
when it needs a query `BaseRepository` doesn't cover — not to re-implement
CRUD.
"""
from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, session: AsyncSession, model: type[ModelType]):
        self.session = session
        self.model = model

    async def get(self, id_: Any) -> ModelType | None:
        return await self.session.get(self.model, id_)

    async def list(self, *, offset: int = 0, limit: int = 50) -> list[ModelType]:
        result = await self.session.execute(select(self.model).offset(offset).limit(limit))
        return list(result.scalars().all())

    async def create(self, **fields: Any) -> ModelType:
        instance = self.model(**fields)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, instance: ModelType, **fields: Any) -> ModelType:
        for key, value in fields.items():
            setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def delete(self, instance: ModelType) -> None:
        await self.session.delete(instance)
        await self.session.flush()
