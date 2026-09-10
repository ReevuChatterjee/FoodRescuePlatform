"""
JWT authentication and role-based authorization dependencies.

Reuses across all protected routes (admin, donor, NGO, driver).
Person 6 reuses these patterns exactly as found here — does not introduce
a second auth mechanism.
"""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from sqlalchemy import select

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Decode JWT from Authorization: Bearer header and return current user.
    Raises 401 if token invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid credentials", "field": None}},
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    """
    Dependency: ensures current user has role ADMIN.
    Per [orig §21, §42]: backend 403 is the real authorization boundary.
    """
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You are not authorized to perform this action.",
                    "field": None,
                }
            },
        )
    return user


def require_ngo(user: Annotated[User, Depends(get_current_user)]) -> User:
    """Ensure that the caller is an NGO user."""
    if user.role != "NGO":
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "You are not authorized to access NGO resources.",
                    "field": None,
                }
            },
        )
    return user
