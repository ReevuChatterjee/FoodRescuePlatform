"""
FastAPI main application.

Brings up all routers, CORS, WebSocket broker, health checks.
Person 1 owns this file in production; Person 6 extends it with analytics/admin routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.health import router as health_router
from app.analytics.router import router as analytics_router
from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.donations.router import router as donations_router
from app.ngos.router import router as ngos_router
from app.drivers.router import router as drivers_router
from app.deliveries.router import deliveries_router, handover_router
from app.matching.router import router as matching_router
from app.routing.router import router as routing_router
from app.dispatch.router import delivery_actions_router, dispatch_router, drivers_me_router
from app.ws.router import router as ws_router

app = FastAPI(
    title="CPI Food Rescue Platform",
    description="Algorithmic Micro-Donation & Food-Waste Routing Service",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health checks (no auth)
app.include_router(health_router)

# Auth (Person 1) — no auth required on register/login/refresh, per §1
app.include_router(auth_router)

# Core CRUD backbone (Person 1) — donations, NGOs, drivers, deliveries, handover
app.include_router(donations_router)
app.include_router(ngos_router)
app.include_router(drivers_router)
app.include_router(deliveries_router)
app.include_router(handover_router)

# Matching engine (Person 4) — candidates, accept, reject
app.include_router(matching_router)

# Routing + dispatch (Person 5) — /routes/calculate, driver availability and
# current job, start trip / issue reporting, admin dispatch trigger
app.include_router(routing_router)
app.include_router(drivers_me_router)
app.include_router(delivery_actions_router)
app.include_router(dispatch_router)

# WebSocket broker (Person 1) — /ws/donations, /ws/deliveries, /ws/drivers
app.include_router(ws_router)

# Analytics (ADMIN role required)
app.include_router(analytics_router)

# Admin operations (ADMIN role required)
app.include_router(admin_router)


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "service": "CPI Food Rescue Platform",
        "version": "0.1.0",
        "modules": ["auth", "donations", "ngos", "drivers", "deliveries", "matching", "routing", "dispatch", "websocket", "analytics", "admin"],
    }
