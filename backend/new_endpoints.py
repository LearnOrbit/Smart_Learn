"""
New Analytics Endpoints for LES Engine & Statistical Validation

Provides:
  - POST /analytics/les-snapshot          → save LES after grading
  - GET  /students/{student_id}/les-history → LES trend data
  - POST /analytics/log-intervention      → log study plan generation
  - POST /analytics/retrain               → trigger ML retraining
  - GET  /analytics/statistical-validation → t-test, Cohen's d, etc.
  - GET  /analytics/model-status          → current model version info

See main.py integration instructions at bottom of this file.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional


# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS (add to schemas.py)
# ─────────────────────────────────────────────────────────────

class LESSnapshotCreate(BaseModel):
    student_id: str
    subject_id: Optional[str] = None
    submission_id: Optional[str] = None
    post_score: float
    student_data: dict       # keys: attendance, assignment_scores, etc.
    snapshot_type: str = "auto"


class LESSnapshotResponse(BaseModel):
    id: str
    les: float
    pre_score: float
    post_score: float
    risk_level: str
    created_at: str

    class Config:
        from_attributes = True


class InterventionLogCreate(BaseModel):
    student_id: str
    subject_id: Optional[str] = None
    les_at_intervention: float
    risk_at_intervention: str
    weak_concepts: List[str]
    advisory_plan: str


class InterventionLogResponse(BaseModel):
    id: str
    student_id: str
    les_at_intervention: float
    created_at: str

    class Config:
        from_attributes = True


class RetrainResponse(BaseModel):
    version: Optional[int] = None
    r_squared: Optional[float] = None
    rmse: Optional[float] = None
    mae: Optional[float] = None
    cross_val_score: Optional[float] = None
    training_samples: Optional[int] = None
    error: Optional[str] = None


class LESHistoryResponse(BaseModel):
    student_id: str
    history: List[dict]


class ModelStatusResponse(BaseModel):
    version: Optional[int] = None
    model_type: Optional[str] = None
    r_squared: Optional[float] = None
    rmse: Optional[float] = None
    mae: Optional[float] = None
    cross_val_score: Optional[float] = None
    training_samples: Optional[int] = None
    trigger: Optional[str] = None
    trained_at: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# ENDPOINT REGISTRATION FUNCTIONS
# ─────────────────────────────────────────────────────────────

def create_les_snapshot_endpoint(app, get_db, get_current_user):
    """Registers POST /api/analytics/les-snapshot"""
    @app.post("/api/analytics/les-snapshot", response_model=LESSnapshotResponse)
    def create_les_snapshot(
        payload: LESSnapshotCreate,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Save a Learning Efficiency Score snapshot for a student.
        Called automatically after every graded submission.
        Also manually callable by teacher.

        **Process:**
        1. Computes LES from student data
        2. Saves to les_snapshots table
        3. Triggers feedback loop detection
        4. May trigger incremental ML retraining
        """
        from les_engine import save_les_snapshot
        from database import LESSnapshot

        snapshot = save_les_snapshot(
            db=db,
            student_id=payload.student_id,
            post_score=payload.post_score,
            student_data=payload.student_data,
            subject_id=payload.subject_id,
            submission_id=payload.submission_id,
            snapshot_type=payload.snapshot_type,
            LESSnapshot=LESSnapshot,
        )

        return {
            "id": snapshot.id,
            "les": round(snapshot.les, 2),
            "pre_score": round(snapshot.pre_score, 2) if snapshot.pre_score else 0,
            "post_score": round(snapshot.post_score, 2),
            "risk_level": snapshot.risk_level,
            "created_at": snapshot.created_at.isoformat(),
        }


def get_les_history_endpoint(app, get_db, get_current_user):
    """Registers GET /api/students/{student_id}/les-history"""
    @app.get("/api/students/{student_id}/les-history", response_model=LESHistoryResponse)
    def get_student_les_history(
        student_id: str,
        subject_id: Optional[str] = None,
        limit: int = 20,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Returns chronological LES history for a student.
        Used to render the trend chart on the frontend.

        **Response:**
        - Sorted by timestamp (oldest first)
        - Limited to most recent N snapshots
        - Includes: les, risk_level, pre_score, post_score, created_at
        """
        from les_engine import get_les_history
        from database import LESSnapshot

        history = get_les_history(
            db=db,
            student_id=student_id,
            subject_id=subject_id,
            limit=limit,
            LESSnapshot=LESSnapshot,
        )

        return {"student_id": student_id, "history": history}


def log_intervention_endpoint(app, get_db, get_current_user):
    """Registers POST /api/analytics/log-intervention"""
    @app.post("/api/analytics/log-intervention", response_model=InterventionLogResponse)
    def log_student_intervention(
        payload: InterventionLogCreate,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Log an advisory plan event (study plan generation).

        **CRITICAL:** Must be called every time /analytics/advisory-plan is called.
        This is what enables the feedback loop to detect follow-ups and measure intervention effectiveness.

        **Flow:**
        1. Save intervention record with current LES and risk level
        2. When student resubmits: new snapshot triggers feedback loop detection
        3. If improvement detected: mark as followed_up + trigger ML retrain
        """
        from les_engine import log_intervention
        from database import InterventionLog

        log = log_intervention(
            db=db,
            student_id=payload.student_id,
            les_at_intervention=payload.les_at_intervention,
            risk_at_intervention=payload.risk_at_intervention,
            weak_concepts=payload.weak_concepts,
            advisory_plan=payload.advisory_plan,
            subject_id=payload.subject_id,
            InterventionLog=InterventionLog,
        )

        return {
            "id": log.id,
            "student_id": log.student_id,
            "les_at_intervention": log.les_at_intervention,
            "created_at": log.created_at.isoformat(),
        }


def retrain_endpoint(app, get_db, get_current_user):
    """Registers POST /api/analytics/retrain"""
    @app.post("/api/analytics/retrain", response_model=RetrainResponse)
    def trigger_retrain(
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Manually trigger an incremental ML model retrain.

        **Access:** Teachers only (other roles get 403)

        **Process:**
        1. Load existing RandomForest model
        2. Add 10 more decision trees (warm_start=True)
        3. Retrain on all historical + new data
        4. Evaluate: R², RMSE, cross-validation score
        5. Save new ModelVersion record with metrics

        **Also triggered automatically by:**
        - Feedback loop when post-intervention improvement detected
        """
        if current_user.get("role") != "teacher":
            raise HTTPException(status_code=403, detail="Teachers only")

        from les_engine import manual_retrain
        result = manual_retrain(db=db, triggered_by=current_user["id"])
        return result


def statistical_validation_endpoint(app, get_db, get_current_user):
    """Registers GET /api/analytics/statistical-validation"""
    @app.get("/api/analytics/statistical-validation")
    def get_statistical_validation(
        subject_id: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Returns full statistical validation of intervention effectiveness.

        **Requirements:**
        - ≥3 interventions with followup submissions (post-intervention)

        **Returns:**
        - Paired t-test (t-statistic, p-value, interpretation)
        - Cohen's d effect size (value, magnitude)
        - Descriptive statistics (pre/post means, std devs)
        - R² and RMSE (model fit)
        - 95% confidence interval for mean improvement
        - Histogram of LES distribution
        - Per-student improvement breakdown (sorted by improvement_pct desc)

        **Interpretation Guide:**
        - p-value < 0.05 → Statistically significant improvement
        - Cohen's d > 0.3 → Practically meaningful effect (education)
        - CI narrow → Precise estimate; wide → uncertain estimate
        """
        try:
            from statistical_validation import run_statistical_validation
            result = run_statistical_validation(db=db, subject_id=subject_id)
            print(
                f"DEBUG: run_statistical_validation returned: {type(result)}")
            return result
        except Exception as e:
            import traceback
            print(f"ERROR in statistical_validation endpoint: {e}")
            print(traceback.format_exc())
            raise


def model_status_endpoint(app, get_db, get_current_user):
    """Registers GET /api/analytics/model-status"""
    @app.get("/api/analytics/model-status", response_model=ModelStatusResponse)
    def get_model_status(
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Returns info about the currently active ML model version.

        **Returns:**
        - version: Model version number
        - model_type: "RandomForest"
        - r_squared: Model accuracy (0-1)
        - rmse: Prediction error
        - mae: Mean absolute error
        - cross_val_score: Cross-validation performance
        - training_samples: Number of records used
        - trigger: What caused this version (e.g., "manual", "post_intervention_feedback_loop")
        - trained_at: When model was last retrained

        **Or error status if no model trained:**
        - status: "no_model"
        - message: "No trained model found. Run POST /analytics/retrain first."
        """
        from statistical_validation import evaluate_current_model
        return evaluate_current_model(db=db)


def get_analytics_students_endpoint(app, get_db, get_current_user):
    """Registers GET /api/analytics/students"""
    @app.get("/api/analytics/students")
    def get_students(
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ):
        """
        Get list of all students for LES Analytics dashboard.

        **Access:** Teachers only

        **Returns:**
        - List of students with basic info:
            - id: Student ID
            - email: Student email
            - name: Student name
            - latest_les: Most recent LES score (if available)
            - risk_level: Current risk level (if available)
            - updated_at: When data was last updated
        """
        if current_user.get("role") != "teacher":
            raise HTTPException(status_code=403, detail="Teachers only")

        try:
            from database import User, LESSnapshot

            students = db.query(User).filter(User.role == "student").all()

            result = []
            for student in students:
                # Get latest LES snapshot for this student
                latest_les = (
                    db.query(LESSnapshot)
                    .filter(LESSnapshot.student_id == student.id)
                    .order_by(LESSnapshot.created_at.desc())
                    .first()
                )

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


# ─────────────────────────────────────────────────────────────
# INTEGRATION INSTRUCTIONS FOR main.py
# ─────────────────────────────────────────────────────────────

"""
STEP 1: Add imports at top of main.py

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
    )
    from schemas import (
        LESSnapshotCreate, LESSnapshotResponse,
        InterventionLogCreate, InterventionLogResponse,
        RetrainResponse, LESHistoryResponse, ModelStatusResponse,
    )


STEP 2: Register all endpoints

    Add this block near the bottom of main.py, after all existing endpoint definitions:

    # ── Register LES & Statistical Validation Endpoints ──────
    create_les_snapshot_endpoint(app, get_db, get_current_user)
    get_les_history_endpoint(app, get_db, get_current_user)
    log_intervention_endpoint(app, get_db, get_current_user)
    retrain_endpoint(app, get_db, get_current_user)
    statistical_validation_endpoint(app, get_db, get_current_user)
    model_status_endpoint(app, get_db, get_current_user)
    # ─────────────────────────────────────────────────────────


STEP 3: Patch existing grade submission endpoint

    Find your grade submission endpoint (e.g., PUT /submissions/{id} or similar).
    After db.commit() where you save the grade, add:

    # AUTO-SAVE LES SNAPSHOT AFTER GRADING
    try:
        from database import LESSnapshot
        
        student_data = {
            "attendance":          float(submission.student_attendance or 0),
            "assignment_scores":   score_percentage,  # marks_obtained / max_marks * 100
            "internal_assessment": float(submission.student_internal_assessment or 0),
            "lab_performance":     float(submission.student_lab_performance or 0),
            "study_hours":         float(submission.student_study_hours or 1),
            "concept_mastery":     float(submission.student_concept_mastery or 0),
        }

        save_les_snapshot(
            db=db,
            student_id=submission.student_id,
            post_score=score_percentage,
            student_data=student_data,
            subject_id=assignment.subject_id,
            submission_id=submission.id,
            LESSnapshot=LESSnapshot,
        )
    except Exception as e:
        print(f"Warning: Could not save LES snapshot: {e}")
        # Don't fail the grade request if LES fails


STEP 4: Patch existing advisory plan endpoint

    Find your advisory plan generation endpoint (likely /analytics/advisory-plan).
    After generating the study plan, add:

    # LOG INTERVENTION FOR FEEDBACK LOOP
    try:
        from database import InterventionLog
        
        log_intervention(
            db=db,
            student_id=student.id,
            les_at_intervention=current_les,  # LES score at time of intervention
            risk_at_intervention=risk_level,   # e.g., "High", "Moderate", "Low"
            weak_concepts=request.weak_concepts,  # List of weak areas
            advisory_plan=plan,                    # The generated study plan text
            subject_id=getattr(request, "subject_id", None),
            InterventionLog=InterventionLog,
        )
    except Exception as e:
        print(f"Warning: Could not log intervention: {e}")
        # Don't fail the advisory request if logging fails
"""
