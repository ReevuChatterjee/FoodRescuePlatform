import asyncio
from datetime import datetime
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.ids import new_id
from app.models import User, UserRole, Donor, NGO, NGOFoodCategory

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_demo_accounts():
    async with AsyncSessionLocal() as db:
        # Check if already seeded with .com
        existing_donor = await db.execute(select(User).where(User.email == "donor@cpi.com"))
        if existing_donor.scalar_one_or_none():
            print("Demo accounts already exist.")
            return

        print("Seeding demo Donor and NGO accounts...")

        # 1. Create Donor
        donor_user_id = new_id("usr")
        donor_user = User(
            id=donor_user_id,
            name="Alice The Donor",
            email="donor@cpi.com",
            phone="1111111111",
            password_hash=pwd_context.hash("password123"),
            role=UserRole.DONOR,
            created_at=datetime.utcnow()
        )
        db.add(donor_user)
        await db.flush()

        donor = Donor(
            id=new_id("don_org"),
            user_id=donor_user_id,
            organisation_name="Fresh Bakery",
            address="123 Donor St, Cityville",
            location="28.704060,77.102493", # Delhi coordinates
            contact_person="Alice",
            verification_status="APPROVED",
            daily_waste_category="COOKED",
        )
        db.add(donor)

        # 2. Create NGO
        ngo_user_id = new_id("usr")
        ngo_user = User(
            id=ngo_user_id,
            name="Bob The NGO",
            email="ngo@cpi.com",
            phone="2222222222",
            password_hash=pwd_context.hash("password123"),
            role=UserRole.NGO,
            created_at=datetime.utcnow()
        )
        db.add(ngo_user)
        await db.flush()

        ngo_id = new_id("ngo")
        ngo = NGO(
            id=ngo_id,
            user_id=ngo_user_id,
            organisation_name="City Food Bank",
            address="456 Rescue Ave, Cityville",
            location="28.705000,77.103000", # Very close to donor
            storage_capacity_kg=500.0,
            available_capacity_kg=500.0,
            operating_start="00:00",
            operating_end="23:59"
        )
        db.add(ngo)
        db.add(NGOFoodCategory(ngo_id=ngo_id, food_category="COOKED", accepted=True))
        db.add(NGOFoodCategory(ngo_id=ngo_id, food_category="PACKAGED", accepted=True))
        db.add(NGOFoodCategory(ngo_id=ngo_id, food_category="BAKED_GOODS", accepted=True))

        await db.commit()
        print("Done! You can log in with:")
        print("  Donor: donor@cpi.com / password123")
        print("  NGO:   ngo@cpi.com   / password123")

if __name__ == "__main__":
    asyncio.run(seed_demo_accounts())
