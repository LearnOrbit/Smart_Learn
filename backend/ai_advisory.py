"""
Generative AI Advisory Layer using Claude API
"""

import anthropic
from typing import Dict, List
import os

MODEL = "claude-3-5-sonnet-20241022"

# Lazy initialization of Anthropic client
_client = None


def get_client():
    """Get or initialize the Anthropic client"""
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def generate_study_plan(
    student_name: str,
    weak_concepts: List[str],
    learning_efficiency_score: float,
    risk_level: str,
) -> str:
    """Generate personalized study plan using Claude"""

    prompt = f"""
You are an expert academic advisor. Generate a personalized study plan for a student.

Student: {student_name}
Learning Efficiency Score (LES): {learning_efficiency_score}/100
Risk Level: {risk_level.upper()}
Weak Concepts: {', '.join(weak_concepts)}

Please provide:
1. **Study Plan** - A structured weekly schedule with specific topics and time allocations
2. **Concept Reinforcement Strategy** - How to strengthen weak concepts
3. **Learning Resources** - Recommended resources and techniques
4. **Weekly Milestones** - Weekly goals to achieve

Keep the response concise and actionable. Format with clear sections using markdown.
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


def generate_concept_reinforcement(
    concept: str, current_mastery: float, student_level: str
) -> str:
    """Generate tailored concept reinforcement strategy"""

    prompt = f"""
Generate a specific reinforcement strategy for the following concept.

Concept: {concept}
Current Mastery Level: {current_mastery}%
Student Level: {student_level}

Provide:
1. **Key Points** - Most important aspects to focus on
2. **Practice Exercises** - Specific exercises to try
3. **Common Misconceptions** - What to watch out for
4. **Real-World Applications** - How this concept applies in practice

Keep it focused and practical.
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


def identify_gaps(
    student_performance: Dict, course_outcomes: List[str]
) -> Dict[str, List[str]]:
    """Identify learning gaps using Claude analysis"""

    performance_text = "\n".join(
        [f"- {k}: {v}%" for k, v in student_performance.items()]
    )
    outcomes_text = "\n".join([f"- {o}" for o in course_outcomes])

    prompt = f"""
Analyze this student's performance and identify learning gaps.

Performance Metrics:
{performance_text}

Course Outcomes:
{outcomes_text}

Identify and categorize:
1. Weak Concept Detection - Concepts needing attention
2. Low Outcome Attainment - Which learning outcomes are underattained
3. Skill Deficiency Analysis - Specific skills to develop

Respond in JSON format:
{{
  "weak_concepts": [],
  "low_outcomes": [],
  "skill_deficiencies": []
}}
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        import json

        response_text = message.content[0].text
        # Extract JSON from response
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        json_str = response_text[start:end]
        return json.loads(json_str)
    except:
        return {
            "weak_concepts": [],
            "low_outcomes": [],
            "skill_deficiencies": [],
        }


def generate_mini_project(weak_area: str, student_interests: List[str]) -> str:
    """Generate mini-project recommendation"""

    prompt = f"""
Suggest a mini-project to help a student strengthen a weak area.

Weak Area: {weak_area}
Student Interests: {', '.join(student_interests)}

Project should:
1. Be completable in 1-2 weeks
2. Combine the weak area with student interests
3. Have clear deliverables

Provide:
- Project Title
- Learning Objectives
- Step-by-step Tasks
- Expected Outcomes
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


def generate_adaptive_schedule(
    current_schedule: Dict, performance_data: Dict
) -> str:
    """Generate adaptive weekly schedule based on performance"""

    prompt = f"""
Create an adaptive weekly schedule for a student based on their performance.

Current Schedule:
{str(current_schedule)}

Performance Data:
{str(performance_data)}

Generate a modified schedule that:
1. Allocates more time to weak areas
2. Includes break periods
3. Incorporates different learning modes (theory, practice, projects)
4. Is realistic and achievable

Format as a table or structured list.
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


def generate_intervention_evaluation(
    pre_intervention_data: Dict, post_intervention_data: Dict
) -> Dict:
    """Evaluate effectiveness of intervention"""

    prompt = f"""
Evaluate the effectiveness of an educational intervention.

Before Intervention:
{str(pre_intervention_data)}

After Intervention:
{str(post_intervention_data)}

Provide:
1. **Improvement Analysis** - What improved and by how much
2. **Updated LES** - Recalculated learning efficiency score
3. **Effectiveness Rating** - Overall effectiveness of intervention
4. **Next Steps** - Recommended next actions

Respond in JSON format.
"""

    message = get_client().messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        import json

        response_text = message.content[0].text
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        json_str = response_text[start:end]
        return json.loads(json_str)
    except:
        return {"status": "evaluation_complete"}
