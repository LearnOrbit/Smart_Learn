#!/usr/bin/env python
"""Test the analytics endpoint directly with known student ID"""

from database import SessionLocal, User, StudentPerformance
from student_analytics import process_student_analytics
import schemas

db = SessionLocal()

try:
    # Use the actual student ID from database
    student_id = "44c2f599-8ffb-4632-b2e8-ad2afb64d9a1"

    # Get performance data
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student_id
    ).first()

    if not perf:
        print("❌ No performance data found")
    else:
        print(f"✅ Found performance data for student {student_id}")
        print(f"   Marks: {perf.student_marks}")
        print(f"   Attendance: {perf.attendance}")
        print(f"   Internal: {perf.internal_assessments}")

        # Create analytics request
        request_data = schemas.StudentAnalyticsRequest(
            student_id=student_id,
            ia_data=schemas.InternalAssessmentData(
                ia1=perf.internal_assessments * 0.5,
                ia2=perf.internal_assessments * 0.5
            ),
            chapter_marks=[
                schemas.ChapterPerformance(
                    chapter_name="Overall Performance",
                    marks_obtained=perf.student_marks,
                    max_marks=100
                )
            ],
            attendance_percentage=perf.attendance,
            lab_performance=perf.lab_performance,
            assignment_scores=perf.assignment_scores
        )

        # Process
        print("\n🔄 Processing analytics...")
        response = process_student_analytics(request_data)

        # Convert to dict
        response_dict = response.model_dump()

        print("\n✅ Analytics Generated Successfully!")
        print(f"   Performance Level: {response.performance_level}")
        print(f"   Average IA: {response.average_ia}")
        print(f"   Overall Score: {response.overall_score:.1f}/100")
        print(f"   Weak Topics: {response.weak_topics}")
        print(f"   Recommendations: {len(response.key_recommendations)}")

        # Check JSON serialization
        import json
        try:
            json_str = json.dumps(response_dict)
            print(f"\n✅ Response is JSON serializable ({len(json_str)} bytes)")
        except Exception as e:
            print(f"\n❌ JSON serialization failed: {e}")

finally:
    db.close()
