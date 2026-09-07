"""Prompt for the "regenerate this question" action.

We pass the previous question and a free-text instruction (e.g. "make
it harder", "add a code example") and get back a single replacement
question that matches the same schema as the tab that produced it.
"""
from __future__ import annotations

import json
from typing import Tuple

from .questionPrompt import BLOOM_LEVELS, DIFFICULTY_LEVELS, SOURCE_TYPES


QA_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "question",
        "answer",
        "marks",
        "difficulty",
        "bloom_level",
        "course_outcome_code",
        "source_type",
    ],
    "properties": {
        "question": {"type": "string", "minLength": 5},
        "answer": {"type": "string", "minLength": 1},
        "marks": {"type": "integer", "minimum": 1, "maximum": 100},
        "difficulty": {"type": "string", "enum": list(DIFFICULTY_LEVELS)},
        "bloom_level": {"type": "string", "enum": list(BLOOM_LEVELS)},
        "course_outcome_code": {"type": "string", "minLength": 1},
        "source_type": {"type": "string", "enum": list(SOURCE_TYPES)},
    },
}


MCQ_SCHEMA = {
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
}


def _common_system() -> str:
    return (
        "You are an expert university-level question setter. "
        "You produce a single replacement question that is clearly "
        "different from the previous one but matches the same shape "
        "(Q&A, or 4-option MCQ). You follow the user's instruction "
        "(e.g. 'make it harder', 'add a code example') and otherwise "
        "preserve the topic, course outcome, and difficulty. You always "
        "return JSON that matches the provided schema exactly."
    )


def build_qa(*, previous: dict, instruction: str) -> Tuple[str, str]:
    system = _common_system()
    user = (
        "Replace the following question-and-answer with a new one that "
        "follows the user's instruction. The replacement should be on "
        "the same topic and tied to the same course outcome, but should "
        "not be a trivial rephrasing.\n\n"
        f"INSTRUCTION: {instruction.strip() or 'Produce a different question on the same topic.'}\n\n"
        f"PREVIOUS QUESTION:\n{json.dumps(previous, ensure_ascii=False, indent=2)}\n\n"
        "Return a single JSON object matching the schema."
    )
    return system, user


def build_mcq(*, previous: dict, instruction: str) -> Tuple[str, str]:
    system = _common_system()
    user = (
        "Replace the following multiple-choice question with a new one "
        "that follows the user's instruction. The replacement should be "
        "on the same topic, have exactly 4 options A-D, and only one "
        "correct answer.\n\n"
        f"INSTRUCTION: {instruction.strip() or 'Produce a different MCQ on the same topic.'}\n\n"
        f"PREVIOUS MCQ:\n{json.dumps(previous, ensure_ascii=False, indent=2)}\n\n"
        "Return a single JSON object matching the schema."
    )
    return system, user
