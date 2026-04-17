#!/usr/bin/env python
"""Test analytics with actual student performance data"""

from student_analytics import process_student_analytics
import schemas

# Simulate the exact data from Ritesh Singh
# Student Marks: 35, Attendance: 10, Internal: 0, Lab: 0, Assignments: 0, Study: 28, Mastery: 0, Remarks: poor

request = schemas.StudentAnalyticsRequest(
    student_id='CEA49-ritesh',
    ia_data=schemas.InternalAssessmentData(
        ia1=0.0,  # internal_assessments * 0.5 = 0 * 0.5
        ia2=0.0   # internal_assessments * 0.5 = 0 * 0.5
    ),
    chapter_marks=[
        schemas.ChapterPerformance(
            chapter_name="Overall Performance",
            marks_obtained=35,
            max_marks=100
        )
    ],
    attendance_percentage=10,
    lab_performance=0,
    assignment_scores=0
)

try:
    print("🔄 Processing analytics for Ritesh Singh...")
    result = process_student_analytics(request)

    print(f"✅ Success!")
    print(f"\nPerformance Level: {result.performance_level}")
    print(f"Average IA: {result.average_ia}/20")
    print(f"Performance Score: {result.performance_score}/100")
    print(f"Overall Score: {result.overall_score}/100")
    print(f"Weak Topics: {result.weak_topics}")
    print(f"Study Hours Needed: {result.total_study_hours_needed}")
    print(f"\n📋 Recommendations ({len(result.key_recommendations)}):")
    for i, rec in enumerate(result.key_recommendations, 1):
        print(f"  {i}. {rec}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
