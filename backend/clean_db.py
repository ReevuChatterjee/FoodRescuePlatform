import sqlite3
import os

DB_PATH = "local_dev.sqlite3"

def clean_database():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Disable foreign keys temporarily just in case
    cursor.execute("PRAGMA foreign_keys = OFF;")

    tables_to_clear = [
        "audit_logs",
        "deliveries",
        "donation_rejections",
        "handover_records",
        "donations",
        "ngo_demand",
        "ngo_food_categories",
        "ngo_verification_documents",
        "vehicles",
        "ngos",
        "donors"
    ]

    print("Clearing tables...")
    for table in tables_to_clear:
        cursor.execute(f"DELETE FROM {table};")
        print(f" - Cleared {table}")

    # Delete non-admin users
    cursor.execute("DELETE FROM users WHERE role != 'ADMIN';")
    print(" - Deleted all non-admin users")

    conn.commit()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Vaccum to reclaim space
    cursor.execute("VACUUM;")
    
    conn.close()
    print("Database cleaned successfully. Kept admin credentials and matching_weights_history.")

if __name__ == "__main__":
    clean_database()
