"""
Health check endpoints for Docker Compose healthcheck / k8s probes / Vercel.

Per Section I:
  - GET /health — liveness (process is up)
  - GET /ready — readiness (DB reachable; Redis checked only when REDIS_URL is set)
"""

from app.core.time import IST
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

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
    Readiness probe: returns 200 only if DB (and Redis, when configured) are reachable.
    """
    checks = {}

    # Check database
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # Check Redis — only when REDIS_URL is configured
    if settings.redis_enabled:
        try:
            from redis import asyncio as aioredis
            redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await redis.ping()
            await redis.close()
            checks["redis"] = "ok"
        except Exception as e:
            checks["redis"] = f"error: {str(e)}"
    else:
        checks["redis"] = "disabled (no REDIS_URL)"

    # Fail if any critical check failed
    critical_failed = any(
        v.startswith("error:") for k, v in checks.items() if isinstance(v, str)
    )
    if critical_failed:
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
async def debug_match(approve_all: bool = False, match_latest: bool = False):
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models import Donation, NGO, NGOVerificationStatus, NGOFoodCategory, DonationStatus
    from app.services.matching_service import load_donation, load_active_ngos, load_routes, load_active_weights, get_excluded_ngo_ids
    from app.matching_engine import match
    from app.core.envelope import iso_z
    import traceback
    
    async with AsyncSessionLocal() as db:
        if approve_all:
            ngo_res = await db.execute(select(NGO))
            for n in ngo_res.scalars().all():
                n.verification_status = NGOVerificationStatus.APPROVED
            await db.commit()

        # Query latest donation
        result = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
        donation = result.scalar_one_or_none()
        
        # Query all NGOs in DB
        ngos_in_db = await db.execute(select(NGO))
        ngo_rows = ngos_in_db.scalars().all()
        all_ngos_summary = []
        for n in ngo_rows:
            cats = await db.execute(select(NGOFoodCategory.food_category).where(NGOFoodCategory.ngo_id == n.id))
            all_ngos_summary.append({
                "id": n.id,
                "org_name": n.organisation_name,
                "status": n.verification_status.value if n.verification_status else None,
                "location": n.location,
                "available_capacity_kg": n.available_capacity_kg,
                "operating_hours": f"{n.operating_start}-{n.operating_end}",
                "accepted_categories": [c for c in cats.scalars().all()],
            })

        if not donation:
            return {
                "error": "no donation in database",
                "all_ngos_in_db": all_ngos_summary,
            }
        
        try:
            engine_donation = await load_donation(donation.id, db)
            ngos = await load_active_ngos(db)
            routes = load_routes(engine_donation, ngos)
            weights = await load_active_weights(engine_donation, db)
            excluded = await get_excluded_ngo_ids(donation.id, db)
            
            ref_time = max(datetime.now(IST), engine_donation.available_from)
            res = match(
                donation=engine_donation,
                ngos=ngos,
                routes=routes,
                weights=weights,
                reference_time=ref_time,
                excluded_ngo_ids=excluded if excluded else None,
            )

            if match_latest and res.matches:
                best = res.matches[0]
                donation.status = DonationStatus.MATCHED
                donation.matched_ngo_id = best.ngo_id
                donation.match_score = best.score
                donation.match_breakdown = {
                    "capacity_score": best.capacity_score,
                    "shelf_life_score": best.shelf_life_score,
                    "transit_score": best.transit_score,
                    "demand_score": best.demand_score,
                    "route_score": best.route_score,
                    "eta_minutes": best.eta_minutes,
                }
                donation.weights_version_id = res.weights_version_id
                donation.updated_at = ist_now()
                await db.commit()

            return {
                "latest_donation": {
                    "id": donation.id,
                    "status": donation.status.value if donation.status else None,
                    "food_name": donation.food_name,
                    "food_category": donation.food_category,
                    "quantity_kg": donation.quantity_kg,
                    "available_from": iso_z(donation.available_from),
                    "expiry_time": iso_z(donation.expiry_time),
                    "pickup_location": donation.pickup_location,
                    "matched_ngo_id": donation.matched_ngo_id,
                },
                "all_ngos_in_db": all_ngos_summary,
                "candidates_loaded_count": len(ngos),
                "rejections": {k: v.value for k, v in res.rejections.items()},
                "matches": [
                    {
                        "ngo_id": m.ngo_id,
                        "score": m.score,
                        "eta_minutes": m.eta_minutes,
                    }
                    for m in res.matches
                ],
            }
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc(), "all_ngos_in_db": all_ngos_summary}
