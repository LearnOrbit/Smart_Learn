"""
ADD THESE ROUTES to your existing FastAPI backend.

These make the teacher/student dashboards work correctly:
- Assignments linked to classrooms show up in both portals
- Announcements scoped per classroom
- Student sees only their joined classrooms' published work
- Teacher sees all their assignments + per-classroom view

─────────────────────────────────────────────────────────
STEP 1: Make sure your Assignment model has these fields
─────────────────────────────────────────────────────────

In your SQLAlchemy Assignment model, add if not already present:

    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=True)
    status       = Column(String, default="draft")   # "draft" | "published"

And in your POST /assignments handler, accept these from the body:

    classroom_id: Optional[UUID] = None
    status:       str = "draft"

─────────────────────────────────────────────────────────
STEP 2: Add these route handlers
─────────────────────────────────────────────────────────
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

# ─── GET /student/assignments ─────────────────────────────────────────────────
# Student dashboard calls this to populate To-Do, Upcoming, Classwork tabs.
# Returns published assignments only, for classrooms the student has joined.

@router.get("/student/assignments")
def get_student_assignments(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    memberships = db.query(ClassroomMember).filter(
        ClassroomMember.student_id == current_user.id
    ).all()
    classroom_ids = [m.classroom_id for m in memberships]

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.classroom_id.in_(classroom_ids),
            Assignment.status == "published",
        )
        .order_by(Assignment.created_at.desc())
        .all()
    )

    result = []
    for a in assignments:
        classroom = db.query(Classroom).filter(Classroom.id == a.classroom_id).first()
        submission = db.query(Submission).filter(
            Submission.assignment_id == a.id,
            Submission.student_id == current_user.id,
        ).first()

        submission_status = "pending"
        score = None
        if submission:
            submission_status = "graded" if submission.score is not None else "submitted"
            score = submission.score

        questions = db.query(Question).filter(Question.assignment_id == a.id).all()

        result.append({
            "id": str(a.id),
            "title": a.title,
            "description": a.description,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "total_marks": a.total_marks,
            "status": a.status,
            "questions_count": len(questions),
            "questions": [
                {
                    "question_text": q.question_text,
                    "marks": q.marks,
                    "difficulty": q.difficulty,
                    "co_code": q.co.code if q.co else None,
                }
                for q in questions
            ],
            "subject_code": a.subject.code if a.subject else None,
            "subject_name": a.subject.name if a.subject else None,
            "created_at": a.created_at.isoformat(),
            "classroom_id": str(a.classroom_id) if a.classroom_id else None,
            "classroom_name": classroom.name if classroom else None,
            "submission_status": submission_status,
            "score": score,
        })
    return result


# ─── GET /student/announcements ───────────────────────────────────────────────
# Returns announcements from all classrooms the student is in.

@router.get("/student/announcements")
def get_student_announcements(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    memberships = db.query(ClassroomMember).filter(
        ClassroomMember.student_id == current_user.id
    ).all()
    classroom_ids = [m.classroom_id for m in memberships]

    announcements = (
        db.query(Announcement)
        .filter(Announcement.classroom_id.in_(classroom_ids))
        .order_by(Announcement.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": str(a.id),
            "title": getattr(a, "title", ""),
            "content": a.message,
            "author_name": a.sender.name if hasattr(a, "sender") and a.sender else "Teacher",
            "created_at": a.created_at.isoformat(),
            "pinned": getattr(a, "pinned", False),
            "classroom_id": str(a.classroom_id) if a.classroom_id else None,
            "classroom_name": a.classroom.name if hasattr(a, "classroom") and a.classroom else None,
        }
        for a in announcements
    ]


# ─── GET /classrooms/{classroom_id}/assignments ───────────────────────────────
# Teacher: sees ALL (draft + published). Student: sees only published.

@router.get("/classrooms/{classroom_id}/assignments")
def get_classroom_assignments(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    is_teacher = getattr(current_user, "role", None) == "teacher"
    query = db.query(Assignment).filter(Assignment.classroom_id == classroom_id)
    if not is_teacher:
        query = query.filter(Assignment.status == "published")

    assignments = query.order_by(Assignment.created_at.desc()).all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "description": a.description,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "total_marks": a.total_marks,
            "status": a.status,
            "questions_count": db.query(Question).filter(Question.assignment_id == a.id).count(),
            "subject_code": a.subject.code if a.subject else None,
            "created_at": a.created_at.isoformat(),
            "classroom_id": str(a.classroom_id),
            "submissions_count": (
                db.query(Submission).filter(Submission.assignment_id == a.id).count()
                if is_teacher else None
            ),
        }
        for a in assignments
    ]


# ─── GET + POST /classrooms/{classroom_id}/announcements ─────────────────────

class AnnouncementCreate(BaseModel):
    message: str
    title: Optional[str] = None

@router.get("/classrooms/{classroom_id}/announcements")
def get_classroom_announcements(
    classroom_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    announcements = (
        db.query(Announcement)
        .filter(Announcement.classroom_id == classroom_id)
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(a.id),
            "title": getattr(a, "title", ""),
            "content": a.message,
            "author_name": a.sender.name if hasattr(a, "sender") and a.sender else "Teacher",
            "created_at": a.created_at.isoformat(),
            "classroom_id": str(a.classroom_id),
            "pinned": getattr(a, "pinned", False),
        }
        for a in announcements
    ]

@router.post("/classrooms/{classroom_id}/announcements")
def post_classroom_announcement(
    classroom_id: str,
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    ann = Announcement(
        classroom_id=classroom_id,
        sender_id=current_user.id,
        teacher_id=current_user.id,
        message=body.message.strip(),
        title=body.title or "",
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return {
        "id": str(ann.id),
        "content": ann.message,
        "created_at": ann.created_at.isoformat(),
    }


# ─── GET /teacher/classrooms ──────────────────────────────────────────────────
# Used by AssignmentCreator dropdown to pick which classroom to send to.

@router.get("/teacher/classrooms")
def get_teacher_classrooms(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    classrooms = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id
    ).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "code": c.code,
            "student_count": db.query(ClassroomMember).filter(
                ClassroomMember.classroom_id == c.id
            ).count(),
        }
        for c in classrooms
    ]


# ─────────────────────────────────────────────────────────
# REGISTER in main.py:
#   from .classroom_routes import router as classroom_router
#   app.include_router(classroom_router, prefix="/api")
# ─────────────────────────────────────────────────────────