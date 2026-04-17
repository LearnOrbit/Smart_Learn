#!/usr/bin/env python
"""Test the analytics endpoint directly"""

import requests
import json
import sys

# Test parameters
BASE_URL = "http://localhost:8002"
STUDENT_ID = "test_student_123"  # Replace with actual student ID
TOKEN = "test_token"  # You'll need to get a real auth token

# Create a test student first
print("🔍 Testing Analytics Endpoint...")
print(f"Base URL: {BASE_URL}")
print(f"Student ID: {STUDENT_ID}")

# Test the quick analytics endpoint
url = f"{BASE_URL}/api/student-analytics/{STUDENT_ID}/quick"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

print(f"\n📍 GET {url}")
try:
    response = requests.get(url, headers=headers, timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Success! Received analytics data:")
        print(json.dumps(data, indent=2, default=str)[:500])
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"\n❌ Exception: {e}")
    print("Make sure the backend is running on port 8002")
