from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Integer, Float, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
import os

# Use SQLite instead of PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./core_quest.db"
)

# For SQLite, we need to add check_same_thread=False
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={
                           "check_same_thread": False}, echo=False)
else:
    engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AppRole(str, enum.Enum):
    TEACHER = "teacher"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    # DB column is full_name, Python attr is name
    name = Column("full_name", String, default="")
    password_hash = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)


class ProgramOutcome(Base):
    __tablename__ = "program_outcomes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, nullable=False, index=True)
    description = Column(Text, default="")
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class CourseOutcome(Base):
    __tablename__ = "course_outcomes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, nullable=False, index=True)
    description = Column(Text, default="")
    program_outcome_id = Column(String, ForeignKey(
        "program_outcomes.id"), nullable=True)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class LearningOutcome(Base):
    __tablename__ = "learning_outcomes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, nullable=False, index=True)
    description = Column(Text, default="")
    course_outcome_id = Column(String, ForeignKey(
        "course_outcomes.id"), nullable=True)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class COPOMappingActive(Base):
    """CO–PO correlation mapping (1 = weak, 2 = medium, 3 = strong)"""
    __tablename__ = "co_po_mappings_active"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_outcome_id = Column(String, ForeignKey(
        "course_outcomes.id"), nullable=False)
    program_outcome_id = Column(String, ForeignKey(
        "program_outcomes.id"), nullable=False)
    correlation_level = Column(
        Integer, default=2, nullable=False)  # 1, 2, or 3
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('course_outcome_id',
                      'program_outcome_id', name='uq_co_po_mapping'),)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    classroom_id = Column(String, nullable=True)   # links to localStorage classroom id
    status = Column(String, default="draft")        # "draft" | "published"
    total_marks = Column(Integer, nullable=True)
    # manual | co_based | syllabus_based
    generation_method = Column(String, default="manual")
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)

    questions = relationship(
        "Question", back_populates="assignment", cascade="all, delete-orphan")


class Question(Base):
    """Individual question within an assignment"""
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String, ForeignKey(
        "assignments.id", ondelete="CASCADE"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    marks = Column(Integer, nullable=False, default=10)
    co_id = Column(String, ForeignKey("course_outcomes.id"), nullable=True)
    difficulty = Column(String, default="medium")  # easy | medium | hard
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    assignment = relationship("Assignment", back_populates="questions")


class ModelSolution(Base):
    """Teacher-uploaded model solution / rubric for an assignment"""
    __tablename__ = "model_solutions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String, ForeignKey(
        "assignments.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String, ForeignKey(
        "questions.id", ondelete="CASCADE"), nullable=True)
    solution_text = Column(Text, default="")
    rubric = Column(Text, default="")  # JSON or plain text rubric
    file_path = Column(String, nullable=True)  # uploaded PDF/image path
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class QuestionEvaluation(Base):
    """Per-question AI evaluation result for a student submission"""
    __tablename__ = "question_evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String, ForeignKey(
        "submissions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String, ForeignKey(
        "questions.id", ondelete="CASCADE"), nullable=False)
    student_answer_text = Column(Text, default="")
    ai_score = Column(Float, nullable=True)
    final_score = Column(Float, nullable=True)
    max_marks = Column(Integer, nullable=False, default=10)
    similarity_score = Column(Float, nullable=True)
    teacher_override = Column(Float, nullable=True)
    evaluation_feedback = Column(Text, default="")
    evaluated_at = Column(DateTime, server_default=func.now(), nullable=False)


class AssignmentLOMapping(Base):
    __tablename__ = "assignment_lo_mapping"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String, ForeignKey(
        "assignments.id"), nullable=False)
    learning_outcome_id = Column(String, ForeignKey(
        "learning_outcomes.id"), nullable=False)


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String, ForeignKey(
        "assignments.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    marks = Column(Integer, nullable=True)
    grade = Column(String, nullable=True)
    feedback = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    pdf_path = Column(String, nullable=True)
    extracted_text = Column(Text, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint(
        'assignment_id', 'student_id', name='uq_assignment_student'),)


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=True)
    performance_score = Column(Integer, default=0)
    engagement_level = Column(Integer, default=0)
    completion_rate = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)


class StudentPerformance(Base):
    """Stores per-student performance metrics entered by teachers."""
    __tablename__ = "student_performance"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"),
                        nullable=False, unique=True)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    student_marks = Column(Integer, default=0)
    attendance = Column(Integer, default=0)
    internal_assessments = Column(Integer, default=0)
    lab_performance = Column(Integer, default=0)
    assignment_scores = Column(Integer, default=0)
    study_hours = Column(Integer, default=0)
    concept_mastery = Column(Integer, default=0)
    teacher_remarks = Column(Text, default="")
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)


class LESSnapshot(Base):
    """
    Stores a Learning Efficiency Score snapshot for a student
    at a specific point in time. Captured after every graded submission.

    pre_score  = average score BEFORE the last advisory plan
    post_score = score on THIS submission (after intervention)
    les        = computed LES for this snapshot
    """
    __tablename__ = "les_snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"),
                        nullable=False, index=True)
    subject_id = Column(String, ForeignKey(
        "subjects.id"), nullable=True, index=True)
    submission_id = Column(String, ForeignKey("submissions.id"), nullable=True)

    pre_score = Column(Float, default=0.0)   # score before intervention
    post_score = Column(Float, default=0.0)   # score on this submission
    # study hours logged (default 1 to avoid div/0)
    time_invested = Column(Float, default=1.0)
    # (post - pre) / time_invested, clipped 0-100
    les = Column(Float, default=0.0)

    # Raw feature snapshot used for this prediction
    attendance = Column(Float, default=0.0)
    assignment_scores = Column(Float, default=0.0)
    internal_assessment = Column(Float, default=0.0)
    lab_performance = Column(Float, default=0.0)
    study_hours = Column(Float, default=0.0)
    concept_mastery = Column(Float, default=0.0)

    risk_level = Column(String, default="Moderate")  # Low / Moderate / High
    snapshot_type = Column(String, default="auto")       # auto | manual

    created_at = Column(DateTime, server_default=func.now(), index=True)


class InterventionLog(Base):
    """
    Records every time an AI advisory plan is generated for a student.
    Used to detect 'post-intervention' submissions for the feedback loop.
    """
    __tablename__ = "intervention_log"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"),
                        nullable=False, index=True)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)

    # LES snapshot at the time of intervention
    les_at_intervention = Column(Float, default=0.0)
    risk_at_intervention = Column(String, default="Moderate")

    # Weak areas flagged at the time
    weak_concepts = Column(Text, default="[]")   # JSON list of strings
    advisory_plan = Column(Text, default="")      # full plan text

    # Was this intervention followed up? (set True when post-intervention submission arrives)
    followed_up = Column(Boolean, default=False)
    followup_les = Column(Float, nullable=True)
    improvement_pct = Column(Float, nullable=True)  # % improvement in LES

    created_at = Column(DateTime, server_default=func.now(), index=True)
    followup_at = Column(DateTime, nullable=True)


class ModelVersion(Base):
    """
    Tracks each ML model retrain event.
    Allows rollback and audit of prediction quality over time.
    """
    __tablename__ = "model_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    version_number = Column(Integer, default=1)
    # random_forest | gradient_boosting | logistic
    model_type = Column(String, default="random_forest")
    # manual | auto_post_intervention
    trigger = Column(String, default="manual")

    # Training metrics
    r_squared = Column(Float, default=0.0)
    rmse = Column(Float, default=0.0)
    mae = Column(Float, default=0.0)
    training_samples = Column(Integer, default=0)
    cross_val_score = Column(Float, default=0.0)

    # File path to saved model
    model_path = Column(String, default="")

    # Who/what triggered this retrain
    triggered_by = Column(String, nullable=True)  # user_id or "system"
    notes = Column(Text, default="")

    is_active = Column(Boolean, default=True)   # currently loaded model
    created_at = Column(DateTime, server_default=func.now(), index=True)


class Announcement(Base):
    """
    Teacher announcements visible to students.
    """
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="SET NULL"),
                        nullable=True)  # Optional subject
    # e.g., "Important: Assignment 1 Due Tomorrow"
    title = Column(String, default="")
    message = Column(Text, nullable=False)  # Full announcement text
    pinned = Column(Boolean, default=False)  # Pin to top
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_id], lazy="joined")
    subject = relationship("Subject", foreign_keys=[subject_id], lazy="joined")


class PastPaperQuestion(Base):
    """
    Individual question extracted from a previous year exam paper.
    Used as reference material when generating new assignment questions.
    """
    __tablename__ = "past_paper_questions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    year = Column(String, nullable=True)          # e.g. "2022-23", "Nov 2023"
    difficulty = Column(String, nullable=True)    # easy / medium / hard (auto-detected)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


# Create all tables
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
