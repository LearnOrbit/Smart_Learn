"""Q&A generation.

Thin orchestrator on top of `GeminiProvider` + `questionPrompt`. Its
only jobs are:

1. Validate the caller's arguments (count, marks, source).
2. Build the (system, user) prompt.
3. Call the provider.
4. Re-validate the response with Pydantic before returning it, so
   the route layer can hand the result to the frontend without
   worrying about missing fields.

The route layer never imports this directly; it goes through
`ai_generator_routes.py` which mounts the HTTP handlers. This
module is pure (no FastAPI, no DB) so it can be unit-tested with
`MockProvider` in isolation.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .aiProvider import AIProvider, AIValidationError
from .prompts import questionPrompt
from .prompts.sourceBasedPrompt import normalize_source


# ---- input validation ------------------------------------------------------

MAX_QUESTIONS_PER_REQUEST = 20
MIN_QUESTIONS_PER_REQUEST = 1
MAX_MARKS = 100
MIN_MARKS = 1


class _QAItem(BaseModel):
    """Strict shape of a single generated Q&A item. Mirrors the JSON
    schema in `questionPrompt.SCHEMA` so any drift fails locally
    instead of at the model layer."""

    question: str = Field(..., min_length=5)
    answer: str = Field(..., min_length=1)
    marks: int = Field(..., ge=MIN_MARKS, le=MAX_MARKS)
    difficulty: str
    bloom_level: str
    course_outcome_code: str = Field(..., min_length=1)
    source_type: str

    @field_validator("difficulty")
    @classmethod
    def _difficulty_ok(cls, v: str) -> str:
        if v not in questionPrompt.DIFFICULTY_LEVELS:
            raise ValueError(f"difficulty must be one of {questionPrompt.DIFFICULTY_LEVELS}")
        return v

    @field_validator("bloom_level")
    @classmethod
    def _bloom_ok(cls, v: str) -> str:
        if v not in questionPrompt.BLOOM_LEVELS:
            raise ValueError(f"bloom_level must be one of {questionPrompt.BLOOM_LEVELS}")
        return v

    @field_validator("source_type")
    @classmethod
    def _src_ok(cls, v: str) -> str:
        if v not in questionPrompt.SOURCE_TYPES:
            raise ValueError(f"source_type must be one of {questionPrompt.SOURCE_TYPES}")
        return v


class _QAResponse(BaseModel):
    questions: List[_QAItem]


# ---- public function -------------------------------------------------------


def generate_qa(
    provider: AIProvider,
    *,
    topic: str,
    co_code: str = "CO1",
    co_description: str = "",
    difficulty: str = "medium",
    marks: int = 5,
    count: int = 5,
    source_type: str = "topic",
    source_text: Optional[str] = None,
) -> List[dict]:
    """Generate a batch of Q&A items.

    Returns a list of dicts (not Pydantic models) so the route layer
    can hand them straight to FastAPI's response model.
    """
    if not (MIN_QUESTIONS_PER_REQUEST <= count <= MAX_QUESTIONS_PER_REQUEST):
        raise AIValidationError(
            f"Please request between {MIN_QUESTIONS_PER_REQUEST} and "
            f"{MAX_QUESTIONS_PER_REQUEST} questions per batch."
        )
    if not (MIN_MARKS <= marks <= MAX_MARKS):
        raise AIValidationError(
            f"Marks per question must be between {MIN_MARKS} and {MAX_MARKS}."
        )

    source_type, source_text = normalize_source(
        source_type=source_type, source_text=source_text
    )

    system, user = questionPrompt.build_messages(
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
        json_schema=questionPrompt.SCHEMA,
        schema_name="qa_questions",
    )

    # Pydantic validates field-by-field; this is where "the model
    # returned a question with 0 marks" or "missing `answer`" gets
    # caught and turned into a friendly validation error.
    try:
        parsed = _QAResponse.model_validate(raw)
    except Exception as e:  # noqa: BLE001
        raise AIValidationError(
            "The AI returned a question in an unexpected shape. "
            "Please try again or change the topic."
        ) from e

    # The OpenAI structured-outputs `minItems` doesn't always enforce
    # the *exact* count; trim/pad to match the request so the UI
    # never shows "asked for 5, got 4" with no explanation.
    items = [q.model_dump() for q in parsed.questions]
    if len(items) < count:
        # We won't pad with junk — better to tell the caller we got
        # fewer than expected so they can retry.
        raise AIValidationError(
            f"The AI returned {len(items)} question(s) instead of the "
            f"{count} requested. Please try again."
        )
    return items[:count]
