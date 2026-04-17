#!/usr/bin/env python
"""Test student analytics functionality"""

from student_analytics import process_student_analytics
import schemas

# Test with sample data
request = schemas.StudentAnalyticsRequest(
    student_id='test123',
    ia_data=schemas.InternalAssessmentData(ia1=15, ia2=14),
    chapter_marks=[
        schemas.ChapterPerformance(
            chapter_name='Arrays', marks_obtained=30, max_marks=100),
        schemas.ChapterPerformance(
            chapter_name='Recursion', marks_obtained=35, max_marks=100),
        schemas.ChapterPerformance(
            chapter_name='Sorting', marks_obtained=60, max_marks=100),
    ],
    attendance_percentage=85,
    lab_performance=75,
    assignment_scores=80
)

try:
    result = process_student_analytics(request)
    print('✓ Analytics generated successfully')
    print(f'Average IA: {result.average_ia}')
    print(f'Performance Level: {result.performance_level}')
    print(f'Weak Topics: {result.weak_topics}')
    print(f'\nRecommendations ({len(result.key_recommendations)} total):')
    for rec in result.key_recommendations:
        print(f'  - {rec}')
    print(f'\nMilestones ({len(result.next_milestones)} total):')
    for milestone in result.next_milestones:
        print(f'  - {milestone}')
except Exception as e:
    print(f'✗ Error: {e}')
    import traceback
    traceback.print_exc()
