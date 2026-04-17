"""
Student Analytics Engine
Processes student performance data and generates insights and study plans
"""

from typing import List, Dict, Tuple
import schemas


def classify_performance(average_ia: float) -> Tuple[str, float]:
    """
    Classify performance based on average IA score.

    Classification ranges:
    - 0-10 → Poor
    - 10-15 → Average
    - 15-20 → Good
    - 20+ → Excellent

    Returns:
        Tuple of (performance_level, normalized_score_0_100)
    """
    if average_ia < 10:
        return "Poor", average_ia * 10  # Convert to 0-100 scale
    elif average_ia < 15:
        # 100-200 range, map to 0-100
        return "Average", (average_ia - 10) * 20 + 100
    elif average_ia < 20:
        # 100-200 range, map to 0-100
        return "Good", (average_ia - 15) * 20 + 100
    else:
        return "Excellent", min(100, average_ia * 5)  # Cap at 100


def analyze_chapter_performance(
    chapters: List[schemas.ChapterPerformance],
) -> Dict[str, List[str]]:
    """
    Analyze chapter-wise performance and categorize topics.

    Categories:
    - Weak: <50%
    - Moderate: 50-70%
    - Strong: >70%

    Returns:
        Dict with keys: weak_topics, moderate_topics, strong_topics
    """
    weak = []
    moderate = []
    strong = []

    for chapter in chapters:
        percentage = (chapter.marks_obtained / chapter.max_marks) * \
            100 if chapter.max_marks > 0 else 0

        if percentage < 50:
            weak.append(chapter.chapter_name)
        elif percentage < 70:
            moderate.append(chapter.chapter_name)
        else:
            strong.append(chapter.chapter_name)

    return {
        "weak_topics": weak,
        "moderate_topics": moderate,
        "strong_topics": strong
    }


def estimate_study_time(
    weak_topics: List[str],
    moderate_topics: List[str],
    strong_topics: List[str]
) -> List[schemas.TopicStudyInfo]:
    """
    Estimate study time required per topic based on performance level.

    Study time allocation:
    - Weak topics: 4-6 hours (Priority 1)
    - Moderate topics: 2-3 hours (Priority 2)
    - Strong topics: revision only, 1 hour (Priority 3)

    Returns:
        List of TopicStudyInfo with estimated hours and priority
    """
    study_info = []

    # Weak topics - highest priority
    for topic in weak_topics:
        study_info.append(
            schemas.TopicStudyInfo(
                topic_name=topic,
                performance_level="Weak",
                estimated_hours=5.0,  # Average of 4-6 hours
                priority=1
            )
        )

    # Moderate topics - medium priority
    for topic in moderate_topics:
        study_info.append(
            schemas.TopicStudyInfo(
                topic_name=topic,
                performance_level="Moderate",
                estimated_hours=2.5,  # Average of 2-3 hours
                priority=2
            )
        )

    # Strong topics - lowest priority (revision only)
    for topic in strong_topics:
        study_info.append(
            schemas.TopicStudyInfo(
                topic_name=topic,
                performance_level="Strong",
                estimated_hours=1.0,  # Revision only
                priority=3
            )
        )

    return study_info


def generate_five_day_study_plan(
    topics_study_info: List[schemas.TopicStudyInfo],
    total_available_hours: float = 15.0  # Assume ~3 hours/day for 5 days
) -> List[schemas.StudyPlan]:
    """
    Generate a structured 5-day study plan.

    Distributes topics across 5 days based on priority and balances the workload.

    Returns:
        List of daily study plans
    """
    # Sort by priority (1, 2, 3)
    sorted_topics = sorted(topics_study_info, key=lambda x: x.priority)

    # Create 5-day plan
    daily_plans = []
    topics_per_day: Dict[int, List[schemas.TopicStudyInfo]] = {
        i: [] for i in range(1, 6)}

    # Distribute topics across days, prioritizing weak topics
    day_index = 0
    for topic in sorted_topics:
        day = (day_index % 5) + 1
        topics_per_day[day].append(topic)
        day_index += 1

    # Calculate daily workload and create plans
    hours_per_day = total_available_hours / 5

    for day in range(1, 6):
        day_topics = topics_per_day[day]
        topic_names = [t.topic_name for t in day_topics]
        daily_hours = sum(t.estimated_hours for t in day_topics)

        # Balance hours across days if needed
        if daily_hours > hours_per_day * 1.5:  # If exceeds 1.5x average, reduce focus
            daily_hours = min(daily_hours, hours_per_day * 1.5)

        focus_areas = [
            f"{t.topic_name} ({t.performance_level})" for t in day_topics
        ]

        daily_plans.append(
            schemas.StudyPlan(
                day=day,
                topics=topic_names,
                daily_hours=daily_hours,
                focus_areas=focus_areas
            )
        )

    return daily_plans


def generate_recommendations(
    weak_topics: List[str],
    performance_level: str,
    attendance: float,
    total_study_hours: float = 0
) -> Tuple[List[str], List[str]]:
    """
    Generate personalized recommendations and next milestones.

    Returns:
        Tuple of (key_recommendations, next_milestones)
    """
    recommendations = []
    milestones = []

    # Performance-based recommendations
    if performance_level == "Poor":
        # Subject-specific action plan
        if weak_topics:
            topics_str = "; ".join(weak_topics[:5])  # First 5 topics
            recommendations.append(
                f"Machine Learning: Focus on {topics_str}. Target ~{total_study_hours:.0f} hrs of focused study.")
        recommendations.append(
            "Re-attempt practice questions from IA2 paper and work through solutions")
        recommendations.append(
            "Schedule daily study sessions of 1-2 hours instead of cramming")
        recommendations.append(
            "Consider peer study groups or tutoring support")
        if weak_topics:
            milestones.append(
                f"Complete {weak_topics[0]} practice exercises within 1 week")
        milestones.append("Achieve 50% in weak topics within 2 weeks")
    elif performance_level == "Average":
        if weak_topics:
            topics_str = "; ".join(weak_topics[:3])
            recommendations.append(
                f"Strengthen weak topics: {topics_str}. Target {total_study_hours * 0.7:.0f} hrs focused study")
        recommendations.append(
            "Allocate more time to conceptual understanding and hands-on practice")
        recommendations.append(
            "Review weak topics every 3 days to reinforce learning")
        if weak_topics:
            milestones.append(f"Master fundamentals of {weak_topics[0]}")
        milestones.append("Improve weak topics to 60% within 3 weeks")
    elif performance_level == "Good":
        if weak_topics:
            topics_str = "; ".join(weak_topics)
            recommendations.append(
                f"Consolidate {topics_str} through advanced problem-solving")
        recommendations.append("Move towards mastery of all topics")
        recommendations.append("Work on complex, real-world applications")
        milestones.append("Improve overall score to 80% within 1 month")
    else:  # Excellent
        recommendations.append(
            "Focus on advanced applications and research-based projects")
        recommendations.append("Help peers in understanding complex concepts")
        recommendations.append(
            "Explore additional resources for deeper theoretical insights")
        milestones.append(
            "Achieve mastery (95%+) in all topics within 2 months")

    # Attendance-based recommendations
    if attendance < 75:
        recommendations.append(
            f"Improve attendance: Current {attendance}% → Target 85%+")
    elif attendance < 85:
        recommendations.append(
            f"Maintain consistent attendance (Current: {attendance}%)")

    return recommendations, milestones


def process_student_analytics(
    request: schemas.StudentAnalyticsRequest,


) -> schemas.StudentAnalyticsResponse:
    """
    Process complete student analytics and generate structured response.

    This is the main entry point for analytics processing.
    """
    # Step 1: Calculate average IA
    average_ia = (request.ia_data.ia1 + request.ia_data.ia2) / 2

    # Step 2: Classify performance level
    performance_level, performance_score = classify_performance(average_ia)

    # Step 3: Analyze chapter-wise performance
    chapter_analysis = analyze_chapter_performance(request.chapter_marks)

    # Step 4: Estimate study time per topic
    topics_study_info = estimate_study_time(
        chapter_analysis["weak_topics"],
        chapter_analysis["moderate_topics"],
        chapter_analysis["strong_topics"]
    )

    # Step 5: Calculate total study hours needed
    total_study_hours = sum(t.estimated_hours for t in topics_study_info)

    # Step 6: Generate 5-day study plan
    five_day_plan = generate_five_day_study_plan(topics_study_info)

    # Step 7: Calculate overall score (weighted average)
    overall_score = (
        average_ia * 2.5 +  # IA out of 40 -> scale to comparable
        request.attendance_percentage * 0.1 +  # 10% weight
        request.lab_performance * 0.2 +  # 20% weight
        request.assignment_scores * 0.3  # 30% weight
    ) / (2.5 + 0.1 + 0.2 + 0.3)

    # Step 8: Generate recommendations
    recommendations, milestones = generate_recommendations(
        chapter_analysis["weak_topics"],
        performance_level,
        request.attendance_percentage,
        total_study_hours
    )

    # Compile final response
    return schemas.StudentAnalyticsResponse(
        student_id=request.student_id,
        average_ia=average_ia,
        performance_level=performance_level,
        performance_score=min(100, performance_score),  # Cap at 100
        weak_topics=chapter_analysis["weak_topics"],
        moderate_topics=chapter_analysis["moderate_topics"],
        strong_topics=chapter_analysis["strong_topics"],
        topics_study_info=topics_study_info,
        overall_score=min(100, overall_score),  # Cap at 100
        total_study_hours_needed=total_study_hours,
        attendance_percentage=request.attendance_percentage,
        five_day_study_plan=five_day_plan,
        key_recommendations=recommendations,
        next_milestones=milestones
    )
