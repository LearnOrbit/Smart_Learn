"""Test both analytics endpoints after fresh backend start"""
import requests
import json
import time

time.sleep(3)  # Wait for backend to start

# Test 1: /analytics/students
print('=' * 60)
print('Test 1: GET /analytics/students')
try:
    r = requests.get('http://localhost:8002/analytics/students', timeout=5)
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
        'http://localhost:8002/analytics/statistical-validation', timeout=5)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Response keys: {list(data.keys())}')
        if 'interventions_count' in data:
            print(f'Interventions count: {data["interventions_count"]}')
        sample = str(data)[:300]
        print(f'Response preview: {sample}')
    else:
        print(f'Error: {r.text[:300]}')
except Exception as e:
    print(f'Exception: {type(e).__name__}: {e}')
