"""
Create sample LES data for testing
"""
from database import SessionLocal, User, LESSnapshot, InterventionLog, ModelVersion
from datetime import datetime, timedelta
import uuid
import json

db = SessionLocal()

# Get students
students = db.query(User).filter(User.role == "student").all()
print(f"Found {len(students)} students")

# Clear old data
db.query(LESSnapshot).delete()
db.query(InterventionLog).delete()
db.query(ModelVersion).delete()

# Create sample LES snapshots
for i, student in enumerate(students):
    for j in range(3):
        les_score = 50 + (j * 10) + i
        snapshot = LESSnapshot(
            id=str(uuid.uuid4()),
            student_id=student.id,
            pre_score=40 + (j * 5) + i,
            post_score=les_score,
            les=min(les_score, 100),
            attendance=70 + (j * 5),
            assignment_scores=60 + (j * 5),
            internal_assessment=65 + (j * 5),
            lab_performance=55 + (j * 5),
            study_hours=2 + j,
            concept_mastery=50 + (j * 5),
            risk_level="High" if les_score < 40 else "Moderate" if les_score < 60 else "Low",
            snapshot_type="auto",
            created_at=datetime.utcnow() - timedelta(days=7-j),
        )
        db.add(snapshot)

# Create sample interventions with follow-ups
for i, student in enumerate(students[:3]):
    intervention = InterventionLog(
        id=str(uuid.uuid4()),
        student_id=student.id,
        les_at_intervention=50.0 + i,
        risk_at_intervention="Moderate",
        weak_concepts=json.dumps(["Topic A", "Topic B"]),
        advisory_plan="Study weak topics",
        followed_up=True,
        followup_les=65.0 + i,
        improvement_pct=30.0,
        created_at=datetime.utcnow() - timedelta(days=7),
        followup_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add(intervention)

# Create sample model version
model = ModelVersion(
    id=str(uuid.uuid4()),
    version_number=1,
    model_type="random_forest",
    r_squared=0.85,
    rmse=5.2,
    mae=3.8,
    cross_val_score=0.82,
    training_samples=9,
    trigger="manual",
    triggered_by="system",
    model_path="/backend/models/les_model_v1.pkl",
    is_active=True,
)
db.add(model)

db.commit()
print("Seeding complete!")
print(f"✓ {len(students)*3} LES snapshots created")
print(f"✓ 3 interventions created")
print(f"✓ 1 model version created")
db.close()
