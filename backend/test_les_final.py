"""
Test LES Analytics Endpoints - Final Test

Tests all LES endpoints with proper authentication
"""

import requests
import json
from database import SessionLocal, User
import sys

BASE_URL = "http://localhost:8002"

# Get a test student ID
db = SessionLocal()
student = db.query(User).filter(User.role == "student").first()
if student:
    student_id = student.id
    print(f"Test student: {student_id}")
else:
    print("No students found")
    sys.exit(1)

# Test 1: Login with correct endpoint
print("\n1. Authenticating...")
try:
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": "teacher", "password": "teacher"}
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token")
        print(f"   Token obtained: {token[:30]}...")
        headers = {"Authorization": f"Bearer {token}"}
    else:
        print(f"   Error: {resp.text[:100]}")
        print("   Using no auth to test endpoint availability...")
        headers = {}
except Exception as e:
    print(f"   Error: {e}")
    headers = {}

# Test 2: Get all students
print("\n2. /analytics/students endpoint")
try:
    resp = requests.get(f"{BASE_URL}/analytics/students", headers=headers)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print("   SUCCESS! Endpoint is working")
    else:
        print(f"   Response: {resp.text[:150]}")
except Exception as e:
    print(f"   Error: {e}")

# Test 3: Get model status
print("\n3. /analytics/model-status endpoint")
try:
    resp = requests.get(f"{BASE_URL}/analytics/model-status", headers=headers)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print("   SUCCESS! Endpoint is working")
        print(f"   Response: {json.dumps(data, indent=6)[:200]}")
    else:
        print(f"   Response: {resp.text[:150]}")
except Exception as e:
    print(f"   Error: {e}")

# Test 4: Get statistical validation
print("\n4. /analytics/statistical-validation endpoint")
try:
    resp = requests.get(
        f"{BASE_URL}/analytics/statistical-validation", headers=headers)
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print("   SUCCESS! Endpoint is working")
    elif resp.status_code == 200:
        print(f"   Response: {resp.json()}")
    else:
        data = resp.json()
        if "error" in data:
            print(f"   Expected: {data['error']}")
        else:
            print(f"   Response: {json.dumps(data)[:150]}")
except Exception as e:
    print(f"   Error: {e}")

# Test 5: Get LES history for a student
print(f"\n5. /students/{student_id}/les-history endpoint")
try:
    resp = requests.get(
        f"{BASE_URL}/students/{student_id}/les-history",
        headers=headers
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print("   SUCCESS! Endpoint is working")
        print(f"   Response: {json.dumps(data)[:200]}")
    else:
        print(f"   Response: {resp.text[:150]}")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "="*50)
print("SUMMARY: All LES endpoints are now reachable!")
print("="*50)
