"""
Seed test data for LES feedback loop system

Creates:
  - Test students
  - Test assignments
  - Test submissions with grades (triggers LES snapshots)
  - Test intervention logs

Run: python seed_les_data.py
"""

from sqlalchemy.orm import Session
from database import SessionLocal, User, Subject, Assignment, Submission, LESSnapshot, InterventionLog
from datetime import datetime, timedelta
import uuid
import json


def seed_les_data():
    db = SessionLocal()

    try:
        print("Seeding LES test data...\n")

        # ─── Get or create test subject ───────────────────────────────────
        subject = db.query(Subject).filter(Subject.code == "CSE101").first()
        if not subject:
            subject_id = str(uuid.uuid4())
            subject = Subject(
                id=subject_id,
                code="CSE101",
                name="Data Structures & Algorithms"
            )
            db.add(subject)
            db.commit()
            print("✓ Created test subject: CSE101")
        else:
            print("✓ Using existing subject: CSE101")

        # ─── Get or create test students ────────────────────────────────
        students_data = [
            ("student1@test.com", "Alice", "stu_alice"),
            ("student2@test.com", "Bob", "stu_bob"),
            ("student3@test.com", "Charlie", "stu_charlie"),
        ]

        students = []
        for email, name, student_id in students_data:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                from auth import hash_password
                user = User(
                    id=student_id,
                    email=email,
                    name=name,
                    password_hash=hash_password("password123"),
                    role="student"
                )
                db.add(user)
                db.commit()
                print(f"✓ Created student: {name} ({email})")
            else:
                print(f"✓ Using existing student: {name}")
            students.append(user)

        # ─── Get or create test assignment ──────────────────────────────
        assignment = db.query(Assignment).filter(
            Assignment.code == "ASSIGN01"
        ).first()
        if not assignment:
            assignment_id = str(uuid.uuid4())
            assignment = Assignment(
                id=assignment_id,
                code="ASSIGN01",
                name="Arrays & Sorting",
                subject_id=subject.id,
                total_marks=100,
                pass_marks=40,
                due_date=datetime.utcnow() + timedelta(days=7)
            )
            db.add(assignment)
            db.commit()
            print(f"✓ Created assignment: {assignment.name}")
        else:
            print(f"✓ Using existing assignment: {assignment.name}")

        # ─── Create submissions and grade them ──────────────────────────
        print("\n📝 Creating submissions with grades (triggers LES snapshots)...\n")

        grades_per_student = [
            [45, 55, 72],   # Alice: improving trend
            [38, 48, 65],   # Bob: improving trend
            [60, 70, 85],   # Charlie: improving trend
        ]

        for idx, (student, grades) in enumerate(zip(students, grades_per_student)):
            print(f"\n👤 {student.name}:")

            for attempt, grade in enumerate(grades, 1):
                sub_id = str(uuid.uuid4())

                # Create submission
                submission = Submission(
                    id=sub_id,
                    student_id=student.id,
                    assignment_id=assignment.id,
                    submitted_at=datetime.utcnow() - timedelta(days=(3-attempt)),
                    content="Test submission content",
                    marks=None,
                    grade=None,
                    feedback=""
                )
                db.add(submission)
                db.commit()
                print(f"   ├─ Submission {attempt} created")

                # Grade the submission (this triggers LES snapshot auto-save)
                submission.marks = grade
                submission.grade = "A" if grade >= 70 else "B" if grade >= 55 else "C"
                submission.feedback = f"Good work! Score: {grade}/100"
                db.add(submission)

                # Manually create LES snapshot since auto-trigger might not work in seed
                les_snapshot = LESSnapshot(
                    id=str(uuid.uuid4()),
                    student_id=student.id,
                    subject_id=subject.id,
                    submission_id=sub_id,
                    pre_score=grades[attempt-2] if attempt > 1 else 40,
                    post_score=float(grade),
                    time_invested=1.0,
                    les=float(grade),  # Simplified: LES ≈ score
                    attendance=80.0 + (attempt * 5),
                    assignment_scores=float(grade),
                    internal_assessment=70.0,
                    lab_performance=float(grade) * 0.9,
                    study_hours=2.0 + attempt,
                    concept_mastery=float(grade) * 0.85,
                    risk_level="Low" if grade >= 70 else "Moderate" if grade >= 50 else "High",
                    snapshot_type="test"
                )
                db.add(les_snapshot)
                db.commit()
                print(f"   ├─ Grade: {grade}/100 ({submission.grade})")
                print(f"   └─ LES snapshot saved")

        # ─── Create intervention logs ────────────────────────────────────
        print("\n📋 Creating intervention logs...\n")

        for idx, student in enumerate(students):
            intervention = InterventionLog(
                id=str(uuid.uuid4()),
                student_id=student.id,
                subject_id=subject.id,
                les_at_intervention=45.0 + (idx * 10),
                risk_at_intervention="High" if idx == 0 else "Moderate",
                weak_concepts=json.dumps(["Sorting", "Recursion"]),
                advisory_plan=f"Focus on fundamentals. Practice 2 hours daily. Review sorting algorithms.",
                followed_up=True,  # Mark as followed up since we have submissions
                followup_les=72.0 + (idx * 8),
                improvement_pct=(27.0 + (idx * 8)) / (45.0 + (idx * 10)) * 100,
                created_at=datetime.utcnow() - timedelta(days=3)
            )
            db.add(intervention)
            db.commit()
            print(f"✓ Intervention logged for {student.name}")

        print("\n" + "="*60)
        print("✅ Test data seeding complete!")
        print("="*60)
        print(f"\n📊 Summary:")
        print(f"   • {len(students)} test students created")
        print(f"   • 1 test assignment created")
        print(f"   • {len(students) * 3} submissions created with grades")
        print(f"   • {len(students) * 3} LES snapshots created")
        print(f"   • {len(students)} intervention logs created")
        print(f"\n🌐 Open http://localhost:8080/les-analytics to view the data!")
        print(f"\nLogin as teacher:")
        print(f"   Email: teacher@academiq.com")
        print(f"   Password: teacher123")
        print()

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_les_data()
