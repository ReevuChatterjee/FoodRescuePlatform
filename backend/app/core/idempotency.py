"""
Idempotency-Key support for mutating endpoints a flaky connection might retry —
per Global Conventions §1: accept, pickup, deliver all require an
`Idempotency-Key: <uuid>` header.

Backed by Redis (already part of the stack): the first request with a given key
executes normally and caches its JSON response; a replay of the same key within
the TTL returns the cached response instead of re-running the mutation.

Usage in a router:

    from app.core.idempotency import require_idempotency_key, get_cached_response, cache_response

    @router.post("/deliveries/{id}/pickup")
    async def pickup(id: str, key: Annotated[str, Depends(require_idempotency_key)]):
        cached = await get_cached_response("deliveries.pickup", key)
        if cached is not None:
            return cached
        response = {...}
        await cache_response("deliveries.pickup", key, response)
        return response
"""
import json
from typing import Annotated

from fastapi import Header
from redis import asyncio as aioredis

from app.core.config import settings
from app.core.envelope import api_error

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def require_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str:
    if not idempotency_key:
        raise api_error(
            400,
            "MISSING_IDEMPOTENCY_KEY",
            "Idempotency-Key header is required for this operation.",
            "Idempotency-Key",
        )
    return idempotency_key


async def get_cached_response(scope: str, key: str) -> dict | None:
    redis = await _get_redis()
    cached = await redis.get(f"idem:{scope}:{key}")
    return json.loads(cached) if cached else None


async def cache_response(scope: str, key: str, response: dict, ttl_seconds: int = 86400) -> None:
    redis = await _get_redis()
    await redis.set(f"idem:{scope}:{key}", json.dumps(response, default=str), ex=ttl_seconds)
