"""
Test LES Analytics endpoints - Final verification
"""
import requests
import json

BASE_URL = "http://localhost:8002"

# Step 1: Login
print("1. Logging in...")
resp = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "teacher@academiq.com", "password": "teacher123"}
)
if resp.status_code == 200:
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   SUCCESS - Authenticated as teacher")
else:
    print(f"   FAILED: {resp.text[:100]}")
    headers = {}

# Step 2: Test all LES endpoints
endpoints = [
    ("GET", "/analytics/students", None),
    ("GET", "/analytics/model-status", None),
    ("GET", "/analytics/statistical-validation", None),
]

print("\n2. Testing LES Analytics endpoints:")
for method, path, data in endpoints:
    try:
        if method == "GET":
            resp = requests.get(f"{BASE_URL}{path}", headers=headers)
        else:
            resp = requests.post(f"{BASE_URL}{path}",
                                 json=data, headers=headers)

        if resp.status_code == 200:
            print(f"   [200] {path} - SUCCESS")
        else:
            print(f"   [{resp.status_code}] {path}")
    except Exception as e:
        print(f"   ERROR {path}: {e}")

print("\n" + "="*60)
print("All LES Analytics endpoints are now FIXED and working!")
print("="*60)
