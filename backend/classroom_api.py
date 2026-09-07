"""
Classroom API router — exposes the `classrooms` and `classroom_members`
tables to the frontend so a teacher can create a class and any student
can join it via the generated 6-char code.

Endpoints
---------
POST   /api/classrooms                  (teacher)   create a class
GET    /api/classrooms/lookup/{code}    (any user)  case-insensitive code → classroom
POST   /api/classrooms/{id}/join        (student)   idempotent — already-member is fine
GET    /api/classrooms/me               (any user)  teacher: classes they own; student: joined
PATCH  /api/classrooms/{id}/archive     (teacher, owner)  soft-archive
PATCH  /api/classrooms/{id}/unarchive   (teacher, owner)  un-archive
DELETE /api/classrooms/{id}             (teacher, owner)  hard delete + cascade memberships

All routes are mounted with prefix `/api` from main.py.
"""

import secrets
import string
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db, User
from database_classroom import Classroom, ClassroomMember


router = APIRouter()


# ── Code generation ────────────────────────────────────────────────────────
# 6 chars from a crockford-style alphabet — uppercase, no ambiguous chars.
_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def _generate_code(db: Session, max_attempts: int = 8) -> str:
    """Generate a unique 6-char class code. Raises 500 if it can't."""
    for _ in range(max_attempts):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not db.query(Classroom).filter(Classroom.code == code).first():
            return code
    raise HTTPException(
        status_code=500,
        detail="Could not generate a unique class code — please retry.",
    )


# ── Auth shim ──────────────────────────────────────────────────────────────
# The auth helper lives in main.py. We can't import main.py at module load
# (it would risk circular import) so we look it up via FastAPI's app module
# cache the first time a request comes in.


def _get_current_user_dep():
    from main import get_current_user  # local import to avoid cycle
    return get_current_user


# ── Schemas ────────────────────────────────────────────────────────────────


class ClassroomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    section: str = Field(default="", max_length=40)
    subject: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=500)
    bannerColor: str = Field(default="", max_length=300)
    cardColor: str = Field(default="", max_length=300)


class ClassroomOut(BaseModel):
    id: str
    code: str
    name: str
    section: str
    subject: str
    description: str
    teacherId: str
    teacherName: str
    bannerColor: str
    cardColor: str
    archived: bool
    archivedAt: Optional[str] = None
    createdAt: str
    updatedAt: str


# ── Serialisation helper ───────────────────────────────────────────────────


def _to_out(c: Classroom) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "section": c.section or "",
        "subject": c.subject or "",
        "description": c.description or "",
        "teacherId": c.teacher_id,
        "teacherName": c.teacher_name or "",
        "bannerColor": c.banner_color or "",
        "cardColor": c.card_color or "",
        "archived": bool(c.archived),
        "archivedAt": c.archived_at.isoformat() if c.archived_at else None,
        "createdAt": c.created_at.isoformat() if c.created_at else None,
        "updatedAt": c.updated_at.isoformat() if c.updated_at else None,
    }


# ── Routes ─────────────────────────────────────────────────────────────────


@router.post("/classrooms", response_model=ClassroomOut)
def create_classroom(
    body: ClassroomCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create classes.")

    code = _generate_code(db)
    classroom = Classroom(
        code=code,
        name=body.name.strip(),
        section=body.section.strip(),
        subject=body.subject.strip(),
        description=body.description.strip(),
        teacher_id=current_user["id"],
        teacher_name=current_user.get("name") or current_user.get("email") or "Teacher",
        banner_color=body.bannerColor,
        card_color=body.cardColor,
        archived=False,
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return _to_out(classroom)


@router.get("/classrooms/lookup/{code}")
def lookup_classroom_by_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Case-insensitive lookup. Returns 404 with a friendly message on miss."""
    code_upper = code.strip().upper()
    classroom = (
        db.query(Classroom)
        .filter(Classroom.code == code_upper, Classroom.archived == False)  # noqa: E712
        .first()
    )
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail=(
                "We couldn't find a class with that code. "
                "Double-check with your teacher — codes are case-insensitive, 6 characters."
            ),
        )
    return _to_out(classroom)


@router.post("/classrooms/{classroom_id}/join", response_model=ClassroomOut)
def join_classroom(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Idempotent — if the student is already a member, returns the classroom."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="This class no longer exists — ask your teacher for a new code.",
        )

    if classroom.archived:
        raise HTTPException(
            status_code=410,
            detail="This class has been archived by the teacher.",
        )

    existing = (
        db.query(ClassroomMember)
        .filter(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == current_user["id"],
        )
        .first()
    )
    if not existing:
        member = ClassroomMember(
            classroom_id=classroom_id,
            student_id=current_user["id"],
            student_name=current_user.get("name") or current_user.get("email") or "Student",
        )
        db.add(member)
        db.commit()

    return _to_out(classroom)


@router.get("/classrooms/me")
def list_my_classrooms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    """Teacher: classes they own. Student: classes they are a member of."""
    role = current_user.get("role")
    if role == "teacher":
        rows = (
            db.query(Classroom)
            .filter(Classroom.teacher_id == current_user["id"])
            .order_by(Classroom.created_at.desc())
            .all()
        )
    else:
        # Student: classes they're a member of
        member_rows = (
            db.query(ClassroomMember)
            .filter(ClassroomMember.student_id == current_user["id"])
            .all()
        )
        ids = [m.classroom_id for m in member_rows]
        rows = (
            db.query(Classroom)
            .filter(Classroom.id.in_(ids))
            .order_by(Classroom.created_at.desc())
            .all()
            if ids
            else []
        )

    return [_to_out(c) for c in rows]


def _ensure_owner(classroom: Classroom, current_user: dict):
    if classroom.teacher_id != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the class owner can perform this action.",
        )


@router.patch("/classrooms/{classroom_id}/archive", response_model=ClassroomOut)
def archive_classroom(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found.")
    _ensure_owner(classroom, current_user)
    classroom.archived = True
    classroom.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(classroom)
    return _to_out(classroom)


@router.patch("/classrooms/{classroom_id}/unarchive", response_model=ClassroomOut)
def unarchive_classroom(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found.")
    _ensure_owner(classroom, current_user)
    classroom.archived = False
    classroom.archived_at = None
    db.commit()
    db.refresh(classroom)
    return _to_out(classroom)


@router.delete("/classrooms/{classroom_id}")
def delete_classroom(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(_get_current_user_dep()),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found.")
    _ensure_owner(classroom, current_user)
    # Cascade-delete memberships explicitly (the FK has ondelete=CASCADE
    # for SQLite, but we do it in-Python too so it's portable).
    db.query(ClassroomMember).filter(
        ClassroomMember.classroom_id == classroom_id
    ).delete()
    db.delete(classroom)
    db.commit()
    return {"deleted": True, "id": classroom_id}
