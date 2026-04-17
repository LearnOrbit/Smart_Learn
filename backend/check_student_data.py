#!/usr/bin/env python
"""Check if student has performance data in database"""

from database import SessionLocal, User, StudentPerformance
import sys

db = SessionLocal()

try:
    # Find the student by name
    print("🔍 Searching for student 'Ritesh Singh'...")
    students = db.query(User).filter(User.role == "student").all()

    if not students:
        print("❌ No students found in database")
    else:
        print(f"✅ Found {len(students)} students")

        # Look for Ritesh or CEA49
        for student in students:
            if "ritesh" in student.name.lower() or "cea49" in student.email.lower():
                print(f"\n📋 Student Found:")
                print(f"  ID: {student.id}")
                print(f"  Name: {student.name}")
                print(f"  Email: {student.email}")

                # Check performance data
                perf = db.query(StudentPerformance).filter(
                    StudentPerformance.student_id == student.id
                ).first()

                if perf:
                    print(f"\n✅ Performance Data Exists:")
                    print(f"  Marks: {perf.student_marks}")
                    print(f"  Attendance: {perf.attendance}")
                    print(
                        f"  Internal Assessments: {perf.internal_assessments}")
                    print(f"  Lab: {perf.lab_performance}")
                    print(f"  Assignments: {perf.assignment_scores}")
                    print(f"  Study Hours: {perf.study_hours}")
                    print(f"  Mastery: {perf.concept_mastery}")
                else:
                    print(f"\n❌ No performance data for this student!")
                    print("   → Need to enter marks first via Analytics page")

    # Also show all students with their data
    print("\n\n📊 ALL STUDENTS:")
    for student in students:
        perf = db.query(StudentPerformance).filter(
            StudentPerformance.student_id == student.id
        ).first()
        status = "✅ Has data" if perf else "❌ No data"
        print(
            f"  {student.name:30} | {student.email:30} | {status} | ID: {student.id}")

finally:
    db.close()
