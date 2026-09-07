"""MCQ generation. Mirrors `questionGenerator.py` but produces 4-option
MCQs with a single correct answer."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .aiProvider import AIProvider, AIValidationError
from .prompts import mcqPrompt
from .prompts.questionPrompt import BLOOM_LEVELS, DIFFICULTY_LEVELS, SOURCE_TYPES
from .prompts.sourceBasedPrompt import normalize_source
from .questionGenerator import (
    MAX_MARKS,
    MAX_QUESTIONS_PER_REQUEST,
    MIN_MARKS,
    MIN_QUESTIONS_PER_REQUEST,
)


class _MCQItem(BaseModel):
    question: str = Field(..., min_length=5)
    option_a: str = Field(..., min_length=1)
    option_b: str = Field(..., min_length=1)
    option_c: str = Field(..., min_length=1)
    option_d: str = Field(..., min_length=1)
    correct_answer: str
    explanation: str = Field(..., min_length=1)
    marks: int = Field(..., ge=MIN_MARKS, le=MAX_MARKS)
    difficulty: str
    bloom_level: str
    course_outcome_code: str = Field(..., min_length=1)
    source_type: str

    @field_validator("correct_answer")
    @classmethod
    def _letter(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if v not in ("A", "B", "C", "D"):
            raise ValueError("correct_answer must be one of A, B, C, D")
        return v

    @field_validator("difficulty")
    @classmethod
    def _difficulty(cls, v: str) -> str:
        if v not in DIFFICULTY_LEVELS:
            raise ValueError(f"difficulty must be one of {DIFFICULTY_LEVELS}")
        return v

    @field_validator("bloom_level")
    @classmethod
    def _bloom(cls, v: str) -> str:
        if v not in BLOOM_LEVELS:
            raise ValueError(f"bloom_level must be one of {BLOOM_LEVELS}")
        return v

    @field_validator("source_type")
    @classmethod
    def _src(cls, v: str) -> str:
        if v not in SOURCE_TYPES:
            raise ValueError(f"source_type must be one of {SOURCE_TYPES}")
        return v


class _MCQResponse(BaseModel):
    mcqs: List[_MCQItem]


def generate_mcq(
    provider: AIProvider,
    *,
    topic: str,
    co_code: str = "CO1",
    co_description: str = "",
    difficulty: str = "medium",
    marks: int = 1,
    count: int = 5,
    source_type: str = "topic",
    source_text: Optional[str] = None,
) -> List[dict]:
    if not (MIN_QUESTIONS_PER_REQUEST <= count <= MAX_QUESTIONS_PER_REQUEST):
        raise AIValidationError(
            f"Please request between {MIN_QUESTIONS_PER_REQUEST} and "
            f"{MAX_QUESTIONS_PER_REQUEST} MCQs per batch."
        )
    if not (MIN_MARKS <= marks <= MAX_MARKS):
        raise AIValidationError(
            f"Marks per MCQ must be between {MIN_MARKS} and {MAX_MARKS}."
        )

    source_type, source_text = normalize_source(
        source_type=source_type, source_text=source_text
    )

    system, user = mcqPrompt.build_messages(
        topic=topic,
        co_code=co_code,
        co_description=co_description,
        difficulty=difficulty,
        marks=marks,
        count=count,
        source_type=source_type,
        source_text=source_text,
    )

    raw = provider.generate_json(
        system,
        user,
        json_schema=mcqPrompt.SCHEMA,
        schema_name="mcq_questions",
    )

    try:
        parsed = _MCQResponse.model_validate(raw)
    except Exception as e:  # noqa: BLE001
        raise AIValidationError(
            "The AI returned an MCQ in an unexpected shape. "
            "Please try again or change the topic."
        ) from e

    items = [m.model_dump() for m in parsed.mcqs]
    if len(items) < count:
        raise AIValidationError(
            f"The AI returned {len(items)} MCQ(s) instead of the "
            f"{count} requested. Please try again."
        )
    return items[:count]
