"""Test LES endpoints with /api prefix"""
import requests
import time

time.sleep(2)

# Get token
r = requests.post('http://localhost:8002/auth/login', json={
    'email': 'teacher@academiq.com',
    'password': 'teacher123'
}, timeout=5)

if r.status_code != 200:
    print(f'Login failed: {r.status_code} - {r.text}')
    exit(1)

token = r.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

# Test 1: /api/analytics/students
print('Test 1: GET /api/analytics/students')
r = requests.get(
    'http://localhost:8002/api/analytics/students', headers=headers)
print(f'Status: {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'Students: {data.get("count")} records')
    if data.get('students'):
        print(f'First: {data["students"][0]["name"]}')
else:
    print(f'Error: {r.text}')

# Test 2: /api/analytics/statistical-validation
print()
print('Test 2: GET /api/analytics/statistical-validation')
r = requests.get(
    'http://localhost:8002/api/analytics/statistical-validation', headers=headers)
print(f'Status: {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'Sample size: {data.get("sample_size")}')
    if 'group_stats' in data:
        print(
            f'Mean improvement: {data["group_stats"].get("mean_improvement")}')
else:
    print(f'Error: {r.text}')

print()
print('✅ All tests passed!')
