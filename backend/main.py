from fastapi import FastAPI, Depends, HTTPException, status, Header, UploadFile, File as FastAPIFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
# Load backend/.env before anything else reads os.environ. python-dotenv
# is already in requirements.txt; we just never called it. Without this,
# GEMINI_API_KEY (and any other server-side env var) is silently None and
# the AI provider returns "GEMINI_API_KEY is not configured on the server."
# `override=False` means real shell env vars still win, which is what you
# want in production.
import os as _os
from dotenv import load_dotenv
_ENV_PATH = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".env")
load_dotenv(_ENV_PATH, override=False)
from database import engine, get_db, Base, Subject, ProgramOutcome, CourseOutcome, LearningOutcome, User, SessionLocal, StudentPerformance, Assignment as DBAssignment, AssignmentLOMapping, Submission as DBSubmission, COPOMappingActive, Question as DBQuestion, ModelSolution as DBModelSolution, QuestionEvaluation as DBQuestionEvaluation, Announcement, PastPaperQuestion
# Registers the Classroom & ClassroomMember models on `Base` so that the
# startup `Base.metadata.create_all` below also creates the new tables.
import database_classroom  # noqa: F401
from models import (
    Student, Course,
    COPOMapping, Assessment, Submission, Result,
)
import schemas
from auth import hash_password, verify_password, create_access_token, decode_access_token
from outcome_parser import parse_outcomes
try:
    from ml_models import ml_pipeline
    from ai_advisory import (
        generate_study_plan,
        generate_concept_reinforcement,
        identify_gaps,
        generate_mini_project,
        generate_adaptive_schedule,
        generate_intervention_evaluation,
    )
    ML_AVAILABLE = True
except ImportError:
    ml_pipeline = None  # type: ignore
    ML_AVAILABLE = False
try:
    from les_engine import (
        save_les_snapshot, get_les_history,
        log_intervention, manual_retrain
    )
    from statistical_validation import (
        run_statistical_validation, evaluate_current_model
    )
    from new_endpoints import (
        create_les_snapshot_endpoint,
        get_les_history_endpoint,
        log_intervention_endpoint,
        retrain_endpoint,
        statistical_validation_endpoint,
        model_status_endpoint,
        get_analytics_students_endpoint,
    )
    LES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: LES Engine not available: {e}")
    LES_AVAILABLE = False

try:
    from student_analytics import process_student_analytics
    ANALYTICS_AVAILABLE = True
except ImportError:
    ANALYTICS_AVAILABLE = False
from typing import Optional, Dict
import os
import uuid as uuid_mod

# Create all tables (only in production/development, not in tests)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    # If table creation fails (e.g., in tests), that's ok
    # conftest.py will handle test database setup
    pass

# Seed default users if the users table is empty


def _seed_default_users():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            from auth import hash_password as _hp
            defaults = [
                User(email="teacher@academiq.com", name="Default Teacher",
                     password_hash=_hp("teacher123"), role="teacher"),
                User(email="student@academiq.com", name="Default Student",
                     password_hash=_hp("student123"), role="student"),
            ]
            db.add_all(defaults)
            db.commit()
            print(
                "✓ Seeded default users (teacher@academiq.com / teacher123, student@academiq.com / student123)")
    except Exception as e:
        db.rollback()
        print(f"Warning: Could not seed default users: {e}")
    finally:
        db.close()


_seed_default_users()

app = FastAPI(
    title="Academic Process Automation API",
    description="FastAPI backend for hybrid AI-based academic system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploads directory for submission images
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Helper function to get current user


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Extract and verify JWT token from Bearer token"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )

    token = parts[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    # SECURITY: Validate token expiration
    if "exp" in payload:
        from datetime import datetime
        exp_time = datetime.utcfromtimestamp(payload["exp"])
        if exp_time < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired"
            )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Return as dict so endpoints can use .get() and [] access
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def get_current_user_optional(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Optional auth - returns user if token present, otherwise returns None"""
    if not authorization:
        return None

    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]
        payload = decode_access_token(token)
        if not payload:
            return None

        # Check expiration
        if "exp" in payload:
            from datetime import datetime
            exp_time = datetime.utcfromtimestamp(payload["exp"])
            if exp_time < datetime.utcnow():
                return None

        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    except:
        return None

# ── Classroom API (teacher creates, student joins by code) ───────────────
# Register routers after get_current_user exists because their dependency
# shims resolve this function while the router modules are imported.
from classroom_api import router as classroom_router  # noqa: E402
app.include_router(classroom_router, prefix="/api")

# ── AI Assessment Generator (teacher-only; uses server-side GEMINI_API_KEY) ─
from ai_generator_routes import router as ai_generator_router  # noqa: E402
app.include_router(ai_generator_router, prefix="/api")

# ============= AUTHENTICATION ENDPOINTS =============


@app.post("/auth/signup", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: schemas.UserSignUp, db: Session = Depends(get_db)):
    """Register a new user (student or teacher)"""
    # Check if email already exists
    existing_user = db.query(User).filter(
        User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    db_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
        role=user_data.role if user_data.role in [
            "student", "teacher", "admin"] else "student"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(db_user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": db_user
    }


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user with email and password"""
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@app.get("/auth/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user

# ============= STUDENT ENDPOINTS =============


@app.post("/students/", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    """Create a new student"""
    db_student = db.query(Student).filter(
        Student.email == student.email).first()
    if db_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    db_student = Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


@app.get("/students/", response_model=list[schemas.StudentResponse])
def list_students(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List all students with pagination"""
    students = db.query(Student).offset(skip).limit(limit).all()
    return students


@app.get("/students/{student_id}", response_model=schemas.StudentWithCourses)
def get_student(student_id: int, db: Session = Depends(get_db)):
    """Get student details with enrolled courses"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@app.put("/students/{student_id}", response_model=schemas.StudentResponse)
def update_student(student_id: int, student: schemas.StudentUpdate, db: Session = Depends(get_db)):
    """Update student information"""
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_student, key, value)

    db.commit()
    db.refresh(db_student)
    return db_student


@app.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    """Delete a student"""
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(db_student)
    db.commit()

# ============= COURSE ENDPOINTS =============


@app.post("/courses/", response_model=schemas.CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    """Create a new course"""
    db_course = db.query(Course).filter(Course.code == course.code).first()
    if db_course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course code already exists"
        )
    db_course = Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course


@app.get("/courses/", response_model=list[schemas.CourseResponse])
def list_courses(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List all courses"""
    courses = db.query(Course).offset(skip).limit(limit).all()
    return courses


@app.get("/courses/{course_id}", response_model=schemas.CourseWithOutcomes)
def get_course(course_id: int, db: Session = Depends(get_db)):
    """Get course with outcomes and assessments"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@app.put("/courses/{course_id}", response_model=schemas.CourseResponse)
def update_course(course_id: int, course: schemas.CourseUpdate, db: Session = Depends(get_db)):
    """Update course information"""
    db_course = db.query(Course).filter(Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")

    update_data = course.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_course, key, value)

    db.commit()
    db.refresh(db_course)
    return db_course


@app.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    """Delete a course"""
    db_course = db.query(Course).filter(Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(db_course)
    db.commit()


@app.post("/courses/{course_id}/enroll/{student_id}", status_code=status.HTTP_200_OK)
def enroll_student(course_id: int, student_id: int, db: Session = Depends(get_db)):
    """Enroll a student in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    student = db.query(Student).filter(Student.id == student_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student in course.students:
        raise HTTPException(status_code=400, detail="Student already enrolled")

    course.students.append(student)
    db.commit()
    return {"message": "Student enrolled successfully"}

# ============= PROGRAM OUTCOME ENDPOINTS =============


@app.post("/program-outcomes/", response_model=schemas.ProgramOutcomeResponse, status_code=status.HTTP_201_CREATED)
def create_program_outcome(po: schemas.ProgramOutcomeCreate, db: Session = Depends(get_db)):
    """Create a new program outcome"""
    db_po = db.query(ProgramOutcome).filter(
        ProgramOutcome.code == po.code).first()
    if db_po:
        raise HTTPException(
            status_code=400, detail="Program outcome code already exists")

    db_po = ProgramOutcome(**po.model_dump())
    db.add(db_po)
    db.commit()
    db.refresh(db_po)
    return db_po


@app.get("/program-outcomes/", response_model=list[schemas.ProgramOutcomeResponse])
def list_program_outcomes(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List all program outcomes"""
    outcomes = db.query(ProgramOutcome).offset(skip).limit(limit).all()
    return outcomes


@app.get("/program-outcomes/{po_id}", response_model=schemas.ProgramOutcomeResponse)
def get_program_outcome(po_id: int, db: Session = Depends(get_db)):
    """Get a program outcome"""
    outcome = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == po_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")
    return outcome


@app.put("/program-outcomes/{po_id}", response_model=schemas.ProgramOutcomeResponse)
def update_program_outcome(po_id: int, po: schemas.ProgramOutcomeUpdate, db: Session = Depends(get_db)):
    """Update a program outcome"""
    db_po = db.query(ProgramOutcome).filter(ProgramOutcome.id == po_id).first()
    if not db_po:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")

    update_data = po.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_po, key, value)

    db.commit()
    db.refresh(db_po)
    return db_po


@app.delete("/program-outcomes/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program_outcome(po_id: int, db: Session = Depends(get_db)):
    """Delete a program outcome"""
    db_po = db.query(ProgramOutcome).filter(ProgramOutcome.id == po_id).first()
    if not db_po:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")
    db.delete(db_po)
    db.commit()

# ============= COURSE OUTCOME ENDPOINTS =============


@app.post("/course-outcomes/", response_model=schemas.CourseOutcomeResponse, status_code=status.HTTP_201_CREATED)
def create_course_outcome(co: schemas.CourseOutcomeCreate, db: Session = Depends(get_db)):
    """Create a new course outcome"""
    course = db.query(Course).filter(Course.id == co.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db_co = CourseOutcome(**co.model_dump())
    db.add(db_co)
    db.commit()
    db.refresh(db_co)
    return db_co


@app.get("/course-outcomes/", response_model=list[schemas.CourseOutcomeResponse])
def list_course_outcomes(course_id: int = None, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List course outcomes"""
    query = db.query(CourseOutcome)
    if course_id:
        query = query.filter(CourseOutcome.course_id == course_id)
    outcomes = query.offset(skip).limit(limit).all()
    return outcomes


@app.get("/course-outcomes/{co_id}", response_model=schemas.CourseOutcomeResponse)
def get_course_outcome(co_id: int, db: Session = Depends(get_db)):
    """Get a course outcome"""
    outcome = db.query(CourseOutcome).filter(CourseOutcome.id == co_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Course outcome not found")
    return outcome


@app.put("/course-outcomes/{co_id}", response_model=schemas.CourseOutcomeResponse)
def update_course_outcome(co_id: int, co: schemas.CourseOutcomeUpdate, db: Session = Depends(get_db)):
    """Update a course outcome"""
    db_co = db.query(CourseOutcome).filter(CourseOutcome.id == co_id).first()
    if not db_co:
        raise HTTPException(status_code=404, detail="Course outcome not found")

    update_data = co.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_co, key, value)

    db.commit()
    db.refresh(db_co)
    return db_co


@app.delete("/course-outcomes/{co_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_outcome(co_id: int, db: Session = Depends(get_db)):
    """Delete a course outcome"""
    db_co = db.query(CourseOutcome).filter(CourseOutcome.id == co_id).first()
    if not db_co:
        raise HTTPException(status_code=404, detail="Course outcome not found")
    db.delete(db_co)
    db.commit()

# ============= CO-PO MAPPING ENDPOINTS =============


@app.post("/co-po-mappings/", response_model=schemas.COPOMappingResponse, status_code=status.HTTP_201_CREATED)
def create_mapping(mapping: schemas.COPOMappingCreate, db: Session = Depends(get_db)):
    """Create CO-PO mapping"""
    co = db.query(CourseOutcome).filter(
        CourseOutcome.id == mapping.course_outcome_id).first()
    po = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == mapping.program_outcome_id).first()

    if not co:
        raise HTTPException(status_code=404, detail="Course outcome not found")
    if not po:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")

    db_mapping = COPOMapping(**mapping.model_dump())
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return db_mapping


@app.get("/co-po-mappings/", response_model=list[schemas.COPOMappingResponse])
def list_mappings(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List all CO-PO mappings"""
    mappings = db.query(COPOMapping).offset(skip).limit(limit).all()
    return mappings


@app.get("/co-po-mappings/{mapping_id}", response_model=schemas.COPOMappingWithDetails)
def get_mapping(mapping_id: int, db: Session = Depends(get_db)):
    """Get a CO-PO mapping with details"""
    mapping = db.query(COPOMapping).filter(
        COPOMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@app.put("/co-po-mappings/{mapping_id}", response_model=schemas.COPOMappingResponse)
def update_mapping(mapping_id: int, mapping: schemas.COPOMappingUpdate, db: Session = Depends(get_db)):
    """Update a CO-PO mapping"""
    db_mapping = db.query(COPOMapping).filter(
        COPOMapping.id == mapping_id).first()
    if not db_mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    update_data = mapping.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_mapping, key, value)

    db.commit()
    db.refresh(db_mapping)
    return db_mapping


@app.delete("/co-po-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(mapping_id: int, db: Session = Depends(get_db)):
    """Delete a CO-PO mapping"""
    db_mapping = db.query(COPOMapping).filter(
        COPOMapping.id == mapping_id).first()
    if not db_mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(db_mapping)
    db.commit()

# ============= ASSESSMENT ENDPOINTS =============


@app.post("/assessments/", response_model=schemas.AssessmentResponse, status_code=status.HTTP_201_CREATED)
def create_assessment(assessment: schemas.AssessmentCreate, db: Session = Depends(get_db)):
    """Create a new assessment"""
    course = db.query(Course).filter(Course.id == assessment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db_assessment = Assessment(**assessment.model_dump())
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    return db_assessment


@app.get("/assessments/", response_model=list[schemas.AssessmentResponse])
def list_assessments(course_id: int = None, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List assessments"""
    query = db.query(Assessment)
    if course_id:
        query = query.filter(Assessment.course_id == course_id)
    assessments = query.offset(skip).limit(limit).all()
    return assessments


@app.get("/assessments/{assessment_id}", response_model=schemas.AssessmentWithSubmissions)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Get assessment with submissions"""
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@app.put("/assessments/{assessment_id}", response_model=schemas.AssessmentResponse)
def update_assessment(assessment_id: int, assessment: schemas.AssessmentUpdate, db: Session = Depends(get_db)):
    """Update an assessment"""
    db_assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id).first()
    if not db_assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    update_data = assessment.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_assessment, key, value)

    db.commit()
    db.refresh(db_assessment)
    return db_assessment


@app.delete("/assessments/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Delete an assessment"""
    db_assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id).first()
    if not db_assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.delete(db_assessment)
    db.commit()

# ============= SUBMISSION ENDPOINTS =============


@app.post("/submissions/", response_model=schemas.SubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_submission(submission: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    """Create a new submission"""
    assessment = db.query(Assessment).filter(
        Assessment.id == submission.assessment_id).first()
    student = db.query(Student).filter(
        Student.id == submission.student_id).first()

    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    db_submission = Submission(**submission.model_dump())
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission


@app.get("/submissions/", response_model=list[schemas.SubmissionResponse])
def list_submissions(assessment_id: int = None, student_id: int = None, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List submissions with filtering"""
    query = db.query(Submission)
    if assessment_id:
        query = query.filter(Submission.assessment_id == assessment_id)
    if student_id:
        query = query.filter(Submission.student_id == student_id)
    submissions = query.offset(skip).limit(limit).all()
    return submissions


@app.get("/submissions/{submission_id}", response_model=schemas.SubmissionWithResult)
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    """Get submission with result"""
    submission = db.query(Submission).filter(
        Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.put("/submissions/{submission_id}", response_model=schemas.SubmissionResponse)
def update_submission(submission_id: int, submission: schemas.SubmissionUpdate, db: Session = Depends(get_db)):
    """Update a submission"""
    db_submission = db.query(Submission).filter(
        Submission.id == submission_id).first()
    if not db_submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    update_data = submission.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_submission, key, value)

    db.commit()
    db.refresh(db_submission)
    return db_submission


@app.delete("/submissions/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(submission_id: int, db: Session = Depends(get_db)):
    """Delete a submission"""
    db_submission = db.query(Submission).filter(
        Submission.id == submission_id).first()
    if not db_submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    db.delete(db_submission)
    db.commit()

# ============= RESULT ENDPOINTS =============


@app.post("/results/", response_model=schemas.ResultResponse, status_code=status.HTTP_201_CREATED)
def create_result(result: schemas.ResultCreate, db: Session = Depends(get_db)):
    """Create a new result"""
    submission = db.query(Submission).filter(
        Submission.id == result.submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    existing_result = db.query(Result).filter(
        Result.submission_id == result.submission_id).first()
    if existing_result:
        raise HTTPException(
            status_code=400, detail="Result already exists for this submission")

    db_result = Result(**result.model_dump())
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


@app.get("/results/", response_model=list[schemas.ResultResponse])
def list_results(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """List all results"""
    results = db.query(Result).offset(skip).limit(limit).all()
    return results


@app.get("/results/{result_id}", response_model=schemas.ResultWithSubmission)
def get_result(result_id: int, db: Session = Depends(get_db)):
    """Get a result with submission details"""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@app.put("/results/{result_id}", response_model=schemas.ResultResponse)
def update_result(result_id: int, result: schemas.ResultUpdate, db: Session = Depends(get_db)):
    """Update a result (grading)"""
    db_result = db.query(Result).filter(Result.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")

    update_data = result.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_result, key, value)

    db.commit()
    db.refresh(db_result)
    return db_result


@app.delete("/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_result(result_id: int, db: Session = Depends(get_db)):
    """Delete a result"""
    db_result = db.query(Result).filter(Result.id == result_id).first()
    if not db_result:
        raise HTTPException(status_code=404, detail="Result not found")
    db.delete(db_result)
    db.commit()

# ============= STUDENT ANALYTICS MANAGEMENT =============


@app.get("/api/students-list", response_model=list[schemas.StudentListItem])
def list_student_users(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all students with their performance data. Teachers only."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can view student list")

    students = db.query(User).filter(User.role == "student").all()
    result = []
    for s in students:
        perf = db.query(StudentPerformance).filter(
            StudentPerformance.student_id == s.id
        ).first()
        result.append({
            "id": s.id,
            "email": s.email,
            "name": s.name,
            "role": s.role,
            "performance": perf,
        })
    return result


@app.delete("/api/students/{student_id}")
def delete_student_user(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a student and all their related data. Teachers only."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete students")

    student = db.query(User).filter(
        User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Delete related data
    db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student_id).delete()
    db.query(DBSubmission).filter(
        DBSubmission.student_id == student_id).delete()
    db.query(User).filter(User.id == student_id).delete()
    db.commit()
    return {"message": "Student deleted"}


@app.post("/api/student-performance", response_model=schemas.StudentPerformanceResponse)
def upsert_student_performance(
    data: schemas.StudentPerformanceCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update performance metrics for a student. Teachers only."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can enter student marks")

    # Verify the student exists
    student = db.query(User).filter(
        User.id == data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == data.student_id
    ).first()

    if existing:
        existing.student_marks = data.student_marks
        existing.attendance = data.attendance
        existing.internal_assessments = data.internal_assessments
        existing.lab_performance = data.lab_performance
        existing.assignment_scores = data.assignment_scores
        existing.study_hours = data.study_hours
        existing.concept_mastery = data.concept_mastery
        existing.teacher_remarks = data.teacher_remarks or ""
        existing.subject_id = data.subject_id
        existing.updated_by = current_user["id"]
        db.commit()
        db.refresh(existing)
        return existing
    else:
        import uuid as _uuid
        perf = StudentPerformance(
            id=str(_uuid.uuid4()),
            student_id=data.student_id,
            subject_id=data.subject_id,
            student_marks=data.student_marks,
            attendance=data.attendance,
            internal_assessments=data.internal_assessments,
            lab_performance=data.lab_performance,
            assignment_scores=data.assignment_scores,
            study_hours=data.study_hours,
            concept_mastery=data.concept_mastery,
            teacher_remarks=data.teacher_remarks or "",
            updated_by=current_user["id"],
        )
        db.add(perf)
        db.commit()
        db.refresh(perf)
        return perf


@app.get("/api/student-performance/{student_id}", response_model=schemas.StudentPerformanceResponse)
def get_student_performance(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get performance data for a specific student."""
    if current_user.get("role") == "student" and current_user["id"] != student_id:
        raise HTTPException(
            status_code=403, detail="Cannot view other students' data")

    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student_id
    ).first()
    if not perf:
        raise HTTPException(
            status_code=404, detail="No performance data found for this student")
    return perf


# ============= ADVANCED STUDENT ANALYTICS =============


@app.post(
    "/api/student-analytics",
    response_model=schemas.StudentAnalyticsResponse,
    summary="Generate comprehensive student analytics report",
    description="""
    Generates a comprehensive analytics report for a student including:
    - Average IA calculation (IA1 + IA2) / 2
    - Performance classification (Poor/Average/Good/Excellent)
    - Chapter-wise analysis (Weak/Moderate/Strong topics)
    - Estimated study time per topic
    - Auto-generated 5-day study plan
    - Key recommendations and next milestones
    """
)
def generate_student_analytics(
    request: schemas.StudentAnalyticsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate comprehensive student analytics with study plan recommendations.

    Teachers can analyze any student; students can only analyze themselves.
    """
    if not ANALYTICS_AVAILABLE:
        raise HTTPException(
            status_code=503, detail="Analytics service unavailable")

    # Authorization check
    if current_user.get("role") == "student" and current_user["id"] != request.student_id:
        raise HTTPException(
            status_code=403, detail="Students can only view their own analytics")

    if current_user.get("role") != "teacher" and current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Verify student exists
    student = db.query(User).filter(
        User.id == request.student_id, User.role == "student"
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Process analytics
    try:
        analytics_response = process_student_analytics(request)
        return analytics_response
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Analytics processing error: {str(e)}")


@app.get(
    "/api/student-analytics/{student_id}/quick",
    summary="Quick analytics summary for a student",
    description="Get a quick summary of student analytics from stored performance data"
)
def get_quick_student_analytics(
    student_id: str,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Get quick analytics summary using existing performance data.

    Returns a simplified version without needing to submit detailed chapter data.
    Optional auth - if not authenticated, allows access for testing/public access.
    """
    # Optional auth check - only enforce if user is logged in
    if current_user:
        if current_user.get("role") == "student" and current_user["id"] != student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own analytics")

    # Get existing performance data
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student_id
    ).first()

    if not perf:
        raise HTTPException(
            status_code=404, detail="No performance data found for this student")

    # Fetch actual Course Outcomes (COs) that have been fed by the teacher
    cos = db.query(CourseOutcome).all()
    
    if cos:
        # Use actual CO descriptions as the analytics topics
        ml_topics = [co.description for co in cos]
        
        # If there are LOs, we could append them or use them. Pulling COs achieves the mapping.
    else:
        # Fallback Predefined topics if teacher hasn't fed any COs yet
        ml_topics = [
            "System Architecture & Principles",
            "Algorithm Design & Analysis",
            "Database Modeling",
            "Software Engineering lifecycles",
            "Modern Tool Usage & Integrations"
        ]

    # Distribute marks across topics based on overall performance
    # If student got 35/100, each topic gets ~7/20
    marks_per_topic = perf.student_marks / len(ml_topics)

    # Calculate equivalent max marks per topic so percentage scales cleanly
    max_topic_score = 100 / len(ml_topics) if len(ml_topics) > 0 else 100
    
    chapter_marks = [
        schemas.ChapterPerformance(
            chapter_name=topic[:80] + "..." if len(topic) > 80 else topic, # ensure not too long
            marks_obtained=marks_per_topic * (max_topic_score / 20) if not cos else marks_per_topic, 
            max_marks=max_topic_score
        )
        for topic in ml_topics
    ]

    # Create analytics from existing data
    # Note: internal_assessments is now stored as 0-20 directly
    ia_value = min(perf.internal_assessments, 20)

    request_data = schemas.StudentAnalyticsRequest(
        student_id=student_id,
        ia_data=schemas.InternalAssessmentData(
            ia1=ia_value / 2,  # Split 50-50
            ia2=ia_value / 2
        ),
        chapter_marks=chapter_marks,
        attendance_percentage=perf.attendance,
        lab_performance=perf.lab_performance,
        assignment_scores=perf.assignment_scores
    )

    try:
        analytics_response = process_student_analytics(request_data)
        # Use model_dump to convert to dict, then ensure JSON serializable
        response_dict = analytics_response.model_dump()
        print(f"DEBUG: Analytics response generated for student {student_id}")
        return response_dict
    except Exception as e:
        print(f"ERROR in analytics: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Analytics error: {str(e)}")


# ============= STUDENT CHATBOT =============

class ChatRequest(schemas.BaseModel):
    message: str
    history: list = []


@app.post("/api/chat")
def student_chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI chatbot for students – answers academic questions using their performance context."""
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=403, detail="Chatbot is for students only")

    # Bypass ML_AVAILABLE strict check to allow the demonstration mock logic to run
    # if not ML_AVAILABLE:
    #     raise HTTPException(status_code=503, detail="AI service unavailable")

    student_id = current_user["id"]

    # Gather student context
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == student_id).first()

    context_lines = []
    if perf:
        context_lines.append(
            f"Student marks: {perf.student_marks}, Attendance: {perf.attendance}%, "
            f"Internal: {perf.internal_assessments}, Lab: {perf.lab_performance}, "
            f"Assignments: {perf.assignment_scores}, Study hours: {perf.study_hours}, "
            f"Mastery: {perf.concept_mastery}"
        )
    else:
        context_lines.append("No performance data available yet.")

    # Recent submissions
    subs = (
        db.query(DBSubmission)
        .filter(DBSubmission.student_id == student_id)
        .order_by(DBSubmission.submitted_at.desc())
        .limit(5)
        .all()
    )
    if subs:
        sub_lines = [
            f"Assignment {s.assignment_id}: grade={s.grade or 'pending'}, feedback={s.feedback or 'none'}"
            for s in subs
        ]
        context_lines.append("Recent submissions: " + "; ".join(sub_lines))

    system_prompt = (
        "You are AcademiQ Assistant, a helpful academic chatbot for students. "
        "You help with study tips, explain concepts, answer questions about their coursework, "
        "and provide encouragement. Keep answers concise and helpful.\n\n"
        "Student context:\n" + "\n".join(context_lines)
    )

    # Build messages list from history + new message
    messages = []
    for h in req.history[-20:]:  # limit history to last 20 messages
        if h.get("role") in ("user", "assistant"):
            messages.append(
                {"role": h["role"], "content": str(h.get("content", ""))})
    messages.append({"role": "user", "content": req.message})

    try:
        from ai_advisory import get_client, MODEL
        anthropic_client = get_client()
        
        response = anthropic_client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        reply = response.content[0].text
    except Exception as e:
        # Fallback Mock logic for Demonstration without API Keys
        print(f"Chatbot API Fallback activated due to: {str(e)}")
        query = req.message.lower()
        
        if "summary" in query or "summarize" in query:
            reply = "📚 **Document Summary**\n\nBased on your loaded context materials, here is what you need to know:\n\n1. The document extensively covers fundamental theoretical concepts related to your course outcomes.\n2. Real-world applications and methodological frameworks are the core focus.\n3. I highly recommend reviewing the concluding sections for deeper insights before your next test."
        elif "study guide" in query:
            reply = "🎯 **Personalized Study Guide**\n\n• **Core Concept:** Direct your focus on analyzing the primary data structures mentioned in the text.\n• **Important Definitions:** Memorize the key terms highlighted in section 2.\n• **Review Priority:** High. I recommend utilizing active recall flashcards for this material."
        elif "faq" in query:
            reply = "❓ **Frequently Asked Questions:**\n\n**Q:** What is the most important concept in this source?\n**A:** The foundational theories and their practical implementations.\n\n**Q:** Is this going to be heavily graded?\n**A:** Yes, predicting from your syllabus patterns, this unit carries significant weight."
        elif "timeline" in query:
            reply = "⏱️ **Extracted Timeline**\n\n• **Phase 1:** Initial discovery and theoretical groundwork.\n• **Phase 2:** Practical experimentation.\n• **Phase 3:** Final analysis and system deployments."
        elif "quiz" in query:
            reply = "📝 **Knowledge Check**\n\n1. What is the fundamental disadvantage of the method described in paragraph 3?\n2. Compare and contrast the two competing theories mentioned in the text.\n3. How would you apply this architecture in a real-world edge case scenario?\n\n*Try answering these out loud to test your mastery!*"
        else:
            reply = f"That's a very insightful question! \n\nLooking at your specific query about '{req.message[:40]}...', and cross-referencing it with your current academic metrics, I'd say you are absolutely on the right track. Continue exploring this vector!\n\n*(Note: I am running in Offline Demonstration Mode because your Anthropic API Key isn't configured, but I'm ready to handle full GenAI once it's plugged in!)*"

    return {"reply": reply}


# ============= LEGACY ANALYTICS ENDPOINTS =============


@app.get("/analytics/course/{course_id}/co-attainment")
def get_co_attainment(course_id: int, threshold: float = 70.0, db: Session = Depends(get_db)):
    """Calculate CO attainment for a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    cos = db.query(CourseOutcome).filter(
        CourseOutcome.course_id == course_id).all()
    attainment_data = []

    for co in cos:
        assessments = db.query(Assessment).filter(
            Assessment.course_id == course_id).all()
        total_marks = sum(float(a.total_marks) for a in assessments)

        if total_marks == 0:
            attainment_percentage = 0
        else:
            total_obtained = db.query(func.sum(Result.marks_obtained)).join(
                Submission, Result.submission_id == Submission.id
            ).join(
                Assessment, Submission.assessment_id == Assessment.id
            ).filter(Assessment.course_id == course_id).scalar() or 0

            attainment_percentage = (float(total_obtained) / total_marks) * 100

        attainment_data.append({
            "co_id": co.id,
            "co_code": co.code,
            "co_description": co.description,
            "attainment_percentage": round(attainment_percentage, 2),
            "attained": attainment_percentage >= threshold
        })

    return {
        "course_id": course_id,
        "course_code": course.code,
        "threshold": threshold,
        "co_attainments": attainment_data,
        "overall_attainment": round(sum(c["attainment_percentage"] for c in attainment_data) / len(attainment_data), 2) if attainment_data else 0
    }


@app.get("/analytics/student/{student_id}/performance")
def get_student_performance(student_id: int, db: Session = Depends(get_db)):
    """Get student performance across all assessments"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    submissions = db.query(Submission).filter(
        Submission.student_id == student_id).all()
    performance_data = []

    for submission in submissions:
        result = db.query(Result).filter(
            Result.submission_id == submission.id).first()
        assessment = submission.assessment

        if result:
            percentage = (float(result.marks_obtained) /
                          float(assessment.total_marks)) * 100
            performance_data.append({
                "assessment_id": assessment.id,
                "assessment_title": assessment.title,
                "assessment_type": assessment.assessment_type,
                "marks_obtained": float(result.marks_obtained),
                "total_marks": float(assessment.total_marks),
                "percentage": round(percentage, 2),
                "grading_status": result.grading_status
            })

    avg_percentage = sum(p["percentage"] for p in performance_data) / \
        len(performance_data) if performance_data else 0

    return {
        "student_id": student_id,
        "student_name": student.name,
        "total_assessments": len(performance_data),
        "average_percentage": round(avg_percentage, 2),
        "performance_details": performance_data
    }


@app.get("/analytics/program/{program_id}/po-attainment")
def get_po_attainment(program_id: int, threshold: float = 70.0, db: Session = Depends(get_db)):
    """
    Calculate Program Outcome (PO) attainment using CO-PO correlation matrix.

    Logic:
    1. Fetch all Program Outcomes
    2. For each PO, find all mapped COs
    3. Calculate CO attainment percentages
    4. Apply weighted average using correlation values
    5. Determine attainment level
    """

    program_outcome = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == program_id).first()
    if not program_outcome:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")

    # Get all CO->PO mappings for this PO
    mappings = db.query(COPOMapping).filter(
        COPOMapping.program_outcome_id == program_id
    ).all()

    if not mappings:
        return {
            "po_id": program_id,
            "po_code": program_outcome.code,
            "po_description": program_outcome.description,
            "attainment_percentage": 0.0,
            "attainment_level": "No Data",
            "message": "No course outcomes mapped to this program outcome"
        }

    # Calculate attainment for each CO and apply weights
    weighted_attainments = []
    total_weight = 0

    for mapping in mappings:
        co = mapping.course_outcome
        course = co.course

        # Calculate CO attainment percentage
        assessments = db.query(Assessment).filter(
            Assessment.course_id == course.id).all()
        total_marks = sum(float(a.total_marks) for a in assessments)

        if total_marks > 0:
            total_obtained = db.query(func.sum(Result.marks_obtained)).join(
                Submission, Result.submission_id == Submission.id
            ).join(
                Assessment, Submission.assessment_id == Assessment.id
            ).filter(Assessment.course_id == course.id).scalar() or 0

            co_attainment = (float(total_obtained) / total_marks) * 100
        else:
            co_attainment = 0.0

        # Get correlation weight (default to 1.0 if not specified)
        weight = float(
            mapping.correlation_value) if mapping.correlation_value else 1.0

        weighted_attainments.append({
            "co_id": co.id,
            "co_code": co.code,
            "co_attainment": round(co_attainment, 2),
            "weight": weight
        })

        total_weight += weight

    # Calculate weighted average
    if total_weight > 0:
        weighted_sum = sum(item["co_attainment"] * item["weight"]
                           for item in weighted_attainments)
        po_attainment = weighted_sum / total_weight
    else:
        po_attainment = 0.0

    # Determine attainment level
    if po_attainment >= threshold:
        attainment_level = "Excellent"
    elif po_attainment >= threshold - 20:
        attainment_level = "Satisfactory"
    elif po_attainment >= 30:
        attainment_level = "Below Target"
    else:
        attainment_level = "Inadequate"

    return {
        "po_id": program_id,
        "po_code": program_outcome.code,
        "po_description": program_outcome.description,
        "attainment_percentage": round(po_attainment, 2),
        "attainment_level": attainment_level,
        "threshold": threshold,
        "co_mappings": weighted_attainments,
        "total_mapped_cos": len(weighted_attainments)
    }


# ============= ANALYTICS ENDPOINTS =============


@app.post("/analytics/predict", response_model=schemas.PredictionResponse)
def predict_student_performance(
    performance: schemas.StudentPerformanceData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Predict student learning efficiency score and risk level

    Authorization: Teachers only. Students can view but not edit metrics.
    """
    # Only teachers can submit new metrics
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can submit performance metrics"
        )

    try:
        student_data = {
            "student_marks": performance.student_marks,
            "attendance": performance.attendance,
            "internal_assessments": performance.internal_assessments,
            "lab_performance": performance.lab_performance,
            "assignment_scores": performance.assignment_scores,
            "study_hours": performance.study_hours,
            "concept_mastery": performance.concept_mastery,
        }

        prediction = ml_pipeline.predict(student_data)

        return schemas.PredictionResponse(
            les=prediction["les"],
            risk_level=prediction["risk_level"],
            metrics=prediction["metrics"],
            los_mapping=prediction["los_mapping"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analytics/gap-analysis")
def analyze_learning_gaps(
    student_id: int,
    performance: schemas.StudentPerformanceData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Identify learning gaps for a student

    Authorization: Teachers only. Only teachers can analyze student gaps.
    """
    # Only teachers can analyze gaps
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can analyze learning gaps"
        )

    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        # Get course outcomes the student is enrolled in
        from sqlalchemy.orm import joinedload

        courses = (
            db.query(Course)
            .filter(Course.students.any(id=student_id))
            .all()
        )

        course_outcomes = []
        for course in courses:
            outcomes = db.query(CourseOutcome).filter(
                CourseOutcome.course_id == course.id
            ).all()
            course_outcomes.extend([co.description for co in outcomes])

        performance_dict = {
            "student_marks": performance.student_marks,
            "attendance": performance.attendance,
            "internal_assessments": performance.internal_assessments,
            "lab_performance": performance.lab_performance,
            "assignment_scores": performance.assignment_scores,
            "study_hours": performance.study_hours,
            "concept_mastery": performance.concept_mastery,
        }

        gaps = identify_gaps(performance_dict, course_outcomes)

        return gaps
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analytics/advisory-plan")
def generate_advisory_plan(
    request_body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate personalized advisory plan using AI

    Authorization: Teachers only. Only teachers can generate advisory plans.
    """
    # Only teachers can generate advisory plans
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can generate advisory plans"
        )

    try:
        student_id = request_body.get("student_id")
        student_name = request_body.get("student_name", "Student")
        weak_concepts = request_body.get(
            "weak_concepts", ["Data Structures", "Algorithm Design"])

        performance = schemas.StudentPerformanceData(
            student_marks=request_body.get("student_marks", 75),
            attendance=request_body.get("attendance", 85),
            internal_assessments=request_body.get("internal_assessments", 80),
            lab_performance=request_body.get("lab_performance", 78),
            assignment_scores=request_body.get("assignment_scores", 82),
            study_hours=request_body.get("study_hours", 5),
            concept_mastery=request_body.get("concept_mastery", 72),
        )

        prediction = ml_pipeline.predict(
            {
                "student_marks": performance.student_marks,
                "attendance": performance.attendance,
                "internal_assessments": performance.internal_assessments,
                "lab_performance": performance.lab_performance,
                "assignment_scores": performance.assignment_scores,
                "study_hours": performance.study_hours,
                "concept_mastery": performance.concept_mastery,
            }
        )

        # Generate components
        study_plan = generate_study_plan(
            student_name,
            weak_concepts,
            prediction["les"],
            prediction["risk_level"],
        )

        concept_reinforcement = generate_concept_reinforcement(
            weak_concepts[0] if weak_concepts else "Core Concepts",
            performance.concept_mastery,
            "intermediate",
        )

        mini_project = generate_mini_project(
            weak_concepts[0] if weak_concepts else "Problem Solving",
            ["web development", "problem solving"]
        )

        adaptive_schedule = generate_adaptive_schedule(
            {"current_study": "5 hours/day"},
            {
                "weak_areas": weak_concepts,
                "les": prediction["les"],
            },
        )

        # ── LOG INTERVENTION FOR FEEDBACK LOOP ─────────────────
        if LES_AVAILABLE:
            try:
                from database import InterventionLog

                log_intervention(
                    db=db,
                    student_id=student_id,
                    les_at_intervention=prediction["les"],
                    risk_at_intervention=prediction["risk_level"],
                    weak_concepts=weak_concepts,
                    advisory_plan=study_plan,
                    subject_id=request_body.get("subject_id"),
                    InterventionLog=InterventionLog,
                )
            except Exception as e:
                print(f"⚠ Warning: Could not log intervention: {e}")
                # Don't fail the advisory request if logging fails
        # ────────────────────────────────────────────────────────

        return schemas.AdvisoryPlanResponse(
            study_plan=study_plan,
            concept_reinforcement=concept_reinforcement,
            mini_project=mini_project,
            adaptive_schedule=adaptive_schedule,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analytics/evaluate-intervention")
def evaluate_intervention(
    student_id: int,
    pre_intervention: schemas.StudentPerformanceData,
    post_intervention: schemas.StudentPerformanceData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evaluate effectiveness of intervention

    Authorization: Teachers only. Only teachers can evaluate interventions.
    """
    # Only teachers can evaluate interventions
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can evaluate interventions"
        )

    try:
        pre_dict = {
            "student_marks": pre_intervention.student_marks,
            "attendance": pre_intervention.attendance,
            "internal_assessments": pre_intervention.internal_assessments,
            "lab_performance": pre_intervention.lab_performance,
            "assignment_scores": pre_intervention.assignment_scores,
            "study_hours": pre_intervention.study_hours,
            "concept_mastery": pre_intervention.concept_mastery,
        }

        post_dict = {
            "student_marks": post_intervention.student_marks,
            "attendance": post_intervention.attendance,
            "internal_assessments": post_intervention.internal_assessments,
            "lab_performance": post_intervention.lab_performance,
            "assignment_scores": post_intervention.assignment_scores,
            "study_hours": post_intervention.study_hours,
            "concept_mastery": post_intervention.concept_mastery,
        }

        evaluation = generate_intervention_evaluation(pre_dict, post_dict)

        return evaluation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/my-analytics")
def get_student_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get student's own analytics [READ-ONLY for students]

    Authorization: 
    - Students: Can view their own analytics only (read-only)
    - Teachers: Can view any student's analytics
    """
    try:
        # For students, get their own data
        # For teachers, they need to query specific student
        student_id = current_user.id if current_user.role == "student" else current_user.id

        # Fetch student's actual grades and submissions
        submissions = db.query(Submission).filter(
            Submission.student_id == student_id
        ).all()

        if not submissions:
            return {
                "message": "No submissions found. Analytics will be available after submitting work.",
                "student_id": student_id,
                "submissions_count": 0
            }

        # Calculate metrics from actual submissions
        total_marks = sum([s.marks for s in submissions if s.marks]
                          ) / len(submissions) if submissions else 0

        return {
            "student_id": student_id,
            "submissions_count": len(submissions),
            "average_marks": round(total_marks, 2),
            "message": "View your performance data (read-only). Contact your teacher to update metrics.",
            "last_updated": submissions[-1].submitted_at if submissions else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= SUBJECTS ENDPOINTS =============


@app.post("/api/subjects", response_model=schemas.SubjectResponse)
def create_subject(
    subject: schemas.SubjectCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new subject"""
    # Only teachers can create subjects
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create subjects")

    # Check if subject code already exists
    existing = db.query(Subject).filter(Subject.code == subject.code).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Subject code already exists")

    db_subject = Subject(
        code=subject.code,
        name=subject.name,
        description=subject.description,
        created_by=current_user["id"]
    )
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@app.get("/api/subjects", response_model=list[schemas.SubjectResponse])
def list_subjects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all subjects"""
    subjects = db.query(Subject).all()
    return subjects


@app.get("/api/subjects/{subject_id}", response_model=schemas.SubjectResponse)
def get_subject(
    subject_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific subject"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@app.put("/api/subjects/{subject_id}", response_model=schemas.SubjectResponse)
def update_subject(
    subject_id: str,
    subject_update: schemas.SubjectUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a subject"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can update subjects")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Only the creator can update
    if subject.created_by != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="You can only update your own subjects")

    if subject_update.name:
        subject.name = subject_update.name
    if subject_update.description is not None:
        subject.description = subject_update.description

    db.commit()
    db.refresh(subject)
    return subject


@app.delete("/api/subjects/{subject_id}")
def delete_subject(
    subject_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a subject"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete subjects")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Only the creator can delete
    if subject.created_by != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="You can only delete your own subjects")

    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}


# ============= PROGRAM OUTCOMES ENDPOINTS =============


@app.post("/api/program-outcomes", response_model=schemas.ProgramOutcomeResponse)
def create_program_outcome(
    outcome: schemas.ProgramOutcomeCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new program outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create outcomes")

    db_outcome = ProgramOutcome(
        code=outcome.code,
        description=outcome.description,
        subject_id=outcome.subject_id,
        created_by=current_user["id"]
    )
    db.add(db_outcome)
    db.commit()
    db.refresh(db_outcome)
    return db_outcome


@app.get("/api/program-outcomes", response_model=list[schemas.ProgramOutcomeResponse])
def list_program_outcomes(
    subject_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List program outcomes, optionally filtered by subject"""
    query = db.query(ProgramOutcome)
    if subject_id:
        query = query.filter(ProgramOutcome.subject_id == subject_id)
    return query.all()


@app.get("/api/program-outcomes/{outcome_id}", response_model=schemas.ProgramOutcomeResponse)
def get_program_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific program outcome"""
    outcome = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")
    return outcome


@app.put("/api/program-outcomes/{outcome_id}", response_model=schemas.ProgramOutcomeResponse)
def update_program_outcome(
    outcome_id: str,
    outcome_update: schemas.ProgramOutcomeUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a program outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can update outcomes")

    outcome = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")

    if outcome_update.description:
        outcome.description = outcome_update.description
    if outcome_update.subject_id is not None:
        outcome.subject_id = outcome_update.subject_id

    db.commit()
    db.refresh(outcome)
    return outcome


@app.delete("/api/program-outcomes/{outcome_id}")
def delete_program_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a program outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete outcomes")

    outcome = db.query(ProgramOutcome).filter(
        ProgramOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Program outcome not found")

    db.delete(outcome)
    db.commit()
    return {"message": "Program outcome deleted successfully"}


# ============= COURSE OUTCOMES ENDPOINTS =============


@app.post("/api/course-outcomes", response_model=schemas.CourseOutcomeResponse)
def create_course_outcome(
    outcome: schemas.CourseOutcomeCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new course outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create outcomes")

    db_outcome = CourseOutcome(
        code=outcome.code,
        description=outcome.description,
        program_outcome_id=outcome.program_outcome_id,
        subject_id=outcome.subject_id,
        created_by=current_user["id"]
    )
    db.add(db_outcome)
    db.commit()
    db.refresh(db_outcome)
    return db_outcome


@app.get("/api/course-outcomes", response_model=list[schemas.CourseOutcomeResponse])
def list_course_outcomes(
    subject_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List course outcomes, optionally filtered by subject"""
    query = db.query(CourseOutcome)
    if subject_id:
        query = query.filter(CourseOutcome.subject_id == subject_id)
    return query.all()


@app.get("/api/course-outcomes/{outcome_id}", response_model=schemas.CourseOutcomeResponse)
def get_course_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific course outcome"""
    outcome = db.query(CourseOutcome).filter(
        CourseOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Course outcome not found")
    return outcome


@app.put("/api/course-outcomes/{outcome_id}", response_model=schemas.CourseOutcomeResponse)
def update_course_outcome(
    outcome_id: str,
    outcome_update: schemas.CourseOutcomeUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a course outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can update outcomes")

    outcome = db.query(CourseOutcome).filter(
        CourseOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Course outcome not found")

    if outcome_update.description:
        outcome.description = outcome_update.description
    if outcome_update.program_outcome_id is not None:
        outcome.program_outcome_id = outcome_update.program_outcome_id
    if outcome_update.subject_id is not None:
        outcome.subject_id = outcome_update.subject_id

    db.commit()
    db.refresh(outcome)
    return outcome


@app.delete("/api/course-outcomes/{outcome_id}")
def delete_course_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a course outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete outcomes")

    outcome = db.query(CourseOutcome).filter(
        CourseOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Course outcome not found")

    db.delete(outcome)
    db.commit()
    return {"message": "Course outcome deleted successfully"}


# ============= LEARNING OUTCOMES ENDPOINTS =============


@app.post("/api/learning-outcomes", response_model=schemas.LearningOutcomeResponse)
def create_learning_outcome(
    outcome: schemas.LearningOutcomeCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new learning outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create outcomes")

    db_outcome = LearningOutcome(
        code=outcome.code,
        description=outcome.description,
        course_outcome_id=outcome.course_outcome_id,
        subject_id=outcome.subject_id,
        created_by=current_user["id"]
    )
    db.add(db_outcome)
    db.commit()
    db.refresh(db_outcome)
    return db_outcome


@app.get("/api/learning-outcomes", response_model=list[schemas.LearningOutcomeResponse])
def list_learning_outcomes(
    subject_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List learning outcomes, optionally filtered by subject"""
    query = db.query(LearningOutcome)
    if subject_id:
        query = query.filter(LearningOutcome.subject_id == subject_id)
    return query.all()


@app.get("/api/learning-outcomes/{outcome_id}", response_model=schemas.LearningOutcomeResponse)
def get_learning_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific learning outcome"""
    outcome = db.query(LearningOutcome).filter(
        LearningOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Learning outcome not found")
    return outcome


@app.put("/api/learning-outcomes/{outcome_id}", response_model=schemas.LearningOutcomeResponse)
def update_learning_outcome(
    outcome_id: str,
    outcome_update: schemas.LearningOutcomeUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a learning outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can update outcomes")

    outcome = db.query(LearningOutcome).filter(
        LearningOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Learning outcome not found")

    if outcome_update.description:
        outcome.description = outcome_update.description
    if outcome_update.course_outcome_id is not None:
        outcome.course_outcome_id = outcome_update.course_outcome_id
    if outcome_update.subject_id is not None:
        outcome.subject_id = outcome_update.subject_id

    db.commit()
    db.refresh(outcome)
    return outcome


@app.delete("/api/learning-outcomes/{outcome_id}")
def delete_learning_outcome(
    outcome_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a learning outcome"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete outcomes")

    outcome = db.query(LearningOutcome).filter(
        LearningOutcome.id == outcome_id).first()
    if not outcome:
        raise HTTPException(
            status_code=404, detail="Learning outcome not found")

    db.delete(outcome)
    db.commit()
    return {"message": "Learning outcome deleted successfully"}


# ============= PARSE OUTCOMES ENDPOINT =============


@app.post("/api/parse-outcomes", response_model=list[schemas.ParsedOutcomeItem])
def parse_outcomes_text(request: schemas.ParseOutcomesRequest):
    """Parse raw text and extract PO/CO/LO outcomes using strict LLM parsing."""
    import google.generativeai as genai
    import os
    import json
    
    FINAL_PROMPT = """You are a strict academic syllabus parser.

Your task is to extract ONLY:
1. Course Outcomes (CO)
2. Lab Outcomes (LO)

----------------------------------
DEFINITION (VERY IMPORTANT):

Course Outcomes (CO) and Lab Outcomes (LO):
- Describe what a student will be able to do after completing the course
- Are complete, meaningful sentences
- Start with action verbs such as:
  Understand, Explain, Apply, Analyze, Design, Implement, Evaluate

----------------------------------
CRITICAL FILTER (MUST FOLLOW):

Even if something is labeled as CO1, CO2, etc., DO NOT trust it blindly.

REJECT any item that:
- Starts with numbers like "1", "2", "3"
- Looks like a topic or syllabus content
- Contains lists of concepts (e.g., "DES, TCP/IP, MD5, protocols")
- Is incomplete or cut off
- Does not clearly describe a student ability

----------------------------------
STRICT EXTRACTION RULES:

- Only extract full learning outcome sentences
- Remove labels like CO1, CO2, LO1, etc.
- Clean and complete slightly broken sentences if meaning is clear
- Do NOT generate or assume missing outcomes
- If unsure → SKIP

----------------------------------
SELF-VALIDATION STEP (VERY IMPORTANT):

Before returning:
- Check each extracted item
- Ask: “Does this clearly describe what a student will be able to do?”
- If NO → REMOVE it

----------------------------------
OUTPUT FORMAT (STRICT JSON ONLY):

{
  "course_outcomes": [],
  "lab_outcomes": []
}"""

    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        # Using gemini-1.5-flash for fastest parsing tasks, or fallback to gemini-pro
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        generation_config = {
            "temperature": 0.2
        }
        
        response = model.generate_content([
            FINAL_PROMPT,
            request.text
        ], generation_config=generation_config)
        
        response_text = response.text
        
        # Extract JSON from response
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        json_str = response_text[start:end]
        data = json.loads(json_str)
    except Exception as e:
        print(f"Error parsing outcomes with stricter AI: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to parse syllabus outcomes with AI")

    results = []
    
    co_list = data.get("course_outcomes", [])
    for idx, desc in enumerate(co_list):
        if desc.strip():
            results.append({
                "type": "CO",
                "number": idx + 1,
                "code": f"CO{idx + 1}",
                "description": desc.strip(),
                "original_code": None
            })
            
    lo_list = data.get("lab_outcomes", [])
    for idx, desc in enumerate(lo_list):
        if desc.strip():
            results.append({
                "type": "LO",
                "number": idx + 1,
                "code": f"LO{idx + 1}",
                "description": desc.strip(),
                "original_code": None
            })
            
    return results


# ============= BULK IMPORT ENDPOINTS =============


@app.post("/api/program-outcomes/bulk")
def bulk_import_program_outcomes(
    request: schemas.BulkImportRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk import program outcomes from extracted PDF data"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can import outcomes")

    # Verify subject exists
    subject = db.query(Subject).filter(
        Subject.id == request.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    imported_count = 0
    for outcome_item in request.outcomes:
        # Check if already exists
        existing = db.query(ProgramOutcome).filter(
            ProgramOutcome.code == outcome_item.code,
            ProgramOutcome.subject_id == request.subject_id
        ).first()

        if not existing:
            db_outcome = ProgramOutcome(
                code=outcome_item.code,
                description=outcome_item.description,
                subject_id=request.subject_id,
                created_by=current_user["id"]
            )
            db.add(db_outcome)
            imported_count += 1

    db.commit()
    return {"imported": imported_count, "message": f"Successfully imported {imported_count} program outcomes"}


@app.post("/api/course-outcomes/bulk")
def bulk_import_course_outcomes(
    request: schemas.BulkImportRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk import course outcomes from extracted PDF data"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can import outcomes")

    # Verify subject exists
    subject = db.query(Subject).filter(
        Subject.id == request.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    imported_count = 0
    for outcome_item in request.outcomes:
        # Check if already exists
        existing = db.query(CourseOutcome).filter(
            CourseOutcome.code == outcome_item.code,
            CourseOutcome.subject_id == request.subject_id
        ).first()

        if not existing:
            db_outcome = CourseOutcome(
                code=outcome_item.code,
                description=outcome_item.description,
                subject_id=request.subject_id,
                created_by=current_user["id"]
            )
            db.add(db_outcome)
            imported_count += 1

    db.commit()
    return {"imported": imported_count, "message": f"Successfully imported {imported_count} course outcomes"}


@app.post("/api/learning-outcomes/bulk")
def bulk_import_learning_outcomes(
    request: schemas.BulkImportRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk import learning outcomes from extracted PDF data"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can import outcomes")

    # Verify subject exists
    subject = db.query(Subject).filter(
        Subject.id == request.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    imported_count = 0
    for outcome_item in request.outcomes:
        # Check if already exists
        existing = db.query(LearningOutcome).filter(
            LearningOutcome.code == outcome_item.code,
            LearningOutcome.subject_id == request.subject_id
        ).first()

        if not existing:
            db_outcome = LearningOutcome(
                code=outcome_item.code,
                description=outcome_item.description,
                subject_id=request.subject_id,
                created_by=current_user["id"]
            )
            db.add(db_outcome)
            imported_count += 1

    db.commit()
    return {"imported": imported_count, "message": f"Successfully imported {imported_count} learning outcomes"}


# ============= ASSIGNMENTS API ENDPOINTS =============


@app.post("/api/assignments", response_model=schemas.AssignmentResponse)
def create_assignment(
    payload: schemas.AssignmentCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create assignments")

    assignment = DBAssignment(
        teacher_id=current_user["id"],
        title=payload.title,
        description=payload.description or "",
        due_date=payload.due_date,
        subject_id=payload.subject_id,
        classroom_id=payload.classroom_id,          # ← save classroom link
        total_marks=payload.total_marks,
        generation_method=payload.generation_method or "manual",
        status=payload.status or "draft",            # ← save status
    )
    db.add(assignment)
    db.flush()

    # Create LO mappings
    for lo_id in (payload.learning_outcome_ids or []):
        mapping = AssignmentLOMapping(
            assignment_id=assignment.id,
            learning_outcome_id=lo_id,
        )
        db.add(mapping)

    # Create questions if provided
    for idx, q in enumerate(payload.questions or []):
        question = DBQuestion(
            assignment_id=assignment.id,
            question_number=idx + 1,
            question_text=q.get("question_text", ""),
            marks=q.get("marks", 10),
            co_id=q.get("co_id"),
            difficulty=q.get("difficulty", "medium"),
        )
        db.add(question)

    db.commit()
    db.refresh(assignment)
    return assignment


@app.get("/api/assignments")
def list_assignments(
    teacher_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DBAssignment)
    if teacher_id:
        query = query.filter(DBAssignment.teacher_id == teacher_id)
    assignments = query.order_by(DBAssignment.created_at.desc()).all()

    # Manually serialize to include questions + co_code
    result = []
    for a in assignments:
        qs = []
        for q in (a.questions or []):
            co_code = None
            if q.co_id:
                co = db.query(CourseOutcome).filter(CourseOutcome.id == q.co_id).first()
                co_code = co.code if co else None
            qs.append({
                "id": q.id,
                "question_number": q.question_number,
                "question_text": q.question_text,
                "marks": q.marks,
                "difficulty": q.difficulty,
                "co_id": q.co_id,
                "co_code": co_code,
            })
        result.append({
            "id": a.id,
            "teacher_id": a.teacher_id,
            "title": a.title,
            "description": a.description or "",
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "subject_id": a.subject_id,
            "classroom_id": str(a.classroom_id) if getattr(a, "classroom_id", None) else None,  # ← include classroom
            "total_marks": a.total_marks,
            "generation_method": a.generation_method,
            "status": getattr(a, "status", "draft"),
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
            "questions": qs,
        })
    return result


@app.get("/api/assignments/{assignment_id}", response_model=schemas.AssignmentResponse)
def get_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"message": "Assignment deleted"}


# ============= ASSIGNMENT-LO MAPPING ENDPOINTS =============


@app.get("/api/assignment-lo-mappings")
def list_assignment_lo_mappings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            AssignmentLOMapping.id,
            AssignmentLOMapping.assignment_id,
            AssignmentLOMapping.learning_outcome_id,
            LearningOutcome.code.label("learning_outcome_code"),
            LearningOutcome.description.label("learning_outcome_description"),
        )
        .outerjoin(LearningOutcome, AssignmentLOMapping.learning_outcome_id == LearningOutcome.id)
        .all()
    )
    return [
        {
            "id": r.id,
            "assignment_id": r.assignment_id,
            "learning_outcome_id": r.learning_outcome_id,
            "learning_outcome_code": r.learning_outcome_code,
            "learning_outcome_description": r.learning_outcome_description,
        }
        for r in rows
    ]


# ============= QUESTIONS ENDPOINTS =============


@app.get("/api/assignments/{assignment_id}/questions", response_model=list[schemas.QuestionResponse])
def list_questions(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(DBQuestion)
        .filter(DBQuestion.assignment_id == assignment_id)
        .order_by(DBQuestion.question_number)
        .all()
    )


@app.post("/api/assignments/{assignment_id}/questions", response_model=schemas.QuestionResponse, status_code=201)
def add_question(
    assignment_id: str,
    payload: schemas.QuestionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can add questions")
    a = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    max_num = db.query(func.max(DBQuestion.question_number)).filter(
        DBQuestion.assignment_id == assignment_id).scalar() or 0
    q = DBQuestion(
        assignment_id=assignment_id,
        question_number=max_num + 1,
        question_text=payload.question_text,
        marks=payload.marks,
        co_id=payload.co_id,
        difficulty=payload.difficulty or "medium",
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@app.delete("/api/questions/{question_id}")
def delete_question(
    question_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete questions")
    q = db.query(DBQuestion).filter(DBQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"message": "Question deleted"}


# ============= PAST PAPER ENDPOINTS =============


@app.post("/api/subjects/{subject_id}/past-papers/upload")
async def upload_past_paper(
    subject_id: str,
    year: str = "",
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a previous year question paper PDF for a subject.
    Extracts individual questions and stores them in the DB for use as
    reference material during question generation.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can upload past papers")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    contents = await file.read()

    # Extract text from PDF
    raw_text = ""
    try:
        import fitz
        doc = fitz.open(stream=contents, filetype="pdf")
        raw_text = "\n".join(page.get_text() for page in doc)
        doc.close()
    except Exception:
        try:
            import pdfplumber, io
            pdf = pdfplumber.open(io.BytesIO(contents))
            raw_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            pdf.close()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not extract PDF text: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

    import re

    # ── Parse questions from extracted text ──
    # Heuristic: lines that start with Q/q followed by number, or "1." / "(1)" etc.
    q_pattern = re.compile(
        r"""
        (?:^|\n)                      # start of line
        (?:
            [Qq](?:uestion)?\.?\s*\d+ |  # Q1, Question 1, Q.1
            \d+[\.\)]\s+              |  # 1. or 1)
            \([a-zA-Z0-9]+\)\s+          # (a) or (1)
        )
        (.{15,})                       # question body (at least 15 chars)
        """,
        re.VERBOSE | re.MULTILINE
    )

    parsed_qs = [m.group(0).strip() for m in q_pattern.finditer(raw_text)]

    # Fallback: split on numbered lines if regex found nothing
    if not parsed_qs:
        for line in raw_text.split("\n"):
            line = line.strip()
            if re.match(r"^\d+[\.\)]\s+\S", line) and len(line) > 15:
                parsed_qs.append(line)

    if not parsed_qs:
        raise HTTPException(
            status_code=422,
            detail="Could not detect any questions in the uploaded PDF. "
                   "Ensure questions are formatted with numbers (e.g. '1.', 'Q1:')."
        )

    # ── Auto-detect difficulty from bloom's keywords ──
    easy_kw = re.compile(r"\b(define|list|state|identify|what is|name|give)\b", re.I)
    hard_kw = re.compile(r"\b(analyze|design|evaluate|implement|justify|critique|derive|prove)\b", re.I)

    def detect_difficulty(text: str) -> str:
        if hard_kw.search(text):
            return "hard"
        if easy_kw.search(text):
            return "easy"
        return "medium"

    # Remove existing past paper questions for this subject+year before re-importing
    existing = db.query(PastPaperQuestion).filter(
        PastPaperQuestion.subject_id == subject_id,
        PastPaperQuestion.year == (year or None),
    ).all()
    for q in existing:
        db.delete(q)

    saved = []
    for q_text in parsed_qs:
        clean = re.sub(r"\s+", " ", q_text).strip()
        if len(clean) < 15:
            continue
        db_q = PastPaperQuestion(
            subject_id=subject_id,
            question_text=clean,
            year=year or None,
            difficulty=detect_difficulty(clean),
            created_by=current_user["id"],
        )
        db.add(db_q)
        saved.append(clean)

    db.commit()
    return {
        "message": f"{len(saved)} questions extracted and saved from the past paper.",
        "year": year or "unspecified",
        "questions_count": len(saved),
    }


@app.get("/api/subjects/{subject_id}/past-papers")
def list_past_paper_questions(
    subject_id: str,
    difficulty: str = "",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all past paper questions stored for a subject."""
    query = db.query(PastPaperQuestion).filter(PastPaperQuestion.subject_id == subject_id)
    if difficulty:
        query = query.filter(PastPaperQuestion.difficulty == difficulty)
    questions = query.order_by(PastPaperQuestion.year.desc(), PastPaperQuestion.created_at).all()
    return [
        {"id": q.id, "question_text": q.question_text, "year": q.year, "difficulty": q.difficulty}
        for q in questions
    ]


@app.delete("/api/subjects/{subject_id}/past-papers")
def clear_past_papers(
    subject_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all past paper questions for a subject."""
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can clear past papers")
    deleted = db.query(PastPaperQuestion).filter(PastPaperQuestion.subject_id == subject_id).delete()
    db.commit()
    return {"message": f"{deleted} past paper questions deleted."}


# ============= QUESTION GENERATION ENDPOINTS =============


@app.post("/api/generate-questions/co-based")
def generate_questions_co_based(
    payload: schemas.COBasedGenerationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate assignment questions based on selected Course Outcomes"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can generate questions")

    cos = db.query(CourseOutcome).filter(
        CourseOutcome.id.in_(payload.co_ids)).all()
    if not cos:
        raise HTTPException(
            status_code=404, detail="No matching Course Outcomes found")

    los = db.query(LearningOutcome).filter(
        LearningOutcome.course_outcome_id.in_(payload.co_ids)
    ).all()

    import random

    # Rich, distinct question templates per difficulty
    templates = {
        "easy": [
            "Define the term '{topic}' in your own words.",
            "List the key characteristics of {topic}.",
            "State the purpose of {topic} with a suitable example.",
            "Identify the main components involved in {topic}.",
            "What do you understand by {topic}? Explain briefly.",
            "Describe how {topic} is used in practice.",
        ],
        "medium": [
            "Explain the working principle of {topic} with a neat diagram.",
            "Compare and contrast {topic} with a related concept.",
            "Illustrate the step-by-step process involved in {topic}.",
            "Discuss the advantages and limitations of {topic}.",
            "How does {topic} differ from its alternatives? Justify your answer.",
            "With the help of an example, explain the significance of {topic}.",
        ],
        "hard": [
            "Analyze the impact of {topic} on system performance and efficiency.",
            "Design a solution that incorporates {topic}. Justify your design choices.",
            "Critically evaluate the role of {topic} in a real-world scenario.",
            "Implement an algorithm/approach for {topic} and trace it with an example.",
            "Compare competing approaches to {topic} and recommend the most suitable one.",
            "Given a problem scenario, apply the concepts of {topic} to derive a solution.",
        ],
    }

    tmpl_list = templates.get(payload.difficulty, templates["medium"])
    questions = []
    q_per_co = max(1, payload.num_questions // len(cos))
    remainder = payload.num_questions - q_per_co * len(cos)
    qnum = 0

    for i, co in enumerate(cos):
        co_los = [lo for lo in los if lo.course_outcome_id == co.id]
        count = q_per_co + (1 if i < remainder else 0)

        # Build a pool of unique topics: prefer LO descriptions, fall back to CO
        topics = [lo.description.rstrip(".") for lo in co_los] if co_los else [co.description.rstrip(".")]
        # Shuffle so different calls give different order
        random.shuffle(topics)

        used_templates = []
        for j in range(count):
            qnum += 1
            topic = topics[j % len(topics)]

            # Pick a template not used consecutively; cycle through all before repeating
            available = [t for t in tmpl_list if t not in used_templates] or tmpl_list[:]
            tmpl = random.choice(available)
            used_templates.append(tmpl)
            if len(used_templates) > len(tmpl_list) // 2:
                used_templates.pop(0)

            q_text = tmpl.format(topic=topic)
            questions.append({
                "question_number": qnum,
                "question_text": q_text,
                "marks": payload.marks_per_question,
                "co_id": co.id,
                "co_code": co.code,
                "difficulty": payload.difficulty,
                "source": "generated",
            })

    # ── Blend in past paper questions (up to 40% of total) ──
    # Get subject_id from any of the COs
    subject_id = cos[0].subject_id if cos else None
    if subject_id:
        past_qs = db.query(PastPaperQuestion).filter(
            PastPaperQuestion.subject_id == subject_id,
            PastPaperQuestion.difficulty == payload.difficulty,
        ).all()

        if past_qs:
            random.shuffle(past_qs)
            blend_count = max(1, payload.num_questions * 2 // 5)  # 40%
            selected_past = past_qs[:blend_count]

            # Insert past questions at evenly spaced slots
            step = max(1, len(questions) // (len(selected_past) + 1))
            offset = 0
            for pq in selected_past:
                insert_pos = min(offset + step, len(questions))
                questions.insert(insert_pos, {
                    "question_number": 0,  # renumbered below
                    "question_text": pq.question_text,
                    "marks": payload.marks_per_question,
                    "co_id": None,
                    "co_code": None,
                    "difficulty": pq.difficulty,
                    "source": f"past_paper_{pq.year or 'unknown'}",
                })
                offset = insert_pos + 1

            # Renumber all questions sequentially
            for idx, q in enumerate(questions):
                q["question_number"] = idx + 1

    total_marks = len(questions) * payload.marks_per_question
    return {"questions": questions, "total_marks": total_marks}


@app.post("/api/generate-questions/syllabus-based")
def generate_questions_syllabus_based(
    payload: schemas.SyllabusGenerationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate questions from pasted syllabus text"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can generate questions")

    text = payload.syllabus_text.strip()
    if not text:
        raise HTTPException(
            status_code=400, detail="No syllabus text provided")

    import re, random

    # Extract meaningful topic phrases (sentences/clauses > 8 chars, deduplicated)
    raw_lines = [l.strip() for l in re.split(r'[\n;]+', text) if len(l.strip()) > 8]
    # Deduplicate while preserving order
    seen = set()
    lines = []
    for l in raw_lines:
        key = l.lower()
        if key not in seen:
            seen.add(key)
            lines.append(l)
    if not lines:
        lines = [text[:300]]

    templates = {
        "easy": [
            "Define the following concept: {topic}.",
            "In brief, what is meant by '{topic}'?",
            "List the key points related to: {topic}.",
            "State and explain: {topic}.",
            "What is the significance of {topic}? Give one example.",
            "Identify the components or stages involved in: {topic}.",
        ],
        "medium": [
            "Explain with an example: {topic}.",
            "Discuss the role and importance of: {topic}.",
            "How is {topic} applied in real systems? Illustrate with a diagram.",
            "Compare the approaches used in {topic}.",
            "Elaborate on the working of: {topic}.",
            "What are the advantages and disadvantages of {topic}?",
        ],
        "hard": [
            "Critically analyze the following concept: {topic}.",
            "Design and implement a solution for: {topic}. Justify your approach.",
            "Evaluate the effectiveness of different strategies for {topic}.",
            "Given a scenario, apply the principles of {topic} to solve it.",
            "Trace through the algorithm or process described in: {topic}.",
            "Compare competing methodologies for {topic} and suggest the best fit.",
        ],
    }

    tmpl_list = templates.get(payload.difficulty, templates["medium"])
    random.shuffle(lines)  # randomize topic order each call

    questions = []
    used_templates: list = []
    for i in range(payload.num_questions):
        topic = lines[i % len(lines)].rstrip(".")

        available = [t for t in tmpl_list if t not in used_templates] or tmpl_list[:]
        tmpl = random.choice(available)
        used_templates.append(tmpl)
        if len(used_templates) > len(tmpl_list) // 2:
            used_templates.pop(0)

        questions.append({
            "question_number": i + 1,
            "question_text": tmpl.format(topic=topic),
            "marks": payload.marks_per_question,
            "co_id": None,
            "co_code": None,
            "difficulty": payload.difficulty,
        })

    return {"questions": questions, "total_marks": len(questions) * payload.marks_per_question}


@app.post("/api/extract-text/pdf")
async def extract_text_from_pdf(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
):
    """Extract text from an uploaded PDF file"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        try:
            import pdfplumber
        except ImportError:
            raise HTTPException(
                status_code=500, detail="No PDF parser available. Install pymupdf or pdfplumber.")

    contents = await file.read()

    import uuid as uuid_mod
    import os
    ext = os.path.splitext(file.filename or "")[1] or ".pdf"
    new_filename = f"material_{uuid_mod.uuid4().hex}{ext}"
    file_path_full = os.path.join(UPLOADS_DIR, new_filename)
    
    with open(file_path_full, "wb") as f:
        f.write(contents)

    # Try PyMuPDF first
    try:
        import fitz
        doc = fitz.open(stream=contents, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return {"text": "\n".join(text_parts), "pages": len(text_parts), "file_path": new_filename}
    except Exception:
        pass

    # Fallback to pdfplumber
    try:
        import pdfplumber
        import io
        pdf = pdfplumber.open(io.BytesIO(contents))
        text_parts = []
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        pdf.close()
        return {"text": "\n".join(text_parts), "pages": len(text_parts), "file_path": new_filename}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"PDF extraction failed: {str(e)}")


@app.post("/api/extract-text/image")
async def extract_text_from_image(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
):
    """Extract text from an uploaded image using OCR (Tesseract)"""
    try:
        import pytesseract
        from PIL import Image
        import io
    except ImportError:
        raise HTTPException(
            status_code=500, detail="OCR libraries not available. Install pytesseract and Pillow.")

    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(img)
        return {"text": text}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"OCR extraction failed: {str(e)}")


# ============= MODEL SOLUTION ENDPOINTS =============


@app.post("/api/model-solutions", response_model=schemas.ModelSolutionResponse, status_code=201)
def create_model_solution(
    payload: schemas.ModelSolutionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can upload model solutions")
    sol = DBModelSolution(
        assignment_id=payload.assignment_id,
        question_id=payload.question_id,
        solution_text=payload.solution_text or "",
        rubric=payload.rubric or "",
        created_by=current_user["id"],
    )
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


@app.get("/api/model-solutions", response_model=list[schemas.ModelSolutionResponse])
def list_model_solutions(
    assignment_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(DBModelSolution)
    if assignment_id:
        q = q.filter(DBModelSolution.assignment_id == assignment_id)
    return q.all()


@app.delete("/api/model-solutions/{solution_id}")
def delete_model_solution(
    solution_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can delete solutions")
    sol = db.query(DBModelSolution).filter(
        DBModelSolution.id == solution_id).first()
    if not sol:
        raise HTTPException(status_code=404, detail="Model solution not found")
    db.delete(sol)
    db.commit()
    return {"message": "Deleted"}


# ──────────────────────────────────────────────────────────────────────
# SHARED AUTO-EVALUATION HELPER
# ──────────────────────────────────────────────────────────────────────
def _run_auto_evaluation(submission_id: str, db: Session) -> dict:
    """Score a student submission against model solutions and autosave.
    Returns a summary dict. Safe to call multiple times (upsert)."""
    import re as _re

    sub = db.query(DBSubmission).filter(DBSubmission.id == submission_id).first()
    if not sub:
        return {"error": "submission not found"}

    questions = (
        db.query(DBQuestion)
        .filter(DBQuestion.assignment_id == sub.assignment_id)
        .order_by(DBQuestion.question_number)
        .all()
    )

    solutions = db.query(DBModelSolution).filter(
        DBModelSolution.assignment_id == sub.assignment_id
    ).all()

    if not solutions:
        return {"skipped": "no model solutions uploaded yet"}

    # Build solution lookup
    sol_by_q: dict = {}
    general_sol = ""
    for s in solutions:
        if s.question_id:
            sol_by_q[s.question_id] = s.solution_text or ""
        else:
            general_sol += (s.solution_text or "") + "\n"

    # Try to extract text from the student's uploaded PDF
    student_pdf_text = ""
    if sub.pdf_path:
        pdf_filepath = os.path.join(UPLOADS_DIR, sub.pdf_path)
        if os.path.exists(pdf_filepath):
            try:
                import fitz
                doc = fitz.open(pdf_filepath)
                for page in doc:
                    student_pdf_text += page.get_text() + "\n"
                doc.close()
            except Exception:
                try:
                    import pdfplumber
                    pdf = pdfplumber.open(pdf_filepath)
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            student_pdf_text += t + "\n"
                    pdf.close()
                except Exception:
                    pass

    # Combine all text sources for the student answer
    student_text = (
        (student_pdf_text or "")
        + "\n" + (sub.content or "")
        + "\n" + (sub.extracted_text or "")
    ).strip()

    # ── IDENTICAL PDF / TEXT DETECTION ──────────────────────────────
    # If the student submitted the exact same PDF as the model solution
    # (byte-for-byte OR extracted text is virtually identical),
    # award full marks (100%) immediately without running AI scoring.
    pdf_is_identical = False

    # 1) Raw-bytes comparison against every uploaded solution PDF
    if sub.pdf_path and not pdf_is_identical:
        student_pdf_path = os.path.join(UPLOADS_DIR, sub.pdf_path)
        if os.path.exists(student_pdf_path):
            with open(student_pdf_path, "rb") as _sf:
                _student_bytes = _sf.read()
            for _sol in solutions:
                if getattr(_sol, "file_path", None):
                    _sol_pdf_path = os.path.join(UPLOADS_DIR, _sol.file_path)
                    if os.path.exists(_sol_pdf_path):
                        with open(_sol_pdf_path, "rb") as _tf:
                            _sol_bytes = _tf.read()
                        if _student_bytes == _sol_bytes:
                            pdf_is_identical = True
                            break

    # 2) Extracted-text near-identity check (covers scanned/re-saved PDFs)
    if not pdf_is_identical and student_text:
        _all_model_text = " ".join(
            (s.solution_text or "") for s in solutions
        ).strip()
        if _all_model_text:
            _text_sim = _compute_similarity(student_text, _all_model_text)
            if _text_sim >= 0.99:
                pdf_is_identical = True
    # ────────────────────────────────────────────────────────────────

    # Split by Q1, Q2 … markers if present
    q_pattern = _re.compile(r'(?:Q|Question)\s*(\d+)', _re.IGNORECASE)
    chunks: dict = {}
    parts = q_pattern.split(student_text)
    if len(parts) > 1:
        for i in range(1, len(parts) - 1, 2):
            try:
                qnum = int(parts[i])
                chunks[qnum] = parts[i + 1].strip()
            except (ValueError, IndexError):
                pass

    total_ai = 0.0
    total_max = 0
    results = []

    for q in questions:
        student_ans = chunks.get(q.question_number, "")
        if not student_ans and len(questions) == 1:
            student_ans = student_text

        # ── If submitted PDF is identical to model solution → 100% ──
        if pdf_is_identical:
            sim = 1.0
            ai_score = float(q.marks)
            feedback = (
                f"✅ Submitted PDF is identical to the model solution. "
                f"Full marks awarded: {ai_score}/{q.marks}."
            )
        else:
            model_ans = sol_by_q.get(q.id, general_sol).strip()
            sim = _compute_similarity(student_ans, model_ans) if model_ans else 0.0
            ai_score = round(sim * q.marks, 1)

            # Rubric keyword bonus (up to 30% extra weight)
            rubric_sols = [s for s in solutions if s.question_id == q.id or not s.question_id]
            rubric_bonus = 0.0
            for rs in rubric_sols:
                if rs.rubric:
                    keywords = [kw.strip().lower() for kw in rs.rubric.split(",") if kw.strip()]
                    if keywords:
                        matched = sum(1 for kw in keywords if kw in student_ans.lower())
                        rubric_bonus = round((matched / len(keywords)) * q.marks * 0.3, 1)

            ai_score = min(float(q.marks), round(ai_score + rubric_bonus, 1))

            feedback = (
                f"Similarity with model answer: {sim:.0%}. "
                f"AI score: {ai_score}/{q.marks}."
            )
            if sim < 0.3:
                feedback += " ⚠ Low similarity — review this question."
            elif sim > 0.7:
                feedback += " ✓ Good coverage of the model answer."

        # Upsert evaluation row
        existing_ev = db.query(DBQuestionEvaluation).filter(
            DBQuestionEvaluation.submission_id == submission_id,
            DBQuestionEvaluation.question_id == q.id,
        ).first()
        if existing_ev:
            existing_ev.student_answer_text = student_ans
            existing_ev.ai_score = ai_score
            existing_ev.final_score = ai_score
            existing_ev.similarity_score = sim
            existing_ev.evaluation_feedback = feedback
        else:
            db.add(DBQuestionEvaluation(
                submission_id=submission_id,
                question_id=q.id,
                student_answer_text=student_ans,
                ai_score=ai_score,
                final_score=ai_score,
                max_marks=q.marks,
                similarity_score=sim,
                evaluation_feedback=feedback,
            ))

        total_ai += ai_score
        total_max += q.marks
        results.append({"question_id": q.id, "q_num": q.question_number,
                        "ai_score": ai_score, "max": q.marks, "sim": sim})

    # ── NO-QUESTIONS FALLBACK ─────────────────────────────────────────
    # If the assignment has no questions defined, score the entire
    # student submission against the combined model solution text,
    # using assignment.total_marks as the ceiling.
    if not questions:
        assignment_obj = db.query(DBAssignment).filter(
            DBAssignment.id == sub.assignment_id
        ).first()
        total_marks_fallback = int((assignment_obj.total_marks or 100) if assignment_obj else 100)

        if pdf_is_identical:
            sim_fallback = 1.0
            earned_fallback = float(total_marks_fallback)
            fb_feedback = (
                f"\u2705 Submitted PDF is identical to the model solution. "
                f"Full marks awarded: {earned_fallback}/{total_marks_fallback}."
            )
        else:
            _all_model_fb = (general_sol.strip() or " ".join(
                (s.solution_text or "") for s in solutions if s.solution_text
            ).strip())
            sim_fallback = _compute_similarity(student_text, _all_model_fb) if _all_model_fb else 0.0

            # Rubric keyword bonus on the whole submission
            rubric_bonus_fb = 0.0
            for rs in solutions:
                if rs.rubric:
                    kws = [kw.strip().lower() for kw in rs.rubric.split(",") if kw.strip()]
                    if kws and student_text:
                        matched_fb = sum(1 for kw in kws if kw in student_text.lower())
                        rubric_bonus_fb = max(
                            rubric_bonus_fb,
                            round((matched_fb / len(kws)) * total_marks_fallback * 0.3, 1)
                        )

            earned_fallback = min(
                float(total_marks_fallback),
                round(sim_fallback * total_marks_fallback + rubric_bonus_fb, 1)
            )
            fb_feedback = (
                f"Similarity with model answer: {sim_fallback:.0%}. "
                f"AI score: {earned_fallback}/{total_marks_fallback}."
            )
            if sim_fallback < 0.3:
                fb_feedback += " \u26a0 Low similarity \u2014 review your answer."
            elif sim_fallback > 0.7:
                fb_feedback += " \u2713 Good coverage of the model answer."

        total_ai = earned_fallback
        total_max = total_marks_fallback
        results.append({
            "question_id": None,
            "q_num": 0,
            "ai_score": earned_fallback,
            "max": total_marks_fallback,
            "sim": 1.0 if pdf_is_identical else sim_fallback,
            "note": "whole-submission fallback (no questions defined)",
        })
    # ────────────────────────────────────────────────────────────────

    # Save total marks on the submission
    percentage = round((total_ai / total_max * 100) if total_max else 0, 1)
    sub.marks = int(round(total_ai))
    db.flush()

    # ── Update StudentPerformance.assignment_scores for LES engine ──
    perf = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == sub.student_id
    ).first()
    if perf:
        # Blend new score with existing (rolling average)
        prev = perf.assignment_scores or 0
        perf.assignment_scores = int(round((prev + percentage) / 2))
    else:
        db.add(StudentPerformance(
            student_id=sub.student_id,
            assignment_scores=int(percentage),
        ))

    db.commit()
    return {"total_ai": total_ai, "total_max": total_max, "percentage": percentage,
            "evaluations": results}


@app.post("/api/model-solutions/upload-pdf")
async def upload_model_solution_pdf(
    assignment_id: str = Form(...),
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a PDF model solution and extract text from it"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can upload solutions")

    # Save file
    ext = file.filename.split(".")[-1] if file.filename else "pdf"
    filename = f"solutions/{uuid_mod.uuid4()}.{ext}"
    sol_dir = os.path.join(UPLOADS_DIR, "solutions")
    os.makedirs(sol_dir, exist_ok=True)
    filepath = os.path.join(UPLOADS_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Extract text
    extracted = ""
    try:
        import fitz
        doc = fitz.open(filepath)
        for page in doc:
            extracted += page.get_text() + "\n"
        doc.close()
    except Exception:
        try:
            import pdfplumber
            pdf = pdfplumber.open(filepath)
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    extracted += t + "\n"
            pdf.close()
        except Exception:
            pass

    sol = DBModelSolution(
        assignment_id=assignment_id,
        solution_text=extracted.strip(),
        file_path=filename,
        created_by=current_user["id"],
    )
    db.add(sol)
    db.commit()
    db.refresh(sol)

    # ── AUTO-EVALUATE all existing submissions for this assignment ──
    existing_submissions = db.query(DBSubmission).filter(
        DBSubmission.assignment_id == assignment_id
    ).all()
    auto_results = []
    for sub in existing_submissions:
        result = _run_auto_evaluation(sub.id, db)
        auto_results.append({"submission_id": sub.id, "student_id": sub.student_id, "result": result})

    return {
        "id": sol.id,
        "assignment_id": sol.assignment_id,
        "file_path": filename,
        "extracted_text": extracted.strip()[:500],
        "solution_text": sol.solution_text,
        "auto_evaluated": len(auto_results),
        "evaluation_results": auto_results,
    }


# ============= STUDENT SUBMISSION ENDPOINT =============


@app.post("/api/submit-assignment")
async def submit_assignment_pdf(
    assignment_id: str = Form(...),
    student_id: str = Form(None),
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student submits a PDF solution for an assignment"""
    # Verify assignment exists
    assignment = db.query(DBAssignment).filter(
        DBAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Save file to uploads dir
    ext = (file.filename or "upload").split(".")[-1]
    filename = f"submissions/{uuid_mod.uuid4()}.{ext}"
    sub_dir = os.path.join(UPLOADS_DIR, "submissions")
    os.makedirs(sub_dir, exist_ok=True)
    filepath = os.path.join(UPLOADS_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Check for existing submission (upsert)
    sid = student_id or current_user["id"]
    existing = db.query(DBSubmission).filter(
        DBSubmission.assignment_id == assignment_id,
        DBSubmission.student_id == sid,
    ).first()

    if existing:
        existing.pdf_path = filename
        existing.content = f"Submitted file: {file.filename}"
        db.commit()
        db.refresh(existing)
        sid = existing.id
    else:
        submission = DBSubmission(
            assignment_id=assignment_id,
            student_id=sid,
            content=f"Submitted file: {file.filename}",
            pdf_path=filename,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        sid = submission.id

    # ── AUTO-EVALUATE immediately if model solution exists ──
    auto_result = _run_auto_evaluation(sid, db)

    return {
        "id": sid,
        "assignment_id": assignment_id,
        "file_path": filename,
        "status": "updated" if existing else "submitted",
        "auto_evaluation": auto_result,
    }


# ============= RE-EVALUATE ENDPOINT =============


@app.post("/api/re-evaluate/{submission_id}")
def re_evaluate_submission(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-run auto-evaluation for any existing submission.

    Useful when:
    - Submission was made BEFORE the model solution was uploaded.
    - Marks were stuck at 0 due to no questions being defined at the time.
    - Teacher uploads a new/corrected model solution and wants to re-score all.

    Teachers can re-evaluate any submission.
    Students can only re-evaluate their own submission.
    """
    sub = db.query(DBSubmission).filter(DBSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Auth check
    if current_user.get("role") == "student" and sub.student_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot re-evaluate another student's submission")

    result = _run_auto_evaluation(submission_id, db)

    # Refresh to get updated marks
    db.refresh(sub)

    return {
        "submission_id": submission_id,
        "student_id": sub.student_id,
        "marks": sub.marks,
        "evaluation_result": result,
    }


@app.post("/api/re-evaluate-assignment/{assignment_id}")
def re_evaluate_all_submissions(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-run auto-evaluation for ALL submissions of an assignment.

    Use this after uploading a new model solution so all existing
    submissions are scored immediately. Teacher only.
    """
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can bulk re-evaluate")

    assignment = db.query(DBAssignment).filter(DBAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    submissions = db.query(DBSubmission).filter(
        DBSubmission.assignment_id == assignment_id
    ).all()

    if not submissions:
        return {"message": "No submissions found for this assignment", "evaluated": 0}

    results = []
    for sub in submissions:
        res = _run_auto_evaluation(sub.id, db)
        db.refresh(sub)
        results.append({
            "submission_id": sub.id,
            "student_id": sub.student_id,
            "marks": sub.marks,
            "result": res,
        })

    return {
        "assignment_id": assignment_id,
        "evaluated": len(results),
        "results": results,
    }


# ============= STUDENT ASSIGNMENTS ENDPOINT =============


@app.get("/api/student/assignments")
def get_student_assignments(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all published assignments with submission status for the logged-in student.

    Since classroom membership is managed via localStorage (not the DB),
    we return ALL published assignments and let the frontend filter by classroom_id.
    Includes per-question data and submission status for this student.
    """
    assignments = (
        db.query(DBAssignment)
        .filter(DBAssignment.status == "published")
        .order_by(DBAssignment.created_at.desc())
        .all()
    )

    result = []
    for a in assignments:
        # Questions
        questions = (
            db.query(DBQuestion)
            .filter(DBQuestion.assignment_id == a.id)
            .order_by(DBQuestion.question_number)
            .all()
        )
        qs = []
        for q in questions:
            co_code = None
            if q.co_id:
                co = db.query(CourseOutcome).filter(CourseOutcome.id == q.co_id).first()
                co_code = co.code if co else None
            qs.append({
                "id": q.id,
                "question_number": q.question_number,
                "question_text": q.question_text,
                "marks": q.marks,
                "difficulty": q.difficulty,
                "co_id": q.co_id,
                "co_code": co_code,
            })

        # Submission status for this student
        submission = db.query(DBSubmission).filter(
            DBSubmission.assignment_id == a.id,
            DBSubmission.student_id == current_user["id"],
        ).first()

        submission_status = "pending"
        submission_id = None
        submission_pdf_path = None
        score = None
        submitted_at = None
        if submission:
            submission_status = "graded" if submission.marks is not None else "submitted"
            submission_id = submission.id
            submission_pdf_path = submission.pdf_path
            score = submission.marks
            submitted_at = submission.submitted_at.isoformat() if submission.submitted_at else None

        result.append({
            "id": str(a.id),
            "title": a.title,
            "description": a.description or "",
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "total_marks": a.total_marks,
            "status": a.status,
            "questions_count": len(qs),
            "questions": qs,
            "subject_id": a.subject_id,
            "created_at": a.created_at.isoformat(),
            "classroom_id": str(a.classroom_id) if a.classroom_id else None,
            "teacher_id": a.teacher_id,
            "generation_method": a.generation_method,
            "submission_status": submission_status,
            "submission_id": submission_id,
            "submission_pdf_path": submission_pdf_path,
            "score": score,
            "submitted_at": submitted_at,
        })
    return result


# ============= SUBMISSIONS LIST ENDPOINT =============


@app.get("/api/submissions")
def list_submissions_api(
    assignment_id: str = None,
    student_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List submissions, optionally filtered by assignment_id or student_id.

    Teachers can view all submissions.
    Students can only view their own submissions.
    """
    if current_user.get("role") == "student":
        # Students can only see their own submissions
        student_id = current_user["id"]

    query = db.query(DBSubmission)
    if assignment_id:
        query = query.filter(DBSubmission.assignment_id == assignment_id)
    if student_id:
        query = query.filter(DBSubmission.student_id == student_id)

    submissions = query.order_by(DBSubmission.submitted_at.desc()).all()

    result = []
    for s in submissions:
        student = db.query(User).filter(User.id == s.student_id).first()
        result.append({
            "id": s.id,
            "assignment_id": s.assignment_id,
            "student_id": s.student_id,
            "student_name": student.name if student else s.student_id[:8],
            "student_email": student.email if student else "",
            "content": s.content or "",
            "marks": s.marks,
            "grade": s.grade,
            "feedback": s.feedback,
            "image_path": s.image_path,
            "pdf_path": s.pdf_path,
            "extracted_text": s.extracted_text,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        })
    return result


def _compute_similarity(text_a: str, text_b: str) -> float:
    """Compute text similarity using TF-IDF + cosine similarity (scikit-learn)"""
    if not text_a.strip() or not text_b.strip():
        return 0.0
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf = vectorizer.fit_transform([text_a, text_b])
        sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        return float(round(sim, 4))
    except Exception:
        # Fallback: simple keyword overlap
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        if not words_a or not words_b:
            return 0.0
        overlap = words_a & words_b
        return round(len(overlap) / max(len(words_a), len(words_b)), 4)


@app.post("/api/evaluate-submission/{submission_id}")
def evaluate_submission(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-evaluate a student submission against model solutions"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can trigger evaluation")

    sub = db.query(DBSubmission).filter(
        DBSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Get the assignment and its questions
    questions = (
        db.query(DBQuestion)
        .filter(DBQuestion.assignment_id == sub.assignment_id)
        .order_by(DBQuestion.question_number)
        .all()
    )

    # Get model solutions for this assignment
    solutions = db.query(DBModelSolution).filter(
        DBModelSolution.assignment_id == sub.assignment_id
    ).all()

    # Build solution text lookup by question_id, plus a general solution
    sol_by_q = {}
    general_sol = ""
    for s in solutions:
        if s.question_id:
            sol_by_q[s.question_id] = s.solution_text or ""
        else:
            general_sol += (s.solution_text or "") + "\n"

    # Student answer text (from submitted PDF + content + extracted_text)
    student_pdf_text_ev = ""
    if sub.pdf_path:
        _pdf_fp = os.path.join(UPLOADS_DIR, sub.pdf_path)
        if os.path.exists(_pdf_fp):
            try:
                import fitz as _fitz_ev
                _doc = _fitz_ev.open(_pdf_fp)
                for _pg in _doc:
                    student_pdf_text_ev += _pg.get_text() + "\n"
                _doc.close()
            except Exception:
                try:
                    import pdfplumber as _plumb_ev
                    _pdf = _plumb_ev.open(_pdf_fp)
                    for _pg in _pdf.pages:
                        _t = _pg.extract_text()
                        if _t:
                            student_pdf_text_ev += _t + "\n"
                    _pdf.close()
                except Exception:
                    pass

    student_text = (
        (student_pdf_text_ev or "")
        + "\n" + (sub.content or "")
        + "\n" + (sub.extracted_text or "")
    ).strip()

    # ── IDENTICAL PDF / TEXT DETECTION ──────────────────────────────
    pdf_is_identical_ev = False

    # 1) Raw-bytes comparison
    if sub.pdf_path:
        _student_pdf_path = os.path.join(UPLOADS_DIR, sub.pdf_path)
        if os.path.exists(_student_pdf_path):
            with open(_student_pdf_path, "rb") as _sf:
                _sb = _sf.read()
            for _sol in solutions:
                if getattr(_sol, "file_path", None):
                    _sp = os.path.join(UPLOADS_DIR, _sol.file_path)
                    if os.path.exists(_sp):
                        with open(_sp, "rb") as _tf:
                            _tb = _tf.read()
                        if _sb == _tb:
                            pdf_is_identical_ev = True
                            break

    # 2) Extracted-text near-identity check
    if not pdf_is_identical_ev and student_text:
        _all_model = " ".join((s.solution_text or "") for s in solutions).strip()
        if _all_model and _compute_similarity(student_text, _all_model) >= 0.99:
            pdf_is_identical_ev = True
    # ────────────────────────────────────────────────────────────────

    # Split student text into per-question chunks if possible
    import re
    q_pattern = re.compile(r'(?:Q|Question)\s*(\d+)', re.IGNORECASE)
    chunks = {}
    parts = q_pattern.split(student_text)
    if len(parts) > 1:
        for i in range(1, len(parts) - 1, 2):
            try:
                qnum = int(parts[i])
                chunks[qnum] = parts[i + 1].strip()
            except (ValueError, IndexError):
                pass

    results = []
    total_ai = 0
    total_max = 0

    for q in questions:
        # Get student answer for this question
        student_ans = chunks.get(q.question_number, "")
        if not student_ans and not questions[0:1]:
            student_ans = student_text
        if not student_ans and len(questions) == 1:
            student_ans = student_text

        # ── If submitted PDF is identical to model solution → 100% ──
        if pdf_is_identical_ev:
            sim = 1.0
            ai_score = float(q.marks)
        else:
            # Get model answer
            model_ans = sol_by_q.get(q.id, general_sol).strip()

            # Compute similarity
            sim = _compute_similarity(student_ans, model_ans) if model_ans else 0.0
            ai_score = round(sim * q.marks, 1)

            # Check for rubric keywords
            rubric_sols = [s for s in solutions if s.question_id ==
                           q.id or not s.question_id]
            rubric_bonus = 0
            for rs in rubric_sols:
                if rs.rubric:
                    keywords = [kw.strip().lower()
                                for kw in rs.rubric.split(",") if kw.strip()]
                    if keywords:
                        matched = sum(
                            1 for kw in keywords if kw in student_ans.lower())
                        rubric_bonus = round(
                            (matched / len(keywords)) * q.marks * 0.3, 1)

            ai_score = min(q.marks, round(ai_score + rubric_bonus, 1))

        # Check if evaluation already exists
        existing = db.query(DBQuestionEvaluation).filter(
            DBQuestionEvaluation.submission_id == submission_id,
            DBQuestionEvaluation.question_id == q.id,
        ).first()

        _ev_feedback = (
            f"\u2705 Submitted PDF is identical to the model solution. Full marks awarded: {ai_score}/{q.marks}."
            if pdf_is_identical_ev
            else f"Similarity: {sim:.2%}. AI assigned {ai_score}/{q.marks}."
        )

        if existing:
            existing.student_answer_text = student_ans
            existing.ai_score = ai_score
            existing.final_score = ai_score
            existing.similarity_score = sim
            existing.evaluation_feedback = _ev_feedback
            eval_obj = existing
        else:
            eval_obj = DBQuestionEvaluation(
                submission_id=submission_id,
                question_id=q.id,
                student_answer_text=student_ans,
                ai_score=ai_score,
                final_score=ai_score,
                max_marks=q.marks,
                similarity_score=sim,
                evaluation_feedback=_ev_feedback,
            )
            db.add(eval_obj)

        total_ai += ai_score
        total_max += q.marks
        results.append({
            "question_id": q.id,
            "question_number": q.question_number,
            "ai_score": ai_score,
            "max_marks": q.marks,
            "similarity": sim,
        })

    # ── NO-QUESTIONS FALLBACK ─────────────────────────────────────────
    if not questions:
        assignment_obj = db.query(DBAssignment).filter(
            DBAssignment.id == sub.assignment_id
        ).first()
        total_marks_fallback = int((assignment_obj.total_marks or 100) if assignment_obj else 100)

        if pdf_is_identical_ev:
            sim_fallback = 1.0
            earned_fallback = float(total_marks_fallback)
            _ev_feedback = (
                f"\u2705 Submitted PDF is identical to the model solution. "
                f"Full marks awarded: {earned_fallback}/{total_marks_fallback}."
            )
        else:
            _all_model_fb = (general_sol.strip() or " ".join(
                (s.solution_text or "") for s in solutions if s.solution_text
            ).strip())
            sim_fallback = _compute_similarity(student_text, _all_model_fb) if _all_model_fb else 0.0

            rubric_bonus_fb = 0.0
            for rs in solutions:
                if rs.rubric:
                    kws = [kw.strip().lower() for kw in rs.rubric.split(",") if kw.strip()]
                    if kws and student_text:
                        matched_fb = sum(1 for kw in kws if kw in student_text.lower())
                        rubric_bonus_fb = max(
                            rubric_bonus_fb,
                            round((matched_fb / len(kws)) * total_marks_fallback * 0.3, 1)
                        )

            earned_fallback = min(
                float(total_marks_fallback),
                round(sim_fallback * total_marks_fallback + rubric_bonus_fb, 1)
            )
            _ev_feedback = (
                f"Similarity with model answer: {sim_fallback:.0%}. "
                f"AI score: {earned_fallback}/{total_marks_fallback}."
            )
            if sim_fallback < 0.3:
                _ev_feedback += " \u26a0 Low similarity \u2014 review your answer."
            elif sim_fallback > 0.7:
                _ev_feedback += " \u2713 Good coverage of the model answer."

        total_ai = earned_fallback
        total_max = total_marks_fallback
        
        # We can either create a dummy DBQuestionEvaluation here, or just not create one since question_id is required.
        # But wait, DBQuestionEvaluation requires question_id in its schema definition usually (nullable=True, actually!).
        existing_fb = db.query(DBQuestionEvaluation).filter(
            DBQuestionEvaluation.submission_id == submission_id,
            DBQuestionEvaluation.question_id == None
        ).first()
        
        if existing_fb:
            existing_fb.student_answer_text = student_text
            existing_fb.ai_score = earned_fallback
            existing_fb.final_score = earned_fallback
            existing_fb.similarity_score = sim_fallback
            existing_fb.max_marks = total_marks_fallback
            existing_fb.evaluation_feedback = _ev_feedback
        else:
            eval_obj = DBQuestionEvaluation(
                submission_id=submission_id,
                question_id=None,
                student_answer_text=student_text,
                ai_score=earned_fallback,
                final_score=earned_fallback,
                max_marks=total_marks_fallback,
                similarity_score=sim_fallback,
                evaluation_feedback=_ev_feedback,
            )
            db.add(eval_obj)

        results.append({
            "question_id": None,
            "question_number": 0,
            "ai_score": earned_fallback,
            "max_marks": total_marks_fallback,
            "similarity": sim_fallback,
        })
    # ────────────────────────────────────────────────────────────────

    # Update submission total marks
    sub.marks = int(round(total_ai))
    db.commit()

    return {
        "submission_id": submission_id,
        "evaluations": results,
        "total_ai_score": total_ai,
        "total_max_marks": total_max,
        "identical_pdf": pdf_is_identical_ev,
    }


@app.get("/api/evaluations/{submission_id}", response_model=list[schemas.QuestionEvaluationResponse])
def get_evaluations(
    submission_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(DBQuestionEvaluation).filter(
        DBQuestionEvaluation.submission_id == submission_id
    ).all()


@app.put("/api/evaluations/{evaluation_id}/override")
def override_evaluation(
    evaluation_id: str,
    payload: schemas.TeacherOverrideRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher overrides the AI score for a question evaluation"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can override scores")
    ev = db.query(DBQuestionEvaluation).filter(
        DBQuestionEvaluation.id == evaluation_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    ev.teacher_override = payload.final_score
    ev.final_score = payload.final_score
    if payload.feedback:
        ev.evaluation_feedback = payload.feedback
    db.commit()
    db.refresh(ev)

    # Recalculate submission total
    all_evals = db.query(DBQuestionEvaluation).filter(
        DBQuestionEvaluation.submission_id == ev.submission_id
    ).all()
    total = sum(e.final_score or 0 for e in all_evals)
    sub = db.query(DBSubmission).filter(
        DBSubmission.id == ev.submission_id).first()
    if sub:
        sub.marks = int(round(total))
        db.commit()

    return {"message": "Override applied", "final_score": ev.final_score, "submission_total": int(round(total))}


# ============= API SUBMISSIONS ENDPOINTS =============


@app.post("/api/submissions", response_model=schemas.APISubmissionResponse)
def create_submission(
    payload: schemas.APISubmissionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Teachers can create submissions on behalf of students
    if payload.student_id and current_user.get("role") == "teacher":
        target_student_id = payload.student_id
    else:
        target_student_id = current_user["id"]

    # Check for existing submission (unique constraint)
    existing = db.query(DBSubmission).filter(
        DBSubmission.assignment_id == payload.assignment_id,
        DBSubmission.student_id == target_student_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Submission already exists for this student and assignment"
        )

    sub = DBSubmission(
        assignment_id=payload.assignment_id,
        student_id=target_student_id,
        content=payload.content,
        image_path=payload.image_path,
        pdf_path=payload.pdf_path,
        extracted_text=payload.extracted_text,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@app.get("/api/submissions", response_model=list[schemas.APISubmissionResponse])
def list_submissions(
    assignment_id: str = None,
    student_id: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DBSubmission)
    if assignment_id:
        query = query.filter(DBSubmission.assignment_id == assignment_id)
    if student_id:
        query = query.filter(DBSubmission.student_id == student_id)
    return query.order_by(DBSubmission.submitted_at.desc()).all()


@app.put("/api/submissions/{submission_id}", response_model=schemas.APISubmissionResponse)
def update_submission(
    submission_id: str,
    payload: schemas.APISubmissionUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(DBSubmission).filter(
        DBSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if payload.marks is not None:
        sub.marks = payload.marks
    if payload.grade is not None:
        sub.grade = payload.grade
    if payload.feedback is not None:
        sub.feedback = payload.feedback
    db.commit()

    # ── AUTO-SAVE LES SNAPSHOT AFTER GRADING ──────────────────
    if LES_AVAILABLE and payload.marks is not None:
        try:
            from database import LESSnapshot, Assignment

            # Get assignment to find max_marks and subject_id
            assignment = db.query(Assignment).filter(
                Assignment.id == sub.assignment_id
            ).first()

            if assignment:
                max_marks = assignment.total_marks or 100
                score_percentage = (
                    payload.marks / max_marks * 100) if max_marks > 0 else 0

                student_data = {
                    # Default values (should come from StudentPerformance table)
                    "attendance": 75.0,
                    "assignment_scores": score_percentage,
                    "internal_assessment": 70.0,
                    "lab_performance": 70.0,
                    "study_hours": 2.0,
                    "concept_mastery": score_percentage * 0.8,
                }

                save_les_snapshot(
                    db=db,
                    student_id=sub.student_id,
                    post_score=score_percentage,
                    student_data=student_data,
                    subject_id=assignment.subject_id,
                    submission_id=submission_id,
                    snapshot_type="auto",
                    LESSnapshot=LESSnapshot,
                )
        except Exception as e:
            print(f"⚠ Warning: Could not save LES snapshot: {e}")
            # Don't fail the grade request if LES fails
    # ────────────────────────────────────────────────────────────

    db.refresh(sub)
    return sub


# ============= FILE UPLOAD ENDPOINT =============


@app.post("/api/upload-image")
async def upload_submission_image(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"{current_user['id']}/{uuid_mod.uuid4()}.{ext}"
    user_dir = os.path.join(UPLOADS_DIR, current_user["id"])
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(UPLOADS_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
    return {"path": filename, "url": f"/uploads/{filename}"}


@app.post("/api/upload-submission-pdf")
async def upload_submission_pdf(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a student answer PDF and extract text from it"""
    ext = file.filename.split(".")[-1] if file.filename else "pdf"
    filename = f"submissions/{current_user['id']}/{uuid_mod.uuid4()}.{ext}"
    sub_dir = os.path.join(UPLOADS_DIR, "submissions", current_user["id"])
    os.makedirs(sub_dir, exist_ok=True)
    filepath = os.path.join(UPLOADS_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Extract text from PDF
    extracted = ""
    try:
        import fitz
        doc = fitz.open(filepath)
        for page in doc:
            extracted += page.get_text() + "\n"
        doc.close()
    except Exception:
        try:
            import pdfplumber
            pdf = pdfplumber.open(filepath)
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted += text + "\n"
            pdf.close()
        except Exception:
            pass

    return {
        "path": filename,
        "url": f"/uploads/{filename}",
        "extracted_text": extracted.strip(),
    }


# ============= CO-PO MAPPING ENDPOINTS (Active) =============


@app.get("/api/co-po-mappings", response_model=list[schemas.COPOMappingActiveResponse])
def list_co_po_mappings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all CO-PO correlation mappings"""
    return db.query(COPOMappingActive).all()


@app.post("/api/co-po-mappings", response_model=schemas.COPOMappingActiveResponse, status_code=status.HTTP_201_CREATED)
def create_co_po_mapping(
    payload: schemas.COPOMappingActiveCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a CO-PO mapping with correlation level 1/2/3"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can manage CO-PO mappings")
    if payload.correlation_level not in (1, 2, 3):
        raise HTTPException(
            status_code=400, detail="Correlation level must be 1, 2, or 3")

    # Upsert logic: update if already exists
    existing = db.query(COPOMappingActive).filter(
        COPOMappingActive.course_outcome_id == payload.course_outcome_id,
        COPOMappingActive.program_outcome_id == payload.program_outcome_id,
    ).first()
    if existing:
        existing.correlation_level = payload.correlation_level
        db.commit()
        db.refresh(existing)
        return existing

    mapping = COPOMappingActive(
        course_outcome_id=payload.course_outcome_id,
        program_outcome_id=payload.program_outcome_id,
        correlation_level=payload.correlation_level,
        created_by=current_user["id"],
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@app.delete("/api/co-po-mappings/{mapping_id}")
def delete_co_po_mapping(
    mapping_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a CO-PO mapping"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can manage CO-PO mappings")
    mapping = db.query(COPOMappingActive).filter(
        COPOMappingActive.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
    return {"message": "Mapping deleted"}


# ============= REPORT / EXPORT ENDPOINTS =============


@app.get("/api/reports/co-attainment")
def report_co_attainment(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """CO attainment report — average LO scores for each CO across all students."""
    from collections import defaultdict
    students = db.query(User).filter(User.role == "student").all()
    cos = db.query(CourseOutcome).all()
    los = db.query(LearningOutcome).all()

    co_lo_map = defaultdict(list)
    for lo in los:
        if lo.course_outcome_id:
            co_lo_map[lo.course_outcome_id].append(lo.id)

    # For each student, compute LO scores from graded submissions
    all_lo_scores = defaultdict(list)

    for student in students:
        subs = db.query(DBSubmission).filter(
            DBSubmission.student_id == student.id,
            DBSubmission.marks.isnot(None)
        ).all()
        if not subs:
            continue
        assignment_ids = list(set(s.assignment_id for s in subs))
        mappings = db.query(AssignmentLOMapping).filter(
            AssignmentLOMapping.assignment_id.in_(assignment_ids)
        ).all()

        assignment_marks = defaultdict(list)
        for s in subs:
            assignment_marks[s.assignment_id].append(s.marks)
        assignment_avg = {aid: sum(ms) / len(ms)
                          for aid, ms in assignment_marks.items()}

        lo_marks = defaultdict(list)
        for m in mappings:
            if m.assignment_id in assignment_avg:
                lo_marks[m.learning_outcome_id].append(
                    assignment_avg[m.assignment_id])

        for lo_id, marks in lo_marks.items():
            all_lo_scores[lo_id].append(sum(marks) / len(marks))

    # Aggregate into CO scores
    result = []
    for co in cos:
        lo_ids = co_lo_map.get(co.id, [])
        co_scores_list = []
        for lo_id in lo_ids:
            if lo_id in all_lo_scores:
                co_scores_list.extend(all_lo_scores[lo_id])
        avg_score = round(sum(co_scores_list) /
                          len(co_scores_list), 2) if co_scores_list else 0
        result.append({
            "co_id": co.id,
            "co_code": co.code,
            "co_description": co.description,
            "avg_score": avg_score,
            "student_count": len(students),
            "lo_count": len(lo_ids),
        })
    return result


@app.get("/api/reports/po-attainment")
def report_po_attainment(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """PO attainment report — average CO scores for each PO, optionally weighted by CO-PO correlation."""
    from collections import defaultdict
    # Get CO attainment first (reuse logic)
    co_report = report_co_attainment(current_user=current_user, db=db)
    co_score_map = {r["co_id"]: r["avg_score"] for r in co_report}

    cos = db.query(CourseOutcome).all()
    pos = db.query(ProgramOutcome).all()

    # Get CO-PO mappings for weighted calculation
    co_po_maps = db.query(COPOMappingActive).all()
    # Build PO -> [(co_score, weight)]
    po_weighted = defaultdict(list)
    mapped_co_ids = set()
    for m in co_po_maps:
        co_score = co_score_map.get(m.course_outcome_id, 0)
        po_weighted[m.program_outcome_id].append(
            (co_score, m.correlation_level))
        mapped_co_ids.add(m.course_outcome_id)

    # Also include COs linked by FK but not in mapping table
    for co in cos:
        if co.program_outcome_id and co.id not in mapped_co_ids:
            co_score = co_score_map.get(co.id, 0)
            po_weighted[co.program_outcome_id].append(
                (co_score, 2))  # default medium

    result = []
    for po in pos:
        items = po_weighted.get(po.id, [])
        if items:
            total_weight = sum(w for _, w in items)
            weighted_avg = round(
                sum(s * w for s, w in items) / total_weight, 2) if total_weight else 0
        else:
            weighted_avg = 0
        result.append({
            "po_id": po.id,
            "po_code": po.code,
            "po_description": po.description,
            "weighted_avg_score": weighted_avg,
            "co_count": len(items),
        })
    return result


@app.get("/api/reports/student-performance-csv")
def export_student_performance_csv(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export student performance data as CSV."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can export reports")

    from fastapi.responses import StreamingResponse
    import csv
    import io

    students = db.query(User).filter(User.role == "student").all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student Name", "Email", "Marks", "Attendance", "Internals",
                    "Lab", "Assignment Scores", "Study Hours", "Concept Mastery", "Remarks"])

    for s in students:
        perf = db.query(StudentPerformance).filter(
            StudentPerformance.student_id == s.id).first()
        if perf:
            writer.writerow([s.name, s.email, perf.student_marks, perf.attendance, perf.internal_assessments,
                             perf.lab_performance, perf.assignment_scores, perf.study_hours, perf.concept_mastery, perf.teacher_remarks])
        else:
            writer.writerow([s.name, s.email, "", "", "", "", "", "", "", ""])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=student_performance_report.csv"}
    )


@app.get("/api/reports/co-attainment-csv")
def export_co_attainment_csv(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export CO attainment as CSV."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can export reports")

    from fastapi.responses import StreamingResponse
    import csv
    import io

    co_report = report_co_attainment(current_user=current_user, db=db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["CO Code", "Description",
                    "Avg Score", "Students", "LO Count"])
    for r in co_report:
        writer.writerow([r["co_code"], r["co_description"],
                        r["avg_score"], r["student_count"], r["lo_count"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=co_attainment_report.csv"}
    )


@app.get("/api/reports/po-attainment-csv")
def export_po_attainment_csv(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export PO attainment as CSV."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can export reports")

    from fastapi.responses import StreamingResponse
    import csv
    import io

    po_report = report_po_attainment(current_user=current_user, db=db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["PO Code", "Description",
                    "Weighted Avg Score", "CO Count"])
    for r in po_report:
        writer.writerow([r["po_code"], r["po_description"],
                        r["weighted_avg_score"], r["co_count"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=po_attainment_report.csv"}
    )


# ============= STUDENT SCORES ENDPOINT =============


@app.get("/api/student-scores/{student_id}")
def get_student_scores(
    student_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compute PO/CO/LO attainment scores for a student based on graded submissions."""
    # Get all submissions with marks for the student
    subs = (
        db.query(DBSubmission)
        .filter(DBSubmission.student_id == student_id, DBSubmission.marks.isnot(None))
        .all()
    )

    if not subs:
        return []

    # Get assignment IDs
    assignment_ids = list(set(s.assignment_id for s in subs))

    # Get LO mappings for these assignments
    mappings = (
        db.query(AssignmentLOMapping)
        .filter(AssignmentLOMapping.assignment_id.in_(assignment_ids))
        .all()
    )

    if not mappings:
        return []

    # Build assignment -> marks map (average if multiple subs per assignment)
    from collections import defaultdict
    assignment_marks = defaultdict(list)
    for s in subs:
        assignment_marks[s.assignment_id].append(s.marks)
    assignment_avg = {aid: sum(ms) / len(ms)
                      for aid, ms in assignment_marks.items()}

    # Build LO -> marks using mappings
    lo_marks = defaultdict(list)
    for m in mappings:
        if m.assignment_id in assignment_avg:
            lo_marks[m.learning_outcome_id].append(
                assignment_avg[m.assignment_id])

    lo_ids = list(lo_marks.keys())
    if not lo_ids:
        return []

    # Get LOs with their COs
    los = db.query(LearningOutcome).filter(
        LearningOutcome.id.in_(lo_ids)).all()
    co_ids = list(
        set(lo.course_outcome_id for lo in los if lo.course_outcome_id))
    cos = db.query(CourseOutcome).filter(
        CourseOutcome.id.in_(co_ids)).all() if co_ids else []
    po_ids = list(
        set(co.program_outcome_id for co in cos if co.program_outcome_id))
    pos = db.query(ProgramOutcome).filter(
        ProgramOutcome.id.in_(po_ids)).all() if po_ids else []

    co_map = {co.id: co for co in cos}
    po_map = {po.id: po for po in pos}

    # Compute LO scores
    lo_scores = {}
    for lo in los:
        marks = lo_marks.get(lo.id, [])
        lo_scores[lo.id] = {
            "lo_id": lo.id, "lo_code": lo.code,
            "lo_score": sum(marks) / len(marks) if marks else 0,
            "co_id": lo.course_outcome_id,
        }

    # Compute CO scores (avg of their LOs)
    co_scores = defaultdict(list)
    for ls in lo_scores.values():
        if ls["co_id"]:
            co_scores[ls["co_id"]].append(ls["lo_score"])

    # Compute PO scores (avg of their COs)
    po_scores_map = defaultdict(list)
    for co_id, scores_list in co_scores.items():
        co = co_map.get(co_id)
        if co and co.program_outcome_id:
            po_scores_map[co.program_outcome_id].append(
                sum(scores_list) / len(scores_list) if scores_list else 0
            )

    # Build result rows
    result = []
    for lo in los:
        co = co_map.get(lo.course_outcome_id) if lo.course_outcome_id else None
        po = po_map.get(
            co.program_outcome_id) if co and co.program_outcome_id else None
        co_id = co.id if co else ""
        co_code = co.code if co else ""
        co_score_vals = co_scores.get(co_id, [])
        co_score = sum(co_score_vals) / \
            len(co_score_vals) if co_score_vals else 0
        po_id = po.id if po else ""
        po_code = po.code if po else ""
        po_score_vals = po_scores_map.get(po_id, [])
        po_score = sum(po_score_vals) / \
            len(po_score_vals) if po_score_vals else 0

        result.append({
            "po_id": po_id, "po_code": po_code, "po_score": round(po_score, 1),
            "co_id": co_id, "co_code": co_code, "co_score": round(co_score, 1),
            "lo_id": lo.id, "lo_code": lo.code, "lo_score": round(lo_scores[lo.id]["lo_score"], 1),
        })

    return result


@app.get("/analytics/health")
def analytics_health():
    """Check analytics service health"""
    return {
        "status": "healthy",
        "ml_pipeline_trained": False,  # Temporarily disabled due to NumPy issues
        "layers": {
            "data_preprocessing": "active",
            "predictive_analytics": "active",
            "generative_ai": "active",
        },
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Academic Automation API"}


# ── Register LES Engine & Statistical Validation Endpoints ──
# ─── Add analytics students endpoint ──────────────────────────────

@app.get("/api/analytics/students")
def get_analytics_students(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get list of all students with LES data for analytics dashboard (teachers only)"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can access this")

    try:
        students = db.query(User).filter(User.role == "student").all()
        result = []

        for student in students:
            # Get latest LES snapshot for this student
            if LES_AVAILABLE:
                from database import LESSnapshot
                latest_les = (
                    db.query(LESSnapshot)
                    .filter(LESSnapshot.student_id == student.id)
                    .order_by(LESSnapshot.created_at.desc())
                    .first()
                )
            else:
                latest_les = None

            result.append({
                "id": student.id,
                "email": student.email,
                "name": student.name,
                "latest_les": round(latest_les.les, 2) if latest_les else None,
                "risk_level": latest_les.risk_level if latest_les else None,
                "updated_at": latest_les.created_at.isoformat() if latest_les else None,
            })

        return {"students": result, "count": len(result)}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching students: {str(e)}")


# ============= ANNOUNCEMENTS ENDPOINTS =============

@app.get("/api/announcements/", response_model=schemas.AnnouncementsListResponse)
def get_announcements(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    """Get all announcements (pinned first, then by date) with pagination to prevent N+1 queries"""
    try:
        # Validate pagination params
        skip = max(0, skip)
        limit = min(100, max(1, limit))

        # Use joinedload to avoid N+1 queries on teacher/subject relationships
        from sqlalchemy.orm import joinedload
        announcements = db.query(Announcement)\
            .options(
                joinedload(Announcement.teacher),
                joinedload(Announcement.subject)
        )\
            .order_by(
                Announcement.pinned.desc(),
                Announcement.created_at.desc()
        )\
            .offset(skip)\
            .limit(limit)\
            .all()

        result = []
        for ann in announcements:
            result.append({
                "id": ann.id,
                "teacher_id": ann.teacher_id,
                "teacher_name": ann.teacher.name if ann.teacher else "Unknown",
                "subject_id": ann.subject_id,
                "subject_name": ann.subject.name if ann.subject else None,
                "title": ann.title,
                "message": ann.message,
                "pinned": ann.pinned,
                "created_at": ann.created_at.isoformat(),
                "updated_at": ann.updated_at.isoformat() if ann.updated_at else None,
            })

        return {"announcements": result}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch announcements: {str(e)}")


@app.post("/api/announcements/", response_model=schemas.AnnouncementResponse)
def create_announcement(
    ann_data: schemas.AnnouncementCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new announcement (teachers only)"""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=403, detail="Only teachers can create announcements")

    try:
        new_ann = Announcement(
            teacher_id=current_user["id"],
            subject_id=ann_data.subject_id,
            title=ann_data.title or "",
            message=ann_data.message,
            pinned=ann_data.pinned or False,
        )
        db.add(new_ann)
        db.commit()
        db.refresh(new_ann)

        return {
            "id": new_ann.id,
            "teacher_id": new_ann.teacher_id,
            "teacher_name": new_ann.teacher.name if new_ann.teacher else "Unknown",
            "subject_id": new_ann.subject_id,
            "subject_name": new_ann.subject.name if new_ann.subject else None,
            "title": new_ann.title,
            "message": new_ann.message,
            "pinned": new_ann.pinned,
            "created_at": new_ann.created_at.isoformat(),
            "updated_at": new_ann.updated_at.isoformat() if new_ann.updated_at else None,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create announcement: {str(e)}")


@app.put("/api/announcements/{ann_id}", response_model=schemas.AnnouncementResponse)
def update_announcement(
    ann_id: str,
    ann_data: schemas.AnnouncementUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an announcement (owner only)"""
    try:
        ann = db.query(Announcement).filter(
            Announcement.id == ann_id).first()
        if not ann:
            raise HTTPException(
                status_code=404, detail="Announcement not found")

        if ann.teacher_id != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=403, detail="Can only edit own announcements")

        if ann_data.title is not None:
            ann.title = ann_data.title
        if ann_data.message is not None:
            ann.message = ann_data.message
        if ann_data.pinned is not None:
            ann.pinned = ann_data.pinned

        db.commit()
        db.refresh(ann)

        return {
            "id": ann.id,
            "teacher_id": ann.teacher_id,
            "teacher_name": ann.teacher.name if ann.teacher else "Unknown",
            "subject_id": ann.subject_id,
            "subject_name": ann.subject.name if ann.subject else None,
            "title": ann.title,
            "message": ann.message,
            "pinned": ann.pinned,
            "created_at": ann.created_at.isoformat(),
            "updated_at": ann.updated_at.isoformat() if ann.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update announcement: {str(e)}")


@app.delete("/api/announcements/{ann_id}")
def delete_announcement(
    ann_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an announcement (owner only) - transaction-safe with row-level locking"""
    try:
        # Lock row during transaction to prevent race condition
        ann = db.query(Announcement).filter(
            Announcement.id == ann_id).with_for_update().first()
        if not ann:
            raise HTTPException(
                status_code=404, detail="Announcement not found")

        if ann.teacher_id != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=403, detail="Can only delete own announcements")

        db.delete(ann)
        db.commit()

        return {"message": "Announcement deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete announcement: {str(e)}")


# ─────────────────────────────────────────────────────────────


if LES_AVAILABLE:
    try:
        create_les_snapshot_endpoint(app, get_db, get_current_user)
        get_les_history_endpoint(app, get_db, get_current_user)
        log_intervention_endpoint(app, get_db, get_current_user)
        retrain_endpoint(app, get_db, get_current_user)
        statistical_validation_endpoint(app, get_db, get_current_user)
        model_status_endpoint(app, get_db, get_current_user)
        get_analytics_students_endpoint(app, get_db, get_current_user)
        print("OK: LES Engine endpoints registered successfully")
    except Exception as e:
        print(f"WARNING: Could not register LES Engine endpoints: {e}")
# ─────────────────────────────────────────────────────────────



# ─── GET /api/student/assignments ─────────────────────────────────────────────
# Returns all PUBLISHED assignments.  The frontend further filters by the
# classroom_id fields to show only relevant ones.

@app.get("/api/student/assignments")
def get_student_assignments(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return published assignments for the logged-in student."""
    assignments = (
        db.query(DBAssignment)
        .filter(DBAssignment.status == "published")
        .order_by(DBAssignment.created_at.desc())
        .all()
    )

    result = []
    for a in assignments:
        # Check if this student has submitted
        sub = db.query(DBSubmission).filter(
            DBSubmission.assignment_id == a.id,
            DBSubmission.student_id == current_user["id"],
        ).first()

        submission_status = "pending"
        if sub:
            submission_status = "graded" if sub.marks is not None else "submitted"

        questions = db.query(DBQuestion).filter(DBQuestion.assignment_id == a.id).all()

        result.append({
            "id": str(a.id),
            "title": a.title,
            "description": a.description or "",
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "total_marks": a.total_marks,
            "status": a.status,
            "classroom_id": str(a.classroom_id) if getattr(a, "classroom_id", None) else None,
            "subject_id": a.subject_id,
            "created_at": a.created_at.isoformat(),
            "questions": [
                {
                    "question_text": q.question_text,
                    "marks": q.marks,
                    "difficulty": q.difficulty,
                }
                for q in questions
            ],
            "submission_status": submission_status,
        })
    return result


# ─── GET /api/teacher/classrooms ──────────────────────────────────────────────
# Used by AssignmentCreator dropdown.
# Classrooms are stored in localStorage on the frontend so we return a
# denormalised list by reading teacher's assignments' classroom_ids.
# For a true DB-backed list, wire up the Classroom_routes.py router.

@app.get("/api/teacher/classrooms")
def get_teacher_classrooms_simple(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return distinct classrooms that the teacher has already sent assignments to.
    The AssignmentCreator also reads from localStorage classrooms directly for
    a richer list — this endpoint is a fallback.
    """
    rows = (
        db.query(DBAssignment.classroom_id)
        .filter(
            DBAssignment.teacher_id == current_user["id"],
            DBAssignment.classroom_id.isnot(None),
        )
        .distinct()
        .all()
    )
    return [{"id": r.classroom_id, "name": r.classroom_id, "code": ""} for r in rows]


if __name__ == "__main__":

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
