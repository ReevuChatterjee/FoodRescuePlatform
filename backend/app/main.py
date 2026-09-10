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
from app.ngo.router import router as ngo_router

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

# Analytics (ADMIN role required)
app.include_router(analytics_router)

# Admin operations (ADMIN role required)
app.include_router(admin_router)

# NGO profile, demand, capacity, and incoming-offer views (Person 3)
app.include_router(ngo_router)

# TODO: Person 1 includes auth router, Person 2–5 include their routers


@app.get("/")
async def root():
    return {
        "service": "CPI Food Rescue Platform",
        "version": "0.1.0",
        "person": 6,
        "module": "Admin, Analytics, Integration & Final Assembly",
    }
