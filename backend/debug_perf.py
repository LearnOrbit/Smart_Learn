from database import SessionLocal, StudentPerformance

db = SessionLocal()
perfs = db.query(StudentPerformance).limit(5).all()
print(f"Total records: {len(perfs)}")
for p in perfs:
    print(f"Student {p.student_id}: marks={p.student_marks}, ia={p.internal_assessments}, att={p.attendance}, lab={p.lab_performance}, assignment={p.assignment_scores}")
db.close()
