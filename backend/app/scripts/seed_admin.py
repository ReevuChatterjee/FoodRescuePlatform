"""
Seed the initial admin user so Person 6's smoke tests (and anyone else) can
obtain an admin JWT via POST /api/v1/auth/login without going through the
(role-restricted) /auth/register flow.

Usage (from backend/, inside the running container or a venv with DATABASE_URL set):

    python -m app.scripts.seed_admin --email admin@cpi.local --password changeme123 --name "Admin"

Safe to re-run: no-ops if a user with that email already exists.
"""
import argparse
import asyncio
from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.ids import new_id
from app.models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin(email: str, password: str, name: str, phone: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            print(f"Admin user {email} already exists — skipping.")
            return

        user = User(
            id=new_id("usr_admin"),
            name=name,
            email=email,
            phone=phone,
            password_hash=pwd_context.hash(password),
            role=UserRole.ADMIN,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        await db.commit()
        print(f"Created admin user {email} (id={user.id}).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the initial admin user.")
    parser.add_argument("--email", default="admin@cpi.local")
    parser.add_argument("--password", default="ChangeMe123!")
    parser.add_argument("--name", default="Platform Admin")
    parser.add_argument("--phone", default="0000000000")
    args = parser.parse_args()

    asyncio.run(seed_admin(args.email, args.password, args.name, args.phone))


if __name__ == "__main__":
    main()
