import requests
import uuid

def main():
    email = f"admin_{uuid.uuid4().hex[:6]}@replate.org"
    reg = requests.post("https://cpi-backend-q95l.onrender.com/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "name": "Temp Admin",
        "role": "ADMIN",
        "phone": "1234567890"
    })
    
    if reg.status_code != 201:
        print("Register failed:", reg.text)
        return
        
    token = reg.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    donations = requests.get("https://cpi-backend-q95l.onrender.com/api/v1/donations", headers=headers)
    print("Donations:")
    print(donations.text)
    
    drivers = requests.get("https://cpi-backend-q95l.onrender.com/api/v1/drivers", headers=headers)
    print("Drivers:")
    print(drivers.text)

if __name__ == "__main__":
    main()
