"""
Test LES Analytics Endpoints - Version 2

Tests:
1. /analytics/students
2. /analytics/statistical-validation
3. /analytics/model-status
4. /students/{id}/les-history
"""

import requests
import json
from database import SessionLocal, User

BASE_URL = "http://localhost:8002"

# Get a test student ID
db = SessionLocal()
student = db.query(User).filter(User.role == "student").first()
if student:
    student_id = student.id
    print(f"Using test student: {student_id}")
else:
    print("No students found!")
    student_id = None

# Test 1: Login to get auth token
print("\n1. Testing login for authentication...")
try:
    resp = requests.post(
        f"{BASE_URL}/login",
        json={
            "username": "teacher",
            "password": "teacher"
        }
    )
    print(f"Login Status: {resp.status_code}")
    if resp.status_code == 200:
        token = resp.json().get("access_token")
        print(f"Token obtained: {token[:20]}...")
        headers = {"Authorization": f"Bearer {token}"}
    else:
        print(f"Login failed: {resp.text}")
        headers = {}
except Exception as e:
    print(f"Login error: {e}")
    headers = {}

# Test 2: Get all students
print("\n2. Testing /analytics/students...")
try:
    resp = requests.get(f"{BASE_URL}/analytics/students", headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"✓ Success! Found {len(data.get('students', []))} students")
        print(f"Response preview: {json.dumps(data)[:200]}...")
    else:
        print(f"Error: {resp.text[:200]}...")
except Exception as e:
    print(f"Request error: {e}")

# Test 3: Get model status
print("\n3. Testing /analytics/model-status...")
try:
    resp = requests.get(f"{BASE_URL}/analytics/model-status", headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"✓ Success!")
        print(f"Response: {json.dumps(data, indent=2)[:300]}...")
    else:
        print(f"Error: {resp.text[:200]}...")
except Exception as e:
    print(f"Request error: {e}")

# Test 4: Get statistical validation
print("\n4. Testing /analytics/statistical-validation...")
try:
    resp = requests.get(
        f"{BASE_URL}/analytics/statistical-validation", headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"✓ Success!")
        if "sample_size" in data:
            print(f"Sample size: {data['sample_size']}")
            print(f"Response preview: {json.dumps(data)[:300]}...")
        else:
            print(f"Response: {json.dumps(data, indent=2)[:300]}...")
    else:
        print(f"Status code {resp.status_code}: {resp.text[:200]}...")
except Exception as e:
    print(f"Request error: {e}")

# Test 5: Get LES history for a student
if student_id:
    print(f"\n5. Testing /students/{student_id}/les-history...")
    try:
        resp = requests.get(
            f"{BASE_URL}/students/{student_id}/les-history",
            headers=headers
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            history_count = len(data.get("history", []))
            print(f"✓ Success! Found {history_count} LES snapshots")
            if history_count > 0:
                print(
                    f"First snapshot: {json.dumps(data['history'][0], indent=2)}")
            else:
                print("No LES history yet (this is expected)")
        else:
            print(f"Status code {resp.status_code}: {resp.text[:200]}...")
    except Exception as e:
        print(f"Request error: {e}")

print("\n✓ All LES endpoint tests completed!")
