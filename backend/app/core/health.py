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


@router.get("/debug_dispatch")
async def debug_dispatch(auto_assign: bool = False, driver_email: str | None = None):
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models import Donation, Vehicle, Delivery, User, NGO, DonationStatus, UserRole
    from app.dispatch.service import dispatch_donation
    from app.core.envelope import iso_z
    import traceback

    async with AsyncSessionLocal() as db:
        try:
            # Query all driver users & vehicles
            u_res = await db.execute(select(User).where(User.role == UserRole.DRIVER))
            all_drivers = list(u_res.scalars().all())

            # Ensure every driver has a Vehicle row
            for u in all_drivers:
                v_check = await db.execute(select(Vehicle).where(Vehicle.driver_id == u.id))
                if not v_check.scalar_one_or_none():
                    db.add(Vehicle(
                        id=f"veh_{u.id[-8:]}",
                        driver_id=u.id,
                        capacity_kg=100.0,
                        current_location="28.6273,77.2190",
                        availability_status="AVAILABLE",
                    ))
            await db.commit()

            veh_res = await db.execute(select(Vehicle))
            vehicles = list(veh_res.scalars().all())
            drivers_info = []
            for v in vehicles:
                u_res = await db.execute(select(User).where(User.id == v.driver_id))
                u = u_res.scalar_one_or_none()
                drivers_info.append({
                    "driver_id": v.driver_id,
                    "driver_name": u.name if u else None,
                    "driver_email": u.email if u else None,
                    "vehicle_id": v.id,
                    "capacity_kg": v.capacity_kg,
                    "current_location": v.current_location,
                    "availability_status": v.availability_status,
                })

            # Query recent deliveries
            deliv_res = await db.execute(select(Delivery).order_by(Delivery.id.desc()).limit(10))
            deliveries = [
                {
                    "id": d.id,
                    "donation_id": d.donation_id,
                    "driver_id": d.driver_id,
                    "ngo_id": d.ngo_id,
                    "status": d.status.value,
                    "pickup_time": iso_z(d.pickup_time) if d.pickup_time else None,
                }
                for d in deliv_res.scalars().all()
            ]

            # Query latest donation
            don_res = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
            donation = don_res.scalar_one_or_none()

            dispatch_result = None
            if auto_assign and donation:
                # Ensure donation has a matched NGO
                if not donation.matched_ngo_id:
                    ngo_res = await db.execute(select(NGO).order_by(NGO.created_at.desc()))
                    first_ngo = ngo_res.scalars().first()
                    if first_ngo:
                        donation.matched_ngo_id = first_ngo.id
                        donation.status = DonationStatus.MATCHED
                        donation.match_score = 0.95
                        await db.commit()
                        await db.refresh(donation)

                # Find preferred driver if driver_email given
                preferred_driver_id = None
                if driver_email:
                    target_u = await db.execute(select(User).where(User.email == driver_email))
                    u_obj = target_u.scalar_one_or_none()
                    if u_obj:
                        preferred_driver_id = u_obj.id

                # Ensure vehicles are AVAILABLE
                for v in vehicles:
                    v.availability_status = "AVAILABLE"
                    if not v.current_location or "," not in v.current_location:
                        v.current_location = "28.6273,77.2190"
                    if not v.capacity_kg or v.capacity_kg <= 0:
                        v.capacity_kg = 100.0
                await db.commit()

                # Dispatch
                outcome = await dispatch_donation(db, donation.id, preferred_driver_id=preferred_driver_id)
                dispatch_result = outcome.to_dict() if outcome else None

            return {
                "latest_donation": {
                    "id": donation.id if donation else None,
                    "status": donation.status.value if donation and donation.status else None,
                    "matched_ngo_id": donation.matched_ngo_id if donation else None,
                } if donation else None,
                "all_drivers_in_db": drivers_info,
                "recent_deliveries": deliveries,
                "dispatch_result": dispatch_result,
            }
        except Exception as e:
            return {"error": str(e), "traceback": traceback.format_exc()}
