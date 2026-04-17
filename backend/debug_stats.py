"""
Debug statistical validation endpoint
"""
import requests
import json

BASE_URL = "http://localhost:8002"

# Login
resp = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "teacher@academiq.com", "password": "teacher123"}
)
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test statistical validation
print("Testing /analytics/statistical-validation...")
resp = requests.get(
    f"{BASE_URL}/analytics/statistical-validation", headers=headers)
print(f"Status: {resp.status_code}")
print(f"Response text: {resp.text}")

try:
    print(f"Response JSON: {json.dumps(resp.json(), indent=2)}")
except:
    print("Could not parse JSON response")
