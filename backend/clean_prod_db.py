import asyncio
import os
from sqlalchemy import text
from app.core.database import engine

async def clean_database():
    print(f"Connecting to database at {engine.url.render_as_string(hide_password=True)}...")
    
    # Order matters for foreign keys. Child tables must be deleted before parent tables.
    tables_in_delete_order = [
        "audit_logs",
        "handover_records",
        "donation_rejections",
        "deliveries",
        "donations",
        "ngo_demand",
        "ngo_food_categories",
        "ngo_verification_documents",
        "vehicles",
        "ngos",
        "donors"
    ]

    async with engine.begin() as conn:
        print("Clearing tables...")
        for table in tables_in_delete_order:
            await conn.execute(text(f"DELETE FROM {table}"))
            print(f" - Cleared {table}")

        # Delete non-admin users
        result = await conn.execute(text("DELETE FROM users WHERE role != 'ADMIN'"))
        print(f" - Deleted non-admin users (Rows affected: {result.rowcount})")

    print("Database cleaned successfully. Kept admin credentials and weights history.")
    
    # Close the engine
    await engine.dispose()

if __name__ == "__main__":
    # Ensure DATABASE_URL is set
    if "DATABASE_URL" not in os.environ:
        print("WARNING: No DATABASE_URL environment variable found.")
        print("Make sure to export DATABASE_URL with your production database credentials before running this.")
        print("Example: export DATABASE_URL=postgresql+asyncpg://user:pass@host/db")
        print("\nPress Enter to continue with the default config (which might be local), or Ctrl+C to cancel.")
        try:
            input()
        except KeyboardInterrupt:
            print("\nCancelled.")
            exit(0)
            
    asyncio.run(clean_database())
