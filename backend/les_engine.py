"""
les_engine.py — Learning Efficiency Score Engine

Handles:
  1. LES computation from student data
  2. Snapshot persistence after every graded submission
  3. Post-intervention detection (feedback loop)
  4. Incremental ML retraining (warm_start)

Drop this file into backend/ and import from main.py
"""

import json
import os
import uuid
import pickle
import numpy as np
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

# ── Local imports (adjust paths to match your project) ────────
# These should already exist in your codebase
# from database import LESSnapshot, InterventionLog, ModelVersion, User, Submission

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────
# 1. LES CALCULATION
# ─────────────────────────────────────────────────────────────


def compute_les(
    pre_score: float,
    post_score: float,
    time_invested: float = 1.0,
) -> float:
    """
    Learning Efficiency Score formula:
        LES = (post_score - pre_score) / time_invested

    Normalized to 0-100. If there is no pre_score yet,
    LES defaults to the post_score scaled by 0.5.

    Args:
        pre_score:     average score before latest advisory plan (0-100)
        post_score:    score on the current/latest submission (0-100)
        time_invested: study hours logged; defaults to 1 to avoid division by zero

    Returns:
        float in [0, 100]
    """
    if time_invested <= 0:
        time_invested = 1.0

    if pre_score == 0:
        # First submission: baseline LES from raw score
        les = post_score * 0.5
    else:
        improvement = post_score - pre_score
        # Scale improvement into 0-100 range
        les = (improvement / time_invested) + 50  # 50 = neutral baseline

    return float(np.clip(les, 0, 100))


def compute_weighted_les(student_data: Dict[str, float]) -> float:
    """
    Weighted LES from all 7 student metrics.
    Mirrors the weight vector in your existing ml_models.py.

    student_data keys:
        student_marks, attendance, internal_assessment,
        lab_performance, assignment_scores, study_hours, concept_mastery
    """
    weights = {
        "student_marks":      0.25,
        "attendance":         0.10,
        "internal_assessment": 0.15,
        "lab_performance":    0.15,
        "assignment_scores":  0.20,
        "study_hours":        0.05,
        "concept_mastery":    0.10,
    }

    weighted_sum = 0.0
    total_weight = 0.0

    for key, w in weights.items():
        val = student_data.get(key, 0.0)
        weighted_sum += float(val) * w
        total_weight += w

    les = (weighted_sum / total_weight) if total_weight > 0 else 0.0
    return float(np.clip(les, 0, 100))


def classify_risk(les: float) -> str:
    """Classify risk level based on LES score."""
    if les >= 70:
        return "Low"
    elif les >= 40:
        return "Moderate"
    return "High"


# ─────────────────────────────────────────────────────────────
# 2. SNAPSHOT PERSISTENCE
# ─────────────────────────────────────────────────────────────

def save_les_snapshot(
    db: Session,
    student_id: str,
    post_score: float,
    student_data: Dict[str, float],
    subject_id: Optional[str] = None,
    submission_id: Optional[str] = None,
    snapshot_type: str = "auto",
    LESSnapshot=None,   # pass the SQLAlchemy model class
) -> Any:
    """
    Called after every graded submission.
    Computes LES relative to the student's previous snapshot and saves.

    Returns the created LESSnapshot ORM object.
    """
    # Import here to avoid circular imports — remove if you've sorted imports
    if LESSnapshot is None:
        from database import LESSnapshot

    # Find the student's most recent snapshot to get pre_score
    last_snapshot = (
        db.query(LESSnapshot)
        .filter(LESSnapshot.student_id == student_id)
        .order_by(LESSnapshot.created_at.desc())
        .first()
    )

    pre_score = last_snapshot.post_score if last_snapshot else 0.0
    time_invested = student_data.get("study_hours", 1.0) or 1.0

    les = compute_les(pre_score, post_score, time_invested)
    risk = classify_risk(les)

    snapshot = LESSnapshot(
        student_id=student_id,
        subject_id=subject_id,
        submission_id=submission_id,
        pre_score=pre_score,
        post_score=post_score,
        time_invested=time_invested,
        les=les,
        attendance=student_data.get("attendance", 0.0),
        assignment_scores=student_data.get("assignment_scores", 0.0),
        internal_assessment=student_data.get("internal_assessment", 0.0),
        lab_performance=student_data.get("lab_performance", 0.0),
        study_hours=student_data.get("study_hours", 0.0),
        concept_mastery=student_data.get("concept_mastery", 0.0),
        risk_level=risk,
        snapshot_type=snapshot_type,
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    # Trigger feedback loop check asynchronously (non-blocking)
    _check_and_trigger_feedback_loop(db, student_id, snapshot, subject_id)

    return snapshot


def get_les_history(
    db,
    student_id: str,
    subject_id: Optional[str] = None,
    limit: int = 20,
    LESSnapshot=None,
) -> List[Dict]:
    """
    Returns the LES history for a student, most recent first.
    Suitable for charting on the frontend.
    """
    if LESSnapshot is None:
        from database import LESSnapshot

    query = (
        db.query(LESSnapshot)
        .filter(LESSnapshot.student_id == student_id)
    )
    if subject_id:
        query = query.filter(LESSnapshot.subject_id == subject_id)

    snapshots = query.order_by(
        LESSnapshot.created_at.desc()).limit(limit).all()

    return [
        {
            "id": s.id,
            "les": round(s.les, 2),
            "pre_score": round(s.pre_score, 2),
            "post_score": round(s.post_score, 2),
            "risk_level": s.risk_level,
            "snapshot_type": s.snapshot_type,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        # reverse so frontend gets chronological order
        for s in reversed(snapshots)
    ]


# ─────────────────────────────────────────────────────────────
# 3. FEEDBACK LOOP — POST-INTERVENTION DETECTION
# ─────────────────────────────────────────────────────────────

def log_intervention(
    db: Session,
    student_id: str,
    les_at_intervention: float,
    risk_at_intervention: str,
    weak_concepts: List[str],
    advisory_plan: str,
    subject_id: Optional[str] = None,
    InterventionLog=None,
) -> Any:
    """
    Call this every time an advisory plan is generated for a student.
    Logs the event so the feedback loop can detect follow-up submissions.
    """
    if InterventionLog is None:
        from database import InterventionLog

    log = InterventionLog(
        student_id=student_id,
        subject_id=subject_id,
        les_at_intervention=les_at_intervention,
        risk_at_intervention=risk_at_intervention,
        weak_concepts=json.dumps(weak_concepts),
        advisory_plan=advisory_plan,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def _check_and_trigger_feedback_loop(
    db: Session,
    student_id: str,
    new_snapshot,
    subject_id: Optional[str],
):
    """
    Internal: called after every new LES snapshot.
    Checks if there's an unresolved intervention for this student.
    If yes: marks it as followed-up and triggers ML retraining.
    """
    try:
        from database import InterventionLog
    except ImportError:
        return

    # Find the most recent unresolved intervention for this student
    intervention = (
        db.query(InterventionLog)
        .filter(
            InterventionLog.student_id == student_id,
            InterventionLog.followed_up == False,
        )
        .order_by(InterventionLog.created_at.desc())
        .first()
    )

    if intervention is None:
        return

    # Mark it as followed up
    improvement_pct = 0.0
    if intervention.les_at_intervention > 0:
        improvement_pct = (
            (new_snapshot.les - intervention.les_at_intervention)
            / intervention.les_at_intervention
        ) * 100

    intervention.followed_up = True
    intervention.followup_les = new_snapshot.les
    intervention.improvement_pct = round(improvement_pct, 2)
    intervention.followup_at = datetime.utcnow()
    db.commit()

    # Trigger incremental ML retraining
    _incremental_retrain(db, triggered_by=student_id)


# ─────────────────────────────────────────────────────────────
# 4. INCREMENTAL ML RETRAINING (FEEDBACK LOOP)
# ─────────────────────────────────────────────────────────────

def _build_training_data(db, LESSnapshot=None) -> Tuple[np.ndarray, np.ndarray]:
    """Builds X, y arrays from all LES snapshots in the DB."""
    if LESSnapshot is None:
        from database import LESSnapshot

    snapshots = db.query(LESSnapshot).all()

    if len(snapshots) < 5:
        return np.array([]), np.array([])

    X = np.array([
        [
            s.post_score,
            s.attendance,
            s.internal_assessment,
            s.lab_performance,
            s.assignment_scores,
            s.study_hours,
            s.concept_mastery,
        ]
        for s in snapshots
    ])

    y = np.array([s.les for s in snapshots])
    return X, y


def _incremental_retrain(
    db: Session,
    triggered_by: str = "system",
    ModelVersion=None,
):
    """
    Incrementally retrains the RandomForest model using warm_start.
    warm_start=True adds more trees to the existing forest instead of
    rebuilding from scratch — much faster and preserves prior learning.

    Saves new model to disk and logs a ModelVersion record.
    """
    if ModelVersion is None:
        try:
            from database import ModelVersion
        except ImportError:
            return

    try:
        from database import LESSnapshot
        X, y = _build_training_data(db, LESSnapshot)
    except Exception:
        return

    if len(X) < 5:
        print("[LES Engine] Not enough data for retraining (need ≥5 snapshots)")
        return

    # ── Load existing model or create new one ─────────────────
    active_version = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active == True)
        .order_by(ModelVersion.created_at.desc())
        .first()
    )

    model_path = (
        active_version.model_path
        if active_version and os.path.exists(active_version.model_path)
        else None
    )

    if model_path:
        with open(model_path, "rb") as f:
            rf_model = pickle.load(f)
        # Increment estimators for warm_start
        rf_model.n_estimators += 10
        rf_model.warm_start = True
    else:
        rf_model = RandomForestRegressor(
            n_estimators=50,
            warm_start=True,
            random_state=42,
            n_jobs=-1,
        )

    # ── Train ─────────────────────────────────────────────────
    rf_model.fit(X, y)

    # ── Evaluate ──────────────────────────────────────────────
    y_pred = rf_model.predict(X)
    r2 = float(r2_score(y, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
    mae = float(mean_absolute_error(y, y_pred))

    cv_scores = cross_val_score(
        rf_model, X, y, cv=min(5, len(X)), scoring="r2")
    cv_mean = float(np.mean(cv_scores))

    # ── Get next version number ────────────────────────────────
    last_version = (
        db.query(ModelVersion)
        .order_by(ModelVersion.version_number.desc())
        .first()
    )
    next_version_num = (last_version.version_number + 1) if last_version else 1

    # ── Save model to disk ────────────────────────────────────
    new_model_path = os.path.join(
        MODELS_DIR, f"les_model_v{next_version_num}.pkl")
    with open(new_model_path, "wb") as f:
        pickle.dump(rf_model, f)

    # ── Deactivate previous versions ──────────────────────────
    db.query(ModelVersion).update({"is_active": False})
    db.commit()

    # ── Log new version ───────────────────────────────────────
    version = ModelVersion(
        version_number=next_version_num,
        model_type="random_forest",
        trigger="auto_post_intervention",
        r_squared=round(r2, 4),
        rmse=round(rmse, 4),
        mae=round(mae, 4),
        training_samples=len(X),
        cross_val_score=round(cv_mean, 4),
        model_path=new_model_path,
        triggered_by=triggered_by,
        notes=f"Warm-start retrain. n_estimators={rf_model.n_estimators}",
        is_active=True,
    )
    db.add(version)
    db.commit()

    print(
        f"[LES Engine] Retrain complete → v{next_version_num} | R²={r2:.3f} | RMSE={rmse:.3f} | CV={cv_mean:.3f}")
    return version


def manual_retrain(db: Session, triggered_by: str = "teacher") -> Dict:
    """
    Public function for the POST /analytics/retrain endpoint.
    Returns a dict summarising the new model version.
    """
    try:
        from database import ModelVersion
        version = _incremental_retrain(
            db, triggered_by=triggered_by, ModelVersion=ModelVersion)
    except Exception as e:
        return {"error": str(e)}

    if version is None:
        return {"error": "Not enough data (need ≥5 LES snapshots)"}

    return {
        "version": version.version_number,
        "r_squared": version.r_squared,
        "rmse": version.rmse,
        "mae": version.mae,
        "cross_val_score": version.cross_val_score,
        "training_samples": version.training_samples,
        "model_path": version.model_path,
    }
