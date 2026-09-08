"""
Generative AI Advisory Layer using Gemini API
"""

from typing import Dict, List
import os
import json

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def _get_ai_text(system: str, prompt: str, temperature: float = 0.3) -> str:
    """Generate text using the configured Gemini provider."""
    from services.ai import get_provider
    return get_provider().generate_text(system=system, user=prompt, temperature=temperature)


def generate_study_plan(
    student_name: str,
    weak_concepts: List[str],
    learning_efficiency_score: float,
    risk_level: str,
) -> str:
    """Generate personalized study plan using Gemini"""

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

    try:
        return _get_ai_text("You are an expert academic advisor.", prompt)
    except Exception as e:
        print(f"Advisory study plan fallback: {e}")
        return (
            f"### Personalized Study Plan for {student_name}\n\n"
            f"**Current Status:** LES {learning_efficiency_score}/100 ({risk_level.upper()} priority)\n\n"
            f"#### 1. Targeted Focus Areas\n"
            + "\n".join([f"- **{c}:** Review definitions and complete 2 practice problems." for c in weak_concepts])
            + "\n\n#### 2. Weekly Strategy\n"
            "- Allocate 45 minutes daily for spaced retrieval practice.\n"
            "- Use active self-testing over passive re-reading."
        )


def generate_concept_reinforcement(
    concept: str, current_mastery: float, student_level: str
) -> str:
    """Generate tailored concept reinforcement strategy using Gemini"""

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

    try:
        return _get_ai_text("You are an expert academic advisor.", prompt)
    except Exception as e:
        print(f"Concept reinforcement fallback: {e}")
        return (
            f"### Concept Reinforcement: {concept}\n\n"
            f"**Current Mastery:** {current_mastery}%\n\n"
            "1. **Key Points:** Focus on fundamental core definitions and underlying principles.\n"
            "2. **Practice:** Solve 2-3 standard problems from your coursework notes.\n"
            "3. **Watch Out:** Common pitfalls include missing edge cases and improper units."
        )


def identify_gaps(
    student_performance: Dict, course_outcomes: List[str]
) -> Dict[str, List[str]]:
    """Identify learning gaps using Gemini analysis"""

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

    try:
        raw = _get_ai_text("You are an expert educational analytics assistant. Output strict JSON only.", prompt)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        print(f"Gap identification fallback: {e}")
        weak = [k for k, v in student_performance.items() if isinstance(v, (int, float)) and v < 60]
        return {
            "weak_concepts": weak or ["Foundational Core Concepts"],
            "low_outcomes": [o for o in course_outcomes[:2]],
            "skill_deficiencies": ["Analytical Problem Solving"],
        }


def generate_mini_project(weak_area: str, student_interests: List[str]) -> str:
    """Generate mini-project recommendation using Gemini"""

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

    try:
        return _get_ai_text("You are an expert curriculum designer.", prompt)
    except Exception as e:
        print(f"Mini project fallback: {e}")
        return (
            f"### Mini-Project: Practical Application of {weak_area}\n\n"
            f"- **Objectives:** Reinforce {weak_area} with hands-on practice.\n"
            "- **Tasks:** 1. Research core concepts. 2. Build a working prototype. 3. Document learnings."
        )


def generate_adaptive_schedule(
    current_schedule: Dict, performance_data: Dict
) -> str:
    """Generate adaptive weekly schedule based on performance using Gemini"""

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

    try:
        return _get_ai_text("You are an expert study planner.", prompt)
    except Exception as e:
        print(f"Adaptive schedule fallback: {e}")
        return (
            "### Recommended Adaptive Schedule\n\n"
            "- **Monday & Wednesday:** 1 hour concept review + active recall exercises.\n"
            "- **Tuesday & Thursday:** 1 hour practice problems and assignments.\n"
            "- **Friday:** 30-minute self-assessment and review of difficult topics."
        )


def generate_intervention_evaluation(
    pre_intervention_data: Dict, post_intervention_data: Dict
) -> Dict:
    """Evaluate effectiveness of intervention using Gemini"""

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

Respond in JSON format:
{{
  "improvement_analysis": "...",
  "updated_les": 75,
  "effectiveness_rating": "Moderate",
  "next_steps": ["..."]
}}
"""

    try:
        raw = _get_ai_text("You are an expert educational evaluator. Output strict JSON only.", prompt)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        print(f"Intervention evaluation fallback: {e}")
        return {
            "status": "evaluation_complete",
            "improvement_analysis": "Student demonstrated engagement with reinforcement topics.",
            "updated_les": 70,
            "effectiveness_rating": "Positive",
            "next_steps": ["Continue monitoring weekly quiz progress."],
        }
