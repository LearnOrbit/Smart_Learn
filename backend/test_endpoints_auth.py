"""Test analytics endpoints with authentication"""
import requests
import json
import time

time.sleep(3)  # Wait for backend to start

# First, get a token by logging in
print('Obtaining authentication token...')
try:
    r = requests.post('http://localhost:8002/auth/login', json={
        'email': 'teacher@academiq.com',
        'password': 'teacher123'
    }, timeout=5)
    if r.status_code != 200:
        print(f'Login failed: {r.status_code}')
        print(f'Response: {r.text}')
        exit(1)
    token = r.json().get('access_token')
    print(f'Got token: {token[:20]}...')
except Exception as e:
    print(f'Login exception: {e}')
    exit(1)

headers = {'Authorization': f'Bearer {token}'}

# Test 1: /analytics/students
print()
print('=' * 60)
print('Test 1: GET /analytics/students')
try:
    r = requests.get('http://localhost:8002/analytics/students',
                     headers=headers, timeout=5)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Students count: {data.get("count")}')
        if data.get('students'):
            print(
                f'First student: {json.dumps(data["students"][0], indent=2)}')
    else:
        print(f'Error: {r.text[:300]}')
except Exception as e:
    print(f'Exception: {e}')

# Test 2: /analytics/statistical-validation
print()
print('=' * 60)
print('Test 2: GET /analytics/statistical-validation')
try:
    r = requests.get(
        'http://localhost:8002/analytics/statistical-validation', headers=headers, timeout=5)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Response keys: {list(data.keys())}')
        if 'interventions_count' in data:
            print(f'Interventions count: {data["interventions_count"]}')
        # Show a sample of the response
        if 'summary' in data:
            print(f'Summary: {json.dumps(data["summary"], indent=2)[:500]}')
    else:
        print(f'Error: {r.text[:300]}')
except Exception as e:
    print(f'Exception: {type(e).__name__}: {e}')
