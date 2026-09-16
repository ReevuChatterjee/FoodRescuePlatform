import asyncio
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def update_admin():
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == 'admin@cpi.com'))
        user = existing.scalar_one_or_none()
        if user:
            user.password_hash = pwd_context.hash('admin123')
            user.role = UserRole.ADMIN
            await db.commit()
            print("Successfully reset the password for admin@cpi.com to 'admin123' and ensured they have ADMIN role.")
        else:
            print("User admin@cpi.com not found")

if __name__ == "__main__":
    asyncio.run(update_admin())
