import requests
import json

base_url = "http://localhost:8002/api"

# Test LES endpoints
endpoints = [
    "/analytics/students",
    "/analytics/statistical-validation",
    "/analytics/model-status",
]

print("Testing LES endpoints:\n")
for endpoint in endpoints:
    url = f"{base_url}{endpoint}"
    try:
        response = requests.get(url, timeout=5)
        print(f"[{response.status_code}] {endpoint}")
        if response.status_code != 200:
            print(f"  Error: {response.text[:200]}")
        else:
            print(f"  OK - {len(response.text)} bytes")
    except Exception as e:
        print(f"[FAIL] {endpoint}")
        print(f"  Error: {str(e)[:100]}")
    print()
