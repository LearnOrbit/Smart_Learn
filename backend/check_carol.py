from database import SessionLocal, User, StudentPerformance

db = SessionLocal()

# Find Carol Martinez
carols = db.query(User).filter(User.full_name.ilike('%Carol%Martinez%')).all()
print(f"Found {len(carols)} Carol Martinez(es):")
for carol in carols:
    print(f"  ID: {carol.id}, Name: {carol.full_name}, Email: {carol.email}")

    # Check if they have performance data
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == carol.id).first()
    if perf:
        print(
            f"    ✓ Has performance data: marks={perf.student_marks}, ia={perf.internal_assessments}")
    else:
        print(f"    ✗ NO performance data")

db.close()
