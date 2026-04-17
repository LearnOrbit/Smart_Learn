from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum, Table, Numeric, create_engine
from sqlalchemy.orm import relationship, declarative_base
import enum

# Create separate declarative base for legacy models to avoid conflicts with database.py models
Base = declarative_base()

# User roles


class UserRoleEnum(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(20), default="student",
                  nullable=False)  # student, teacher, admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)


# Association table for Course-Student enrollment (many-to-many)
course_student_association = Table(
    'course_student_association',
    Base.metadata,
    Column('student_id', Integer, ForeignKey(
        'student.id', ondelete='CASCADE')),
    Column('course_id', Integer, ForeignKey('course.id', ondelete='CASCADE'))
)


class Student(Base):
    __tablename__ = "student"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(15), nullable=True)
    enrollment_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    courses = relationship(
        "Course", secondary=course_student_association, back_populates="students")
    submissions = relationship("Submission", back_populates="student")


class Course(Base):
    __tablename__ = "course"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    semester = Column(Integer, nullable=False)
    department = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    students = relationship(
        "Student", secondary=course_student_association, back_populates="courses")
    course_outcomes = relationship(
        "CourseOutcome", back_populates="course", cascade="all, delete-orphan")
    assessments = relationship(
        "Assessment", back_populates="course", cascade="all, delete-orphan")


class ProgramOutcome(Base):
    __tablename__ = "program_outcome"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    version = Column(String(20), default="1.0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    co_po_mappings = relationship(
        "COPOMapping", back_populates="program_outcome", cascade="all, delete-orphan")


class CourseOutcome(Base):
    __tablename__ = "course_outcome"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey(
        'course.id', ondelete='CASCADE'), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    # Remember, Understand, Apply, Analyze, Evaluate, Create
    bloom_level = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="course_outcomes")
    co_po_mappings = relationship(
        "COPOMapping", back_populates="course_outcome", cascade="all, delete-orphan")


class GradingStatusEnum(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class CorrelationLevelEnum(str, enum.Enum):
    WEAK = "weak"
    MEDIUM = "medium"
    STRONG = "strong"


class COPOMapping(Base):
    __tablename__ = "co_po_mapping"

    id = Column(Integer, primary_key=True, index=True)
    course_outcome_id = Column(Integer, ForeignKey(
        'course_outcome.id', ondelete='CASCADE'), nullable=False)
    program_outcome_id = Column(Integer, ForeignKey(
        'program_outcome.id', ondelete='CASCADE'), nullable=False)
    correlation_level = Column(
        Enum(CorrelationLevelEnum), default=CorrelationLevelEnum.MEDIUM, nullable=False)
    correlation_value = Column(Numeric(3, 2), nullable=True)  # 0.00 to 1.00
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    course_outcome = relationship(
        "CourseOutcome", back_populates="co_po_mappings")
    program_outcome = relationship(
        "ProgramOutcome", back_populates="co_po_mappings")


class AssessmentTypeEnum(str, enum.Enum):
    MCQ = "mcq"
    CODING = "coding"
    DESCRIPTIVE = "descriptive"
    PRACTICAL = "practical"


class Assessment(Base):
    __tablename__ = "assessment"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey(
        'course.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assessment_type = Column(Enum(AssessmentTypeEnum), nullable=False)
    total_marks = Column(Numeric(5, 2), nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="assessments")
    submissions = relationship(
        "Submission", back_populates="assessment", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submission"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey(
        'assessment.id', ondelete='CASCADE'), nullable=False)
    student_id = Column(Integer, ForeignKey(
        'student.id', ondelete='CASCADE'), nullable=False)
    content = Column(Text, nullable=False)  # Answer/submission content
    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    assessment = relationship("Assessment", back_populates="submissions")
    student = relationship("Student", back_populates="submissions")
    result = relationship("Result", back_populates="submission",
                          uselist=False, cascade="all, delete-orphan")


class Result(Base):
    __tablename__ = "result"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey(
        'submission.id', ondelete='CASCADE'), nullable=False, unique=True)
    marks_obtained = Column(Numeric(5, 2), nullable=False)
    feedback = Column(Text, nullable=True)
    grading_status = Column(Enum(GradingStatusEnum),
                            default=GradingStatusEnum.PENDING, nullable=False)
    evaluated_by = Column(String(255), nullable=True)  # Teacher/System ID
    evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    submission = relationship("Submission", back_populates="result")
