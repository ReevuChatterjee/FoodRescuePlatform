import requests

def main():
    # Login to get JWT
    login_resp = requests.post("https://cpi-backend-q95l.onrender.com/api/v1/auth/login", json={
        "email": "driver@gmail.com",
        "password": "password123"
    })
    
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        return
        
    token = login_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current job/profile
    profile_resp = requests.get("https://cpi-backend-q95l.onrender.com/api/v1/drivers/me/current-job", headers=headers)
    print("Driver Profile & Job:")
    print(profile_resp.text)
    
    # Get donations (Wait, drivers can't get ALL donations, only ADMIN or NGO can?)
    # Let's login as admin to see all donations
    admin_login = requests.post("https://cpi-backend-q95l.onrender.com/api/v1/auth/login", json={
        "email": "admin@replate.org",
        "password": "password123"
    })
    
    if admin_login.status_code == 200:
        admin_token = admin_login.json()["data"]["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        donations = requests.get("https://cpi-backend-q95l.onrender.com/api/v1/admin/donations", headers=admin_headers)
        print("\nAll Donations:")
        print(donations.text)
    else:
        print("\nAdmin login failed:", admin_login.text)

if __name__ == "__main__":
    main()
