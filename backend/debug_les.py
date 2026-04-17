"""
Debug LES Analytics - Check what data is being returned
"""
import requests
import json
from database import SessionLocal, User, LESSnapshot, InterventionLog

BASE_URL = "http://localhost:8002"

# Check database first
print("=== DATABASE CHECK ===")
db = SessionLocal()

students = db.query(User).filter(User.role == "student").all()
print(f"Total students: {len(students)}")
for s in students:
    print(f"  - {s.name} ({s.id})")

les_snapshots = db.query(LESSnapshot).all()
print(f"\nTotal LES snapshots: {len(les_snapshots)}")

interventions = db.query(InterventionLog).all()
print(f"Total interventions: {len(interventions)}")
followed_up = db.query(InterventionLog).filter(
    InterventionLog.followed_up == True).all()
print(f"Interventions with follow-up: {len(followed_up)}")

db.close()

# Login
print("\n=== AUTHENTICATION ===")
resp = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "teacher@academiq.com", "password": "teacher123"}
)
if resp.status_code != 200:
    print(f"Login failed: {resp.text}")
    exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("Authenticated successfully")

# Test /analytics/students
print("\n=== /analytics/students ===")
resp = requests.get(f"{BASE_URL}/analytics/students", headers=headers)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Response: {json.dumps(data, indent=2)[:500]}")

# Test /analytics/statistical-validation
print("\n=== /analytics/statistical-validation ===")
resp = requests.get(
    f"{BASE_URL}/analytics/statistical-validation", headers=headers)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Response: {json.dumps(data, indent=2)[:500]}")

# Test /analytics/model-status
print("\n=== /analytics/model-status ===")
resp = requests.get(f"{BASE_URL}/analytics/model-status", headers=headers)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Response: {json.dumps(data, indent=2)}")
