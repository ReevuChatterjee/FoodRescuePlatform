"""Application settings loaded from .env / environment."""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────────────────────────────
    # Supabase connection string format:
    #   Async (asyncpg): postgresql+asyncpg://user:password@host:5432/db?sslmode=require
    #   Sync  (psycopg2 / Alembic): postgresql://user:password@host:5432/db?sslmode=require
    DATABASE_URL: str = "postgresql+asyncpg://replate_user:replate_pass@db:5432/replate_db"
    DATABASE_URL_SYNC: str = "postgresql://replate_user:replate_pass@db:5432/replate_db"

    # ── Redis (optional) ──────────────────────────────────────────────────────
    # Leave empty / unset to disable idempotency caching and Redis health check.
    # On Vercel free tier, omit this; add Upstash Redis if you need idempotency.
    REDIS_URL: Optional[str] = None

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "CHANGEME_at_least_32_chars_long"
    JWT_REFRESH_SECRET: str = "CHANGEME_refresh_at_least_32_chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── Analytics constants ────────────────────────────────────────────────────
    # Source: common food-rescue-sector estimate (0.5 kg = 1 meal).
    MEAL_WEIGHT_KG: float = 0.5
    # Estimate: 14 meals per beneficiary per 7-day period.
    MEALS_PER_BENEFICIARY_PER_PERIOD: int = 14

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def redis_enabled(self) -> bool:
        return bool(self.REDIS_URL)


settings = Settings()
