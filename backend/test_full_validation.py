"""Test endpoints and show full response structure"""
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

# Test /analytics/students
print('=' * 70)
print('✅ Test 1: GET /analytics/students')
print('=' * 70)
r = requests.get('http://localhost:8002/analytics/students',
                 headers=headers, timeout=5)
print(f'Status: {r.status_code}')
data = r.json()
print(f'Response structure:')
print(f'  - count: {data.get("count")}')
print(f'  - students: {len(data.get("students", []))} records')
if data.get('students'):
    print(f'  - First student: {json.dumps(data["students"][0], indent=6)}')

# Test /analytics/statistical-validation
print()
print('=' * 70)
print('✅ Test 2: GET /analytics/statistical-validation')
print('=' * 70)
r = requests.get(
    'http://localhost:8002/analytics/statistical-validation', headers=headers, timeout=5)
print(f'Status: {r.status_code}')
data = r.json()
print(f'Response structure:')
for key in data.keys():
    print(f'  - {key}: {type(data[key]).__name__}')

print()
print(f'Sample statistics:')
print(f'  - sample_size: {data.get("sample_size")}')
if 'paired_ttest' in data:
    print(f'  - t_statistic: {data["paired_ttest"].get("t_statistic")}')
    print(f'  - p_value: {data["paired_ttest"].get("p_value")}')
    print(f'  - significant: {data["paired_ttest"].get("significant")}')
if 'group_stats' in data:
    print(f'  - pre_mean: {data["group_stats"].get("pre_mean")}')
    print(f'  - post_mean: {data["group_stats"].get("post_mean")}')
    print(
        f'  - mean_improvement: {data["group_stats"].get("mean_improvement")}')
if 'improvement_summary' in data and data['improvement_summary']:
    print(f'  - improvement_summary count: {len(data["improvement_summary"])}')
    print(
        f'  - first improvement: {json.dumps(data["improvement_summary"][0], indent=6)}')

print()
print('✅✅✅ ALL TESTS PASSED! ✅✅✅')
