import requests
import time

# Give backend a moment to start
time.sleep(1)

url = "http://localhost:8002/api/student-analytics/44c2f599-8ffb-4632-b2e8-ad2afb64d9a1/quick"
print(f"Testing: {url}")

try:
    response = requests.get(url, timeout=5)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"[SUCCESS] Got analytics!")
        print(f"  Student ID: {data.get('student_id')}")
        print(f"  Performance: {data.get('performance_level')}")
        print(f"  Average IA: {data.get('average_ia')}")
        print(f"  Weak Topics: {data.get('weak_topics')}")
        print(f"  Keys: {list(data.keys())}")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Failed: {e}")
