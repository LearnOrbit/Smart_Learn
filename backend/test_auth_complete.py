#!/usr/bin/env python3
"""
Complete authentication flow test
"""
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("COMPLETE AUTHENTICATION TEST")
print("=" * 60)

# Test 1: Login
print("\n✓ TEST 1: Login with alice@example.com")
login_response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "alice@example.com", "password": "password123"}
)
print(f"  Status: {login_response.status_code}")
login_data = login_response.json()
token = login_data["access_token"]
print(f"  Token received: {token[:50]}...")
print(f"  User: {login_data['user']['name']} ({login_data['user']['role']})")

# Test 2: Access protected endpoint
print("\n✓ TEST 2: Access protected endpoint /auth/me")
me_response = requests.get(
    f"{BASE_URL}/auth/me",
    headers={"Authorization": f"Bearer {token}"}
)
print(f"  Status: {me_response.status_code}")
me_data = me_response.json()
print(f"  User details: {me_data['name']} ({me_data['role']})")

# Test 3: Test with wrong password
print("\n✓ TEST 3: Login with wrong password")
wrong_pwd = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "alice@example.com", "password": "wrongpassword"}
)
print(f"  Status: {wrong_pwd.status_code}")
if wrong_pwd.status_code != 200:
    print(f"  Error: {wrong_pwd.json()['detail']}")

# Test 4: Test with non-existent user
print("\n✓ TEST 4: Login with non-existent user")
no_user = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "nonexistent@example.com", "password": "password123"}
)
print(f"  Status: {no_user.status_code}")
if no_user.status_code != 200:
    print(f"  Error: {no_user.json()['detail']}")

# Test 5: Test with teacher account
print("\n✓ TEST 5: Login with teacher account")
teacher_login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "teacher@example.com", "password": "password123"}
)
print(f"  Status: {teacher_login.status_code}")
teacher_data = teacher_login.json()
print(
    f"  User: {teacher_data['user']['name']} ({teacher_data['user']['role']})")

# Test 6: Protected endpoint without token
print("\n✓ TEST 6: Access protected endpoint without token")
no_token = requests.get(f"{BASE_URL}/auth/me")
print(f"  Status: {no_token.status_code}")
if no_token.status_code != 200:
    print(f"  Error: {no_token.json()['detail']}")

# Test 7: Protected endpoint with invalid token
print("\n✓ TEST 7: Access protected endpoint with invalid token")
invalid_token = requests.get(
    f"{BASE_URL}/auth/me",
    headers={"Authorization": "Bearer invalid.token.here"}
)
print(f"  Status: {invalid_token.status_code}")
if invalid_token.status_code != 200:
    print(f"  Error: {invalid_token.json()['detail']}")

print("\n" + "=" * 60)
print("ALL TESTS COMPLETED ✅")
print("=" * 60)
