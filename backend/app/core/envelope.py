from app.core.time import IST, ist_now
"""
Shared response envelope helpers per Global Conventions §1:

  Success: { "data": {...}, "meta": { "request_id": "..." } }
  List:    meta also gets { "next_cursor": "...", "has_more": true }
  Error:   { "error": { "code", "message", "field", "request_id" } }

Person 4's admin/analytics routers hand-roll this envelope inline already;
new routers (auth, donations, ngos, drivers, deliveries) import it from here
so the shape can never drift between endpoints.
"""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException


def iso_z(dt: datetime) -> str:
    """Format a datetime as IST ISO-8601 with a trailing +05:30.
    Safe for both naive datetimes (assumed already IST) and timezone-aware ones."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(IST).replace(tzinfo=None)
    return dt.isoformat() + "+05:30"


def envelope(data: dict) -> dict:
    return {"data": data, "meta": {"request_id": str(uuid4())}}


def list_envelope(data: list, next_cursor: str | None = None, has_more: bool = False) -> dict:
    return {
        "data": data,
        "meta": {"request_id": str(uuid4()), "next_cursor": next_cursor, "has_more": has_more},
    }


def api_error(status_code: int, code: str, message: str, field: str | None = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message, "field": field, "request_id": str(uuid4())}},
    )
