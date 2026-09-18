from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def ist_now() -> datetime:
    """Returns the current naive datetime in IST."""
    return datetime.now(IST).replace(tzinfo=None)

def ist_now_aware() -> datetime:
    """Returns the current timezone-aware datetime in IST."""
    return datetime.now(IST)

def to_naive_ist(dt: datetime) -> datetime:
    """Converts a timezone-aware datetime to a naive IST datetime.
    If the datetime is already naive, it is assumed to be IST and returned as is."""
    if dt.tzinfo is not None:
        return dt.astimezone(IST).replace(tzinfo=None)
    return dt
