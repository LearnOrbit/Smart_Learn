#!/usr/bin/env python3
"""Test analytics endpoint directly"""
from student_analytics import process_student_analytics
from schemas import StudentAnalyticsRequest, InternalAssessmentData, ChapterPerformance
from database import SessionLocal, StudentPerformance, User
import sys
sys.path.insert(0, '.')


# Get Ritesh Singh's performance data
db = SessionLocal()
student_id = "44c2f599-8ffb-4632-b2e8-ad2afb64d9a1"
perf = db.query(StudentPerformance).filter(
    StudentPerformance.student_id == student_id).first()

if not perf:
    print(f"❌ No performance data found for {student_id}")
    db.close()
    sys.exit(1)

print(f"✅ Found performance data:")
print(
    f"   marks={perf.student_marks}, ia={perf.internal_assessments}, att={perf.attendance}")

# Build request exactly like the endpoint does
request_data = StudentAnalyticsRequest(
    student_id=student_id,
    ia_data=InternalAssessmentData(
        ia1=perf.internal_assessments * 0.5,
        ia2=perf.internal_assessments * 0.5
    ),
    chapter_marks=[
        ChapterPerformance(
            chapter_name="Overall Performance",
            marks_obtained=perf.student_marks,
            max_marks=100
        )
    ],
    attendance_percentage=perf.attendance,
    lab_performance=perf.lab_performance,
    assignment_scores=perf.assignment_scores
)

print(f"\n📤 Request data: {request_data}")

# Process analytics
try:
    response = process_student_analytics(request_data)
    response_dict = response.model_dump()
    print(f"\n✅ Analytics response generated successfully!")
    print(f"   Keys: {list(response_dict.keys())}")
    print(f"   Student ID: {response_dict.get('student_id')}")
    print(f"   Performance Level: {response_dict.get('performance_level')}")
    print(f"   Average IA: {response_dict.get('average_ia')}")
    print(f"   Weak Topics: {response_dict.get('weak_topics')}")
except Exception as e:
    print(f"\n❌ Error processing analytics: {e}")
    import traceback
    traceback.print_exc()

db.close()
