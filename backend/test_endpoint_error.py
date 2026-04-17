"""Get detailed error information from statistical validation endpoint"""
import requests
import json
import time

time.sleep(2)

# Get token
r = requests.post('http://localhost:8002/auth/login', json={
    'email': 'teacher@academiq.com',
    'password': 'teacher123'
}, timeout=5)
token = r.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

# Call endpoint
print('Calling /analytics/statistical-validation...')
r = requests.get(
    'http://localhost:8002/analytics/statistical-validation', headers=headers, timeout=5)
print(f'Status: {r.status_code}')
print(f'Headers: {dict(r.headers)}')
print(f'Content-Type: {r.headers.get("content-type")}')
print()

# Try to parse response
try:
    data = r.json()
    print(f'JSON Response: {json.dumps(data, indent=2)}')
except Exception as e:
    print(f'ERROR parsing JSON: {e}')
    print(f'Raw text (first 500 chars): {r.text[:500]}')
    print(f'Full raw text: {r.text}')
