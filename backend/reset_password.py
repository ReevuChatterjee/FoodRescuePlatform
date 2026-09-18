import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.security import get_password_hash

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///./local_dev.sqlite3")
    async with engine.begin() as conn:
        new_hash = get_password_hash("password")
        await conn.execute(text("UPDATE users SET password_hash = :hash WHERE email = 'admin@cpi.com'"), {"hash": new_hash})
        await conn.execute(text("UPDATE users SET password_hash = :hash WHERE email = 'donor@test.com'"), {"hash": new_hash})
        await conn.execute(text("UPDATE users SET password_hash = :hash WHERE email = 'ngo@test.com'"), {"hash": new_hash})
        await conn.execute(text("UPDATE users SET password_hash = :hash WHERE email = 'driver@test.com'"), {"hash": new_hash})
    print("Passwords reset to 'password'")

if __name__ == "__main__":
    asyncio.run(main())
