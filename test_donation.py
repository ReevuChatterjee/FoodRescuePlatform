import requests
from datetime import datetime, timedelta

def main():
    login_resp = requests.post("https://cpi-backend-q95l.onrender.com/api/v1/auth/login", json={
        "email": "donor@gmail.com",
        "password": "password123"
    })
    
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        return
        
    token = login_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    now = datetime.utcnow()
    payload = {
        "food_name": "Test Food",
        "food_category": "COOKED",
        "quantity_kg": 10.5,
        "prepared_at": (now - timedelta(hours=1)).isoformat() + "Z",
        "available_from": now.isoformat() + "Z",
        "expiry_time": (now + timedelta(hours=3)).isoformat() + "Z",
        "pickup_location": {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "address": "Bengaluru"
        },
        "food_safety_info": {
            "storage_temp_required": "ROOM_TEMP",
            "allergen_tags": [],
            "packaging_type": "Box"
        }
    }
    
    create_resp = requests.post("https://cpi-backend-q95l.onrender.com/api/v1/donations", json=payload, headers=headers)
    print("Create Donation Response:", create_resp.status_code)
    print(create_resp.text)

if __name__ == "__main__":
    main()
