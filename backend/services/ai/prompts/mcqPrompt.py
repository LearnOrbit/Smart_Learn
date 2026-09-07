"""Prompts + JSON schema for the MCQ tab.

The schema enforces exactly 4 options (A, B, C, D) and a `correct_answer`
that is one of those letters — the same constraint the UI enforces
client-side. We repeat it in the schema so the model is also told.
"""
from __future__ import annotations

from typing import Optional, Tuple

from .questionPrompt import BLOOM_LEVELS, DIFFICULTY_LEVELS, SOURCE_TYPES


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "mcqs": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "question",
                    "option_a",
                    "option_b",
                    "option_c",
                    "option_d",
                    "correct_answer",
                    "explanation",
                    "marks",
                    "difficulty",
                    "bloom_level",
                    "course_outcome_code",
                    "source_type",
                ],
                "properties": {
                    "question": {"type": "string", "minLength": 5},
                    "option_a": {"type": "string", "minLength": 1},
                    "option_b": {"type": "string", "minLength": 1},
                    "option_c": {"type": "string", "minLength": 1},
                    "option_d": {"type": "string", "minLength": 1},
                    "correct_answer": {"type": "string", "enum": ["A", "B", "C", "D"]},
                    "explanation": {"type": "string", "minLength": 1},
                    "marks": {"type": "integer", "minimum": 1, "maximum": 100},
                    "difficulty": {"type": "string", "enum": list(DIFFICULTY_LEVELS)},
                    "bloom_level": {"type": "string", "enum": list(BLOOM_LEVELS)},
                    "course_outcome_code": {"type": "string", "minLength": 1},
                    "source_type": {"type": "string", "enum": list(SOURCE_TYPES)},
                },
            },
        }
    },
    "required": ["mcqs"],
}


def _system_prompt(*, source_grounded: bool) -> str:
    base = (
        "You are an expert university-level MCQ author. "
        "You write four-option multiple-choice questions where exactly "
        "one option is unambiguously correct. The three distractors "
        "must be plausible to a student who hasn't mastered the topic, "
        "but never silly or obviously wrong. You never repeat the same "
        "option text across questions. Your explanations briefly justify "
        "the correct answer. You always return JSON that matches the "
        "provided schema exactly."
    )
    if source_grounded:
        base += (
            " When SOURCE TEXT is provided, you MUST base every question "
            "and option on that text. Do not introduce facts that are not "
            "in the source."
        )
    return base


def _user_prompt(
    *,
    topic: str,
    co_code: str,
    co_description: str,
    difficulty: str,
    marks: int,
    count: int,
    source_type: str,
    source_text: Optional[str],
) -> str:
    co_line = f"Course outcome ({co_code}): {co_description}".strip()
    source_block = ""
    if source_text:
        snippet = source_text.strip()[:12000]
        source_block = (
            f"\n\nSOURCE TEXT ({source_type}; use only this material):\n"
            f"\"\"\"\n{snippet}\n\"\"\""
        )
    return (
        f"Generate {count} multiple-choice questions.\n"
        f"Topic: {topic.strip()}\n"
        f"{co_line}\n"
        f"Target difficulty: {difficulty}\n"
        f"Each MCQ is worth {marks} mark(s). Each must have exactly 4 "
        f"options labelled A, B, C, D and exactly one correct answer.\n"
        f"Vary the Bloom levels across the batch."
        f"{source_block}\n\n"
        f"Return JSON of the form {{\"mcqs\": [...]}} where each item "
        f"matches the schema."
    )


def build_messages(
    *,
    topic: str,
    co_code: str = "CO1",
    co_description: str = "",
    difficulty: str = "medium",
    marks: int = 1,
    count: int = 5,
    source_type: str = "topic",
    source_text: Optional[str] = None,
) -> Tuple[str, str]:
    if not topic or not topic.strip():
        raise ValueError("topic is required")
    if difficulty not in DIFFICULTY_LEVELS:
        raise ValueError(f"difficulty must be one of {DIFFICULTY_LEVELS}")
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"source_type must be one of {SOURCE_TYPES}")
    if source_type in ("syllabus", "document") and not (source_text and source_text.strip()):
        source_text = source_text or "(no source text provided — answer based on the topic alone)"
    return (
        _system_prompt(source_grounded=bool(source_text)),
        _user_prompt(
            topic=topic,
            co_code=co_code or "CO1",
            co_description=co_description or "",
            difficulty=difficulty,
            marks=marks,
            count=count,
            source_type=source_type,
            source_text=source_text,
        ),
    )
