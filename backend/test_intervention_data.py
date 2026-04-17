"""
Direct database test for intervention data
"""
from statistical_validation import run_statistical_validation
from database import SessionLocal, InterventionLog
import json

db = SessionLocal()

# Get all interventions
interventions = db.query(InterventionLog).all()
print(f"Total interventions: {len(interventions)}\n")

for iv in interventions:
    print(f"Intervention ID: {iv.id}")
    print(f"  Student: {iv.student_id}")
    print(f"  LES at intervention: {iv.les_at_intervention}")
    print(f"  Risk: {iv.risk_at_intervention}")
    print(f"  Weak concepts type: {type(iv.weak_concepts)}")
    print(f"  Weak concepts value: {iv.weak_concepts}")
    print(f"  Followed up: {iv.followed_up}")
    print(f"  Followup LES: {iv.followup_les}")
    print(f"  Improvement %: {iv.improvement_pct}")
    print()

# Try to manually run the validation function
print("\nTesting statistical_validation function...")
try:
    result = run_statistical_validation(db)
    print(f"SUCCESS: {result}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

db.close()
