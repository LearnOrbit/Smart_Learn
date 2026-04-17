import requests
import json

# Test the quick analytics endpoint directly
student_id = "44c2f599-8ffb-4632-b2e8-ad2afb64d9a1"
token = "YOUR_TOKEN"  # We'll test without auth first

url = f"http://localhost:8002/api/student-analytics/{student_id}/quick"

print(f"Testing endpoint: {url}")
try:
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
