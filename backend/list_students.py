from database import SessionLocal, User, StudentPerformance

db = SessionLocal()

# Show all students
print("All students in database:")
all_students = db.query(User).filter(User.role == 'student').all()
for student in all_students:
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student.id).first()
    status = "✓ Has data" if perf else "✗ No data"
    print(f"  {student.name} ({student.email}) - {status}")

db.close()
