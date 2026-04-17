"""
Test if statistical validation returns JSON-serializable data
"""
from database import SessionLocal
from statistical_validation import run_statistical_validation
import json

db = SessionLocal()

print("Testing statistical_validation function JSON serializability...")
result = run_statistical_validation(db)
print(f"Result type: {type(result)}")

# Try to serialize
try:
    json_str = json.dumps(result)
    print("SUCCESS! Result is JSON-serializable")
    print(f"JSON length: {len(json_str)} characters")
except TypeError as e:
    print(f"ERROR: Result not JSON-serializable: {e}")
    # Show which field is causing the problem
    for key, val in result.items():
        try:
            json.dumps(val)
        except TypeError:
            print(f"  Problem field: {key} = {val}")

db.close()
