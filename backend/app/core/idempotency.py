"""
Idempotency-Key support for mutating endpoints a flaky connection might retry —
per Global Conventions §1: accept, pickup, deliver all require an
`Idempotency-Key: <uuid>` header.

Backed by Redis when REDIS_URL is set. When Redis is not configured (e.g. Vercel
free tier), the cache layer is a no-op: every request executes normally and
`get_cached_response` always returns None. This is safe but loses replay protection.

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

from app.core.config import settings
from app.core.envelope import api_error

_redis = None


async def _get_redis():
    """Lazily connect to Redis. Returns None if REDIS_URL is not configured."""
    global _redis
    if not settings.redis_enabled:
        return None
    if _redis is None:
        from redis import asyncio as aioredis
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
    """Return cached response or None. No-ops gracefully when Redis is absent."""
    redis = await _get_redis()
    if redis is None:
        return None
    cached = await redis.get(f"idem:{scope}:{key}")
    return json.loads(cached) if cached else None


async def cache_response(scope: str, key: str, response: dict, ttl_seconds: int = 86400) -> None:
    """Cache a response in Redis. No-ops gracefully when Redis is absent."""
    redis = await _get_redis()
    if redis is None:
        return
    await redis.set(f"idem:{scope}:{key}", json.dumps(response, default=str), ex=ttl_seconds)
