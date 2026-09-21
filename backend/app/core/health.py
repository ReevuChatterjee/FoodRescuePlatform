"""
Health check endpoints for Docker Compose healthcheck / k8s probes.

Per Section I:
  - GET /health — liveness (process is up)
  - GET /ready — readiness (DB + Redis reachable)
"""

from app.core.time import IST
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from redis import asyncio as aioredis

from app.core.database import engine
from app.core.config import settings

router = APIRouter(tags=["health"])


@router.api_route("/health", methods=["GET", "HEAD"])
async def health():
    """
    Liveness probe: returns 200 if the process is running.
    No external dependencies checked.
    """
    return {"status": "ok"}


@router.api_route("/ready", methods=["GET", "HEAD"])
async def readiness():
    """
    Readiness probe: returns 200 only if DB and Redis are reachable.
    Use this in Docker Compose healthcheck so dependent services wait.
    """
    checks = {}

    # Check database
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # Check Redis
    try:
        redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis.ping()
        await redis.close()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"

    # Fail if any check failed
    if any(v != "ok" for v in checks.values()):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})

    return {"status": "ready", "checks": checks}

@router.get("/debug")
async def debug_donation():
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models import Donation
    from app.core.envelope import iso_z
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
        donation = result.scalar_one_or_none()
        if not donation:
            return {"status": "no donations"}
        return {
            "id": donation.id,
            "status": donation.status.value if donation.status else None,
            "matched_ngo_id": donation.matched_ngo_id,
            "match_score": donation.match_score,
            "created_at": iso_z(donation.created_at) if donation.created_at else None,
        }

@router.get("/debug_match")
async def debug_match():
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models import Donation
    from app.services.matching_service import load_donation, load_active_ngos, load_routes, load_active_weights, get_excluded_ngo_ids
    from app.matching_engine import match
    import traceback
    from datetime import datetime, timezone
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
        donation = result.scalar_one_or_none()
        if not donation:
            return {"error": "no donation"}
        
        try:
            engine_donation = await load_donation(donation.id, db)
            ngos = await load_active_ngos(db)
            routes = load_routes(engine_donation, ngos)
            weights = await load_active_weights(engine_donation, db)
            excluded = await get_excluded_ngo_ids(donation.id, db)
            
            res = match(
                donation=engine_donation,
                ngos=ngos,
                routes=routes,
                weights=weights,
                reference_time=datetime.now(IST),
                excluded_ngo_ids=excluded
            )
            return {"matches": len(res.matches), "ngos_loaded": len(ngos)}
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc()}
