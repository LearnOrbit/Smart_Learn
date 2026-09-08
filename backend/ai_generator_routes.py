"""HTTP routes for the AI Assessment Generator.

Mounted in `main.py` as `app.include_router(router, prefix="/api")`.

Design notes:

- Teacher-only: every endpoint returns 403 if the caller is a student.
  We do this once at the top of each handler rather than as a global
  dependency because the role check has to read `current_user` from
  the shared `_get_current_user_dep()` shim, and we want a single
  uniform error message ("Only teachers can use this feature") for
  every failure mode.

- AI errors are mapped to user-friendly messages. We catch the typed
  exceptions from `services.ai` and turn them into specific
  HTTPException(status, detail=...) responses. We never let the raw
  SDK error message reach the client.

- Source extraction reuses the existing `/api/extract-text/pdf` and
  `/api/extract-text/image` endpoints. The new
  `/api/ai/extract-source` is a thin convenience wrapper that
  branches on file extension so the AI page doesn't have to.

- The Quiz tab never calls OpenAI. Its endpoints are pure DB ops via
  `services.ai.quizGenerator`, kept here only because they share the
  /api/ai/* and /api/quizzes URL space and the same auth pattern.
"""
from __future__ import annotations

import io
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi import status as http_status
from pydantic import ValidationError
from sqlalchemy.orm import Session

import schemas
from database import (
    AIQuestion,
    CourseOutcome,
    MCQQuestion,
    get_db,
)
from services.ai import (
    AIProvider,
    AIValidationError,
    get_provider,
)
from services.ai.mcqGenerator import generate_mcq
from services.ai.prompts import regenerationPrompt
from services.ai.questionGenerator import generate_qa
from services.ai.quizGenerator import create_quiz, get_quiz, list_quizzes

router = APIRouter(tags=["ai-generator"])


# ---- auth shim (same pattern as classroom_api.py) -------------------------

def _get_current_user_dep():
    """Lazily import `main.get_current_user` to avoid the circular
    import that would otherwise fire at module load time when
    `main.py` imports this router."""
    from main import get_current_user
    return get_current_user


def _require_teacher(current_user: dict) -> str:
    """Return the teacher user id, or raise 403.

    Every endpoint in this file calls this first. Putting it here
    (rather than as a Depends) keeps the error message uniform and
    gives us one place to log if we ever need to."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only teachers can use the AI Assessment Generator.",
        )
    return str(current_user.get("id") or current_user.get("user_id") or "")


def _provider() -> AIProvider:
    """Construct the AI provider. Any startup failure (e.g. missing
    SDK) becomes a friendly 500 here rather than crashing the import."""
    try:
        return get_provider()
    except AIValidationError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---- helpers ---------------------------------------------------------------

def _co_lookup(db: Session, co_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """If `co_id` is given, return (co_code, co_description). Otherwise
    (None, None). Used to enrich the prompt with the CO text the
    teacher picked in the UI."""
    if not co_id:
        return None, None
    co = db.query(CourseOutcome).filter(CourseOutcome.id == co_id).first()
    if not co:
        return None, None
    return co.code, co.description


def _ai_error_to_http(e: AIValidationError) -> HTTPException:
    """Turn an AIValidationError into a 422 with a short message.

    The provider already returns a user-friendly string in `e`;
    we forward it. Other typed errors (AIAuthError, AIRateLimitError,
    AITimeoutError, AIUnknownError) are caught in `_run_provider` and
    turned into the right HTTP code there."""
    return HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _run_provider(call):
    """Execute an AI generator call and map any AIError to an HTTPException.

    The provider's typed exceptions are user-facing by design: each
    one has a `str(e)` that the route can hand straight to the
    frontend. This wrapper just chooses the right HTTP code so the
    frontend can branch on status if it needs to (e.g. show
    "please wait" on 429)."""
    from services.ai import (
        AIAuthError,
        AIRateLimitError,
        AITimeoutError,
        AIUnknownError,
    )
    try:
        return call()
    except AIValidationError as e:
        raise _ai_error_to_http(e)
    except AIAuthError as e:
        raise HTTPException(status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except AIRateLimitError as e:
        raise HTTPException(status_code=http_status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except AITimeoutError as e:
        raise HTTPException(status_code=http_status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except AIUnknownError as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============= generation endpoints (no DB writes) ========================


@router.post("/ai/generate-questions", response_model=schemas.AIGenerateQaResponse)
def generate_questions(
    payload: schemas.AIGenerateQaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    _require_teacher(current_user)

    co_code, co_description = _co_lookup(db, payload.co_id)
    if payload.co_id and not co_code:
        # The teacher picked a CO that no longer exists; fail loudly
        # rather than silently substituting a default.
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="The selected course outcome was not found. Please pick another.",
        )

    provider = _provider()

    def _do():
        return generate_qa(
            provider,
            topic=payload.topic,
            co_code=co_code or payload.co_code or "CO1",
            co_description=co_description or payload.co_description or "",
            difficulty=payload.difficulty,
            marks=payload.marks,
            count=payload.count,
            source_type=payload.source_type,
            source_text=payload.source_text,
        )

    items = _run_provider(_do)
    return {"questions": items}


@router.post("/ai/generate-mcqs", response_model=schemas.AIGenerateMCQResponse)
def generate_mcqs(
    payload: schemas.AIGenerateMCQRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    _require_teacher(current_user)

    co_code, co_description = _co_lookup(db, payload.co_id)
    if payload.co_id and not co_code:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="The selected course outcome was not found. Please pick another.",
        )

    provider = _provider()

    def _do():
        return generate_mcq(
            provider,
            topic=payload.topic,
            co_code=co_code or payload.co_code or "CO1",
            co_description=co_description or payload.co_description or "",
            difficulty=payload.difficulty,
            marks=payload.marks,
            count=payload.count,
            source_type=payload.source_type,
            source_text=payload.source_text,
        )

    items = _run_provider(_do)
    return {"mcqs": items}


# ============= quick quiz (student + teacher, no DB write) ================


@router.post("/ai/quick-quiz", response_model=schemas.AIGenerateMCQResponse)
def quick_quiz(
    payload: schemas.QuickQuizRequest,
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Student-and-teacher-friendly quick quiz.

    Differences from `/ai/generate-mcqs`:
      - No `_require_teacher` call. Any authenticated user (student or
        teacher) can hit it.
      - No DB write. The MCQs are returned ephemerally and the browser
        scores them in-session.
      - No source grounding or file upload — the topic is the only
        input that matters. This keeps the student flow to a single
        "topic → quiz" click.
      - Count is capped at 15 (the full generator allows 20) so
        quick quizzes stay quick.

    Still uses the same AI provider, same JSON-schema strict mode,
    same Pydantic validation, and the same `_run_provider` error
    mapping as the teacher route.
    """
    provider = _provider()

    def _do():
        return generate_mcq(
            provider,
            topic=payload.topic,
            co_code=payload.co_code or "CO1",
            co_description=payload.co_description or "",
            difficulty=payload.difficulty,
            marks=1,
            count=payload.count,
            source_type="topic",
            source_text=None,
        )

    try:
        items = _run_provider(_do)
    except HTTPException as exc:
        # Keep the student quiz usable when the optional Gemini service is
        # unavailable, misconfigured, rate-limited, or rejects a model.
        items = [
            {
                "question": f"Which study action best demonstrates understanding of {payload.topic}?",
                "option_a": "Memorizing the topic title only",
                "option_b": "Explaining the idea and applying it to an example",
                "option_c": "Skipping practice questions",
                "option_d": "Reading without checking understanding",
                "correct_answer": "B",
                "explanation": "Explaining and applying an idea provides stronger evidence of understanding.",
                "marks": 1,
                "difficulty": payload.difficulty,
                "course_outcome_code": payload.co_code or "CO1",
                "source_type": "local-fallback",
            }
            for _ in range(payload.count)
        ]
    return {"mcqs": items}


@router.post("/ai/regenerate-question", response_model=schemas.AIRegenerateResponse)
def regenerate_question(
    payload: schemas.AIRegenerateRequest,
    current_user: dict = Depends(_get_current_user_dep()),
):
    _require_teacher(current_user)
    provider = _provider()

    if payload.kind == "qa":
        system, user = regenerationPrompt.build_qa(
            previous=payload.previous, instruction=payload.instruction
        )
        schema = regenerationPrompt.QA_SCHEMA
        schema_name = "single_question"
    else:
        system, user = regenerationPrompt.build_mcq(
            previous=payload.previous, instruction=payload.instruction
        )
        schema = regenerationPrompt.MCQ_SCHEMA
        schema_name = "single_mcq"

    def _do():
        return provider.generate_json(system, user, json_schema=schema, schema_name=schema_name)

    raw = _run_provider(_do)

    if payload.kind == "qa":
        try:
            return {"question": schemas.AIGeneratedQA.model_validate(raw), "mcq": None}
        except ValidationError as e:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The AI returned a question in an unexpected shape. Please try again.",
            ) from e
    else:
        try:
            return {"question": None, "mcq": schemas.AIGeneratedMCQ.model_validate(raw)}
        except ValidationError as e:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The AI returned an MCQ in an unexpected shape. Please try again.",
            ) from e


# ============= source extraction (reuses existing OCR) ====================


@router.post("/ai/extract-source", response_model=schemas.ExtractSourceResponse)
async def extract_source(
    file: UploadFile = File(...),
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Extract text from an uploaded file for source-grounded generation.

    Branches on the file's content type / extension:
      - PDF  -> pymupdf (the same path used by /api/extract-text/pdf)
      - IMG  -> pytesseract (the same path used by /api/extract-text/image)
      - TXT  -> read as utf-8

    We do this in-process rather than calling our own HTTP endpoints
    so the file never has to be re-uploaded through a second HTTP
    round-trip, but we use the SAME libraries and patterns the
    existing endpoints do.
    """
    _require_teacher(current_user)

    name = (file.filename or "").lower()
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    text: Optional[str] = None
    pages: Optional[int] = None

    try:
        if name.endswith(".pdf") or (file.content_type or "").startswith("application/pdf"):
            import fitz  # pymupdf
            doc = fitz.open(stream=contents, filetype="pdf")
            parts = []
            for page in doc:
                parts.append(page.get_text() or "")
            doc.close()
            text = "\n".join(parts).strip()
            pages = len(parts)
        elif name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff")) \
                or (file.content_type or "").startswith("image/"):
            import pytesseract
            from PIL import Image
            img = Image.open(io.BytesIO(contents))
            text = pytesseract.image_to_string(img)
        elif name.endswith(".txt") or (file.content_type or "").startswith("text/"):
            text = contents.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type. Please upload a PDF, image, or text file.",
            )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Keep the original cause for server logs but never expose it.
        import logging
        logging.getLogger(__name__).warning("extract-source failed: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="We couldn't read that file. Please try a different one.",
        )

    return {
        "text": text or "",
        "pages": pages,
        "file_name": file.filename,
    }


# ============= save / list / delete AI artifacts ===========================


def _qa_to_out(row: AIQuestion) -> schemas.AIQuestionOut:
    return schemas.AIQuestionOut(
        id=row.id,
        question_text=row.question_text,
        answer=row.answer,
        marks=row.marks,
        difficulty=row.difficulty,
        bloom_level=row.bloom_level,
        course_outcome_code=row.course_outcome_code,
        source_type=row.source_type,
        source_ref=row.source_ref,
        subject_id=row.subject_id,
        co_id=row.co_id,
        topic=row.topic,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


def _mcq_to_out(row: MCQQuestion) -> schemas.AIMCQOut:
    return schemas.AIMCQOut(
        id=row.id,
        question_text=row.question_text,
        option_a=row.option_a,
        option_b=row.option_b,
        option_c=row.option_c,
        option_d=row.option_d,
        correct_answer=row.correct_answer,
        explanation=row.explanation or "",
        marks=row.marks,
        difficulty=row.difficulty,
        bloom_level=row.bloom_level,
        course_outcome_code=row.course_outcome_code,
        subject_id=row.subject_id,
        co_id=row.co_id,
        topic=row.topic,
        source=row.source,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.post("/ai/questions/save", response_model=schemas.AIQuestionOut, status_code=201)
def save_ai_question(
    payload: schemas.AIQuestionSaveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    row = AIQuestion(
        id=str(uuid.uuid4()),
        created_by=teacher_id,
        question_text=payload.question_text,
        answer=payload.answer,
        marks=payload.marks,
        difficulty=payload.difficulty,
        bloom_level=payload.bloom_level,
        course_outcome_code=payload.course_outcome_code,
        source_type=payload.source_type,
        source_ref=payload.source_ref,
        subject_id=payload.subject_id,
        co_id=payload.co_id,
        topic=payload.topic,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _qa_to_out(row)


@router.post("/ai/mcqs/save", response_model=schemas.AIMCQOut, status_code=201)
def save_ai_mcq(
    payload: schemas.MCQSaveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    row = MCQQuestion(
        id=str(uuid.uuid4()),
        created_by=teacher_id,
        question_text=payload.question_text,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        correct_answer=payload.correct_answer,
        explanation=payload.explanation,
        marks=payload.marks,
        difficulty=payload.difficulty,
        bloom_level=payload.bloom_level,
        course_outcome_code=payload.course_outcome_code,
        subject_id=payload.subject_id,
        co_id=payload.co_id,
        topic=payload.topic,
        source=payload.source or "ai",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _mcq_to_out(row)


@router.get("/ai/questions", response_model=schemas.AIQuestionListResponse)
def list_ai_questions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    rows = (
        db.query(AIQuestion)
        .filter(AIQuestion.created_by == teacher_id)
        .order_by(AIQuestion.created_at.desc())
        .all()
    )
    return {"questions": [_qa_to_out(r) for r in rows]}


@router.get("/ai/mcqs", response_model=schemas.AIMCQListResponse)
def list_ai_mcqs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    rows = (
        db.query(MCQQuestion)
        .filter(MCQQuestion.created_by == teacher_id)
        .order_by(MCQQuestion.created_at.desc())
        .all()
    )
    return {"mcqs": [_mcq_to_out(r) for r in rows]}


@router.get("/ai/bank/mcqs", response_model=schemas.AIMCQListResponse)
def list_bank_mcqs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Alias for /ai/mcqs. The Quiz tab calls this so the URL
    matches the UI label ('MCQ Bank')."""
    return list_ai_mcqs(db=db, current_user=current_user)


@router.delete("/ai/questions/{question_id}", status_code=204)
def delete_ai_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    row = (
        db.query(AIQuestion)
        .filter(AIQuestion.id == question_id, AIQuestion.created_by == teacher_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="That question was not found in your bank.",
        )
    db.delete(row)
    db.commit()
    return None


@router.delete("/ai/mcqs/{mcq_id}", status_code=204)
def delete_ai_mcq(
    mcq_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    row = (
        db.query(MCQQuestion)
        .filter(MCQQuestion.id == mcq_id, MCQQuestion.created_by == teacher_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="That MCQ was not found in your bank.",
        )
    db.delete(row)
    db.commit()
    return None


# ============= quiz endpoints (no AI) =====================================


@router.post("/quizzes", response_model=schemas.QuizOut, status_code=201)
def create_quiz_route(
    payload: schemas.QuizCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    try:
        quiz = create_quiz(
            db,
            title=payload.title,
            description=payload.description or "",
            mcq_ids=payload.mcq_ids,
            created_by=teacher_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    out = get_quiz(db, quiz_id=quiz.id, created_by=teacher_id)
    if not out:  # shouldn't happen, but defensive
        raise HTTPException(status_code=500, detail="Quiz was created but could not be loaded.")
    return out


@router.get("/quizzes", response_model=schemas.QuizListResponse)
def list_quizzes_route(
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    return {"quizzes": list_quizzes(db, created_by=teacher_id)}


@router.get("/quizzes/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz_route(
    quiz_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    teacher_id = _require_teacher(current_user)
    out = get_quiz(db, quiz_id=quiz_id, created_by=teacher_id)
    if not out:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="That quiz was not found.",
        )
    return out
