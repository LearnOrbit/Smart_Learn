"""
Classroom & ClassroomMember models.

These slot into the same `Base` defined in `database.py` so that
`Base.metadata.create_all` on first server start creates the tables
automatically. No changes to `database.py` are required.

Why a separate file?
  - Keeps the original `database.py` untouched (preservation rule).
  - Mirrors the `Classroom` interface already referenced by the draft
    `Classroom_routes.py` so the existing draft routes (student/assignments,
    student/announcements, classrooms/{id}/assignments, classrooms/{id}/announcements)
    start working too as soon as the new router is registered.

Schema notes:
  - Both models use UUID-string primary keys (matching the existing
    convention: `id = Column(String, default=lambda: str(uuid.uuid4()))`).
  - `code` is unique-indexed for O(log n) lookups and to allow the
    API to generate codes with a duplicate-rejection retry loop.
  - `ClassroomMember` has a unique constraint on (classroom_id, student_id)
    so `POST /join` is naturally idempotent.
"""

from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    UniqueConstraint, Boolean, Integer,
)
from sqlalchemy.sql import func
import uuid

from database import Base  # reuse the existing declarative Base


class Classroom(Base):
    """A teacher-owned class that students can join via a 6-char code."""
    __tablename__ = "classrooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # 6-char, uppercase, no ambiguous chars (0/O, 1/I). Unique-indexed.
    code = Column(String, unique=True, index=True, nullable=False)

    name = Column(String, nullable=False)
    section = Column(String, default="", nullable=False)
    subject = Column(String, default="", nullable=False)
    description = Column(Text, default="", nullable=False)

    # Owning teacher
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    teacher_name = Column(String, default="", nullable=False)

    # Visual theming
    banner_color = Column(String, default="", nullable=False)
    card_color = Column(String, default="", nullable=False)

    # Soft-archive (hidden from active list, restorable)
    archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ClassroomMember(Base):
    """Join table — a student belonging to a classroom."""
    __tablename__ = "classroom_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    classroom_id = Column(
        String,
        ForeignKey("classrooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_name = Column(String, default="", nullable=False)
    joined_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "classroom_id", "student_id", name="uq_classroom_member"
        ),
    )
