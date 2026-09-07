"""Quiz assembly. No AI: this is pure DB work, by design.

The Quiz tab in the UI is a "compose a quiz out of MCQs I've already
saved" workflow, not a generative one. The teacher's already-paid-for
AI calls happen on the MCQ tab; here we just snapshot the chosen
MCQs into a `Quiz` + `QuizQuestion` join so the result is stable
even if the source MCQ is later edited or deleted.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

# We import the models lazily inside the function bodies so this
# module can be imported in environments where `database` is not on
# the import path (e.g. unit tests of the AI provider).
from database import MCQQuestion, Quiz, QuizQuestion  # noqa: E402


def _to_out(q: Quiz, items: List[dict]) -> dict:
    return {
        "id": q.id,
        "title": q.title,
        "description": q.description or "",
        "created_by": q.created_by,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
        "questions": items,
    }


def create_quiz(
    db: Session,
    *,
    title: str,
    description: str = "",
    mcq_ids: List[str],
    created_by: str,
) -> Quiz:
    """Create a new quiz containing the given MCQs in order.

    Validates that every `mcq_id` exists and is owned by `created_by`
    (so a teacher can't smuggle in another teacher's MCQs). The
    positions are 1-based to match the existing `Question.question_number`
    convention used elsewhere in the app.
    """
    if not title or not title.strip():
        raise ValueError("Quiz title is required.")
    if not mcq_ids:
        raise ValueError("A quiz must include at least one MCQ.")

    # De-duplicate while preserving order.
    seen = set()
    ordered_ids: List[str] = []
    for mid in mcq_ids:
        if mid not in seen:
            seen.add(mid)
            ordered_ids.append(mid)

    rows = (
        db.query(MCQQuestion)
        .filter(MCQQuestion.id.in_(ordered_ids))
        .filter(MCQQuestion.created_by == created_by)
        .all()
    )
    found_ids = {r.id for r in rows}
    missing = [m for m in ordered_ids if m not in found_ids]
    if missing:
        # Friendly: tell the teacher which MCQs we couldn't find, but
        # don't expose internal IDs to anyone but the owner.
        raise ValueError(
            f"Some selected MCQs were not found in your bank: {', '.join(missing[:3])}"
            + ("..." if len(missing) > 3 else "")
        )

    quiz = Quiz(
        id=str(uuid.uuid4()),
        title=title.strip(),
        description=(description or "").strip(),
        created_by=created_by,
    )
    db.add(quiz)
    db.flush()  # populate quiz.id

    for position, mid in enumerate(ordered_ids, start=1):
        db.add(QuizQuestion(quiz_id=quiz.id, mcq_question_id=mid, position=position))
    db.commit()
    db.refresh(quiz)
    return quiz


def list_quizzes(db: Session, *, created_by: str) -> List[dict]:
    rows = (
        db.query(Quiz)
        .filter(Quiz.created_by == created_by)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    return [_to_out(q, _load_questions(db, q.id)) for q in rows]


def get_quiz(db: Session, *, quiz_id: str, created_by: str) -> Optional[dict]:
    q = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id)
        .filter(Quiz.created_by == created_by)
        .first()
    )
    if not q:
        return None
    return _to_out(q, _load_questions(db, q.id))


def _load_questions(db: Session, quiz_id: str) -> List[dict]:
    joins = (
        db.query(QuizQuestion, MCQQuestion)
        .join(MCQQuestion, MCQQuestion.id == QuizQuestion.mcq_question_id)
        .filter(QuizQuestion.quiz_id == quiz_id)
        .order_by(QuizQuestion.position.asc())
        .all()
    )
    items: List[dict] = []
    for join, mcq in joins:
        items.append(
            {
                "position": join.position,
                "mcq": {
                    "id": mcq.id,
                    "question": mcq.question_text,
                    "option_a": mcq.option_a,
                    "option_b": mcq.option_b,
                    "option_c": mcq.option_c,
                    "option_d": mcq.option_d,
                    "correct_answer": mcq.correct_answer,
                    "explanation": mcq.explanation,
                    "marks": mcq.marks,
                    "difficulty": mcq.difficulty,
                    "bloom_level": mcq.bloom_level,
                    "course_outcome_code": mcq.course_outcome_code,
                },
            }
        )
    return items
