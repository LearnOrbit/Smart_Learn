"""Prompts + JSON schema for the Question & Answer tab.

The schema returns a top-level object with a `questions` array; one
JSON-schema-strict call produces the whole batch, which is cheaper
than N round-trips for batches of up to 20.
"""
from __future__ import annotations

from typing import Optional, Tuple

# Match the Bloom taxonomy levels the existing UI surfaces. Keep the
# enum tight so the model can't drift to synonyms.
BLOOM_LEVELS = ("Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create")
DIFFICULTY_LEVELS = ("easy", "medium", "hard")
SOURCE_TYPES = ("topic", "syllabus", "document")


# ---- JSON schema -----------------------------------------------------------

# `required` lists every property; `additionalProperties: false` makes
# the model fail loudly if it tries to add e.g. an `options` key to a
# Q&A item. The route layer parses the result with Pydantic, which
# would reject any drift too — defense in depth.
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "questions": {
            "type": "array",
            "minItems": 1,
            "items": {
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
            },
        }
    },
    "required": ["questions"],
}


# ---- prompt builders -------------------------------------------------------


def _system_prompt(*, source_grounded: bool) -> str:
    base = (
        "You are an expert university-level question setter. "
        "You write clear, unambiguous academic questions with concise, "
        "factually correct model answers. "
        "You never invent facts, statistics, or references. "
        "If a topic is ambiguous, you pick the most common academic "
        "interpretation. You always return JSON that matches the "
        "provided schema exactly."
    )
    if source_grounded:
        base += (
            " When SOURCE TEXT is provided, you MUST ground every "
            "question and answer in that text. Do not introduce facts "
            "that are not in the source. If the source is insufficient, "
            "say so in the answer rather than guessing."
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
        # 12k chars is comfortably below gpt-4o-mini's context but
        # generous for a typical lecture note.
        snippet = source_text.strip()[:12000]
        source_block = (
            f"\n\nSOURCE TEXT ({source_type}; use only this material):\n"
            f"\"\"\"\n{snippet}\n\"\"\""
        )
    return (
        f"Generate {count} question-and-answer pairs.\n"
        f"Topic: {topic.strip()}\n"
        f"{co_line}\n"
        f"Target difficulty: {difficulty}\n"
        f"Each answer should be worth exactly {marks} marks.\n"
        f"Vary the Bloom levels across the batch so the set covers "
        f"Remember through Apply at minimum."
        f"{source_block}\n\n"
        f"Return JSON of the form {{\"questions\": [...]}} where each "
        f"item matches the schema."
    )


def build_messages(
    *,
    topic: str,
    co_code: str = "CO1",
    co_description: str = "",
    difficulty: str = "medium",
    marks: int = 5,
    count: int = 5,
    source_type: str = "topic",
    source_text: Optional[str] = None,
) -> Tuple[str, str]:
    if not topic or not topic.strip():
        # Caller is expected to validate, but defense in depth.
        raise ValueError("topic is required")
    if difficulty not in DIFFICULTY_LEVELS:
        raise ValueError(f"difficulty must be one of {DIFFICULTY_LEVELS}")
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"source_type must be one of {SOURCE_TYPES}")
    if source_type in ("syllabus", "document") and not (source_text and source_text.strip()):
        # If the caller said "ground in source" but gave nothing, we
        # still proceed but tell the model to flag it in the answer.
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
