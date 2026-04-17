"""
Statistical Validation Engine

Computes post-intervention effectiveness metrics:
  - Paired t-test (pre vs post LES)
  - Cohen's d (effect size)
  - R² and RMSE on LES predictions
  - Per-student improvement summary
  - Confidence intervals and distribution histograms

Usage:
    from statistical_validation import run_statistical_validation, evaluate_current_model
    
    result = run_statistical_validation(db, subject_id="subj001")
    model_metrics = evaluate_current_model(db)
"""

import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session


def safe_float(val):
    """Convert numpy/scipy values to safe JSON-serializable Python floats"""
    if val is None:
        return None
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


# ─────────────────────────────────────────────────────────────
# COHEN'S D - EFFECT SIZE CALCULATION
# ─────────────────────────────────────────────────────────────

def cohens_d(group1: List[float], group2: List[float]) -> float:
    """
    Computes Cohen's d effect size between two groups.

    d = (mean1 - mean2) / pooled_std

    Interpretation:
        |d| < 0.2  → negligible
        |d| < 0.5  → small
        |d| < 0.8  → medium
        |d| >= 0.8 → large

    Args:
        group1: First group of measurements (e.g., post-LES scores)
        group2: Second group of measurements (e.g., pre-LES scores)

    Returns:
        Cohen's d statistic (float)
    """
    n1, n2 = len(group1), len(group2)
    if n1 < 2 or n2 < 2:
        return 0.0

    mean1, mean2 = np.mean(group1), np.mean(group2)
    var1,  var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)

    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    if pooled_std == 0:
        return 0.0

    return float((mean1 - mean2) / pooled_std)


def interpret_cohens_d(d: float) -> str:
    """
    Interprets Cohen's d magnitude.

    Args:
        d: Cohen's d value

    Returns:
        String interpretation: "negligible", "small", "medium", or "large"
    """
    abs_d = abs(d)
    if abs_d < 0.2:
        return "negligible"
    elif abs_d < 0.5:
        return "small"
    elif abs_d < 0.8:
        return "medium"
    return "large"


def interpret_pvalue(p: float) -> str:
    """
    Interprets p-value from statistical test.

    Args:
        p: p-value from hypothesis test

    Returns:
        String interpretation with significance level
    """
    if p < 0.001:
        return "highly significant (p < 0.001)"
    elif p < 0.01:
        return "very significant (p < 0.01)"
    elif p < 0.05:
        return "significant (p < 0.05)"
    return "not significant (p ≥ 0.05)"


# ─────────────────────────────────────────────────────────────
# MAIN VALIDATION FUNCTION
# ─────────────────────────────────────────────────────────────

def run_statistical_validation(
    db: Session,
    subject_id: Optional[str] = None,
    LESSnapshot=None,
    InterventionLog=None,
) -> Dict:
    """
    Runs full statistical validation on all intervention data.

    Computes:
      - Paired t-test comparing pre vs post LES scores
      - Cohen's d effect size
      - Descriptive statistics (means, std devs)
      - Model fit (R², RMSE, linear regression)
      - 95% confidence interval for mean improvement
      - Histogram distribution of LES scores
      - Per-student improvement breakdown

    Args:
        db: SQLAlchemy Session
        subject_id: Optional filter for specific subject
        LESSnapshot: Optional reference to LESSnapshot model (for testing)
        InterventionLog: Optional reference to InterventionLog model (for testing)

    Returns:
        Dict with comprehensive statistical analysis:
            {
                "sample_size": int,
                "paired_ttest": {"t_statistic", "p_value", "interpretation", "significant"},
                "cohens_d": {"value", "magnitude", "interpretation"},
                "group_stats": {"pre_mean", "post_mean", "pre_std", "post_std", "mean_improvement"},
                "model_fit": {"r_squared", "rmse", "slope"},
                "confidence_interval_95": {"lower", "upper", "label"},
                "histogram": [{"range", "pre_count", "post_count"}, ...],
                "improvement_summary": [{"student_id", "pre_les", "post_les", "improvement_pct", ...}, ...],
            }
    """

    if LESSnapshot is None:
        from database import LESSnapshot
    if InterventionLog is None:
        from database import InterventionLog

    # ── Collect pre/post pairs from intervention logs ──────────
    query = (
        db.query(InterventionLog)
        .filter(InterventionLog.followed_up == True)
    )

    if subject_id:
        query = query.filter(InterventionLog.subject_id == subject_id)

    interventions = query.all()

    if len(interventions) < 3:
        return {
            "error": "Not enough intervention data for statistical analysis",
            "minimum_required": 3,
            "current_count": len(interventions),
            "hint": "Generate study plans for students and wait for them to submit new work.",
        }

    # Ensure paired (same length - only use interventions with followup_les)
    paired_pre = [
        iv.les_at_intervention for iv in interventions if iv.followup_les is not None]
    paired_post = [
        iv.followup_les for iv in interventions if iv.followup_les is not None]

    if len(paired_pre) < 3:
        return {
            "error": "Not enough completed follow-ups",
            "minimum_required": 3,
            "current_count": len(paired_pre),
            "hint": "Interventions need follow-up submissions to measure effectiveness.",
        }

    # ── Paired t-test (pre vs post LES) ───────────────────────
    # H0: no difference between pre and post
    # H1: post differs from pre (improvement)
    t_stat, p_value = stats.ttest_rel(paired_post, paired_pre)

    # ── Cohen's d (effect size) ──────────────────────────────
    d = cohens_d(paired_post, paired_pre)

    # ── Descriptive statistics ────────────────────────────────
    pre_mean = float(np.mean(paired_pre))
    post_mean = float(np.mean(paired_post))
    pre_std = float(np.std(paired_pre,  ddof=1))
    post_std = float(np.std(paired_post, ddof=1))

    # ── RMSE between pre and post (improvement magnitude) ──────
    rmse = float(
        np.sqrt(np.mean((np.array(paired_post) - np.array(paired_pre)) ** 2)))

    # ── R² of improvement trend (linear model fit) ────────────
    # Fits a linear regression: post_les ~ pre_les
    # High R² means improvement is predictable from baseline
    try:
        slope, intercept, r_value, _, _ = stats.linregress(
            paired_pre, paired_post)
        r_squared = float(r_value ** 2)
    except Exception:
        r_squared = 0.0
        slope = 0.0
        intercept = 0.0

    # ── Per-student improvement summary ───────────────────────
    improvement_summary = []
    for iv in interventions:
        if iv.followup_les is None:
            continue
        improvement_summary.append({
            "student_id":       iv.student_id,
            "pre_les":          round(iv.les_at_intervention, 2),
            "post_les":         round(iv.followup_les, 2),
            "improvement_pct":  round(iv.improvement_pct or 0.0, 2),
            "risk_before":      iv.risk_at_intervention,
            "intervention_date": iv.created_at.isoformat() if iv.created_at else None,
            "followup_date":    iv.followup_at.isoformat() if iv.followup_at else None,
        })

    # Sort by improvement descending (best performers first)
    improvement_summary.sort(key=lambda x: x["improvement_pct"], reverse=True)

    # ── Histogram bins for LES distribution (for charts) ──────
    # Buckets: 0-10, 10-20, ..., 100-110
    bins = list(range(0, 110, 10))
    pre_hist,  _ = np.histogram(paired_pre,  bins=bins)
    post_hist, _ = np.histogram(paired_post, bins=bins)

    histogram = [
        {
            "range":    f"{bins[i]}–{bins[i+1]}",
            "pre_count":  int(pre_hist[i]),
            "post_count": int(post_hist[i]),
        }
        for i in range(len(pre_hist))
    ]

    # ── 95% Confidence Interval for mean improvement ────────────
    # Shows range where true population improvement likely falls
    improvements = [p - pr for p, pr in zip(paired_post, paired_pre)]
    ci = stats.t.interval(
        0.95,
        df=len(improvements) - 1,
        loc=np.mean(improvements),
        scale=stats.sem(improvements),
    )

    return {
        "sample_size": len(paired_pre),

        "paired_ttest": {
            "t_statistic":    safe_float(t_stat),
            "p_value":        safe_float(p_value),
            "interpretation": interpret_pvalue(p_value),
            "significant":    bool(p_value < 0.05) if not np.isnan(p_value) else False,
            "description": "Tests whether post-intervention LES differs from pre-intervention LES",
        },

        "cohens_d": {
            "value":          safe_float(round(d, 4)) if d is not None else None,
            "magnitude":      interpret_cohens_d(d),
            "interpretation": f"Effect size is {interpret_cohens_d(d)} ({'+' if d > 0 else ''}{d:.2f})" if d is not None else "N/A",
            "description": "Standardized measure of intervention impact, independent of sample size",
        },

        "group_stats": {
            "pre_mean":  safe_float(round(pre_mean, 2)),
            "post_mean": safe_float(round(post_mean, 2)),
            "pre_std":   safe_float(round(pre_std, 2)),
            "post_std":  safe_float(round(post_std, 2)),
            "mean_improvement": safe_float(round(post_mean - pre_mean, 2)),
        },

        "model_fit": {
            "r_squared": safe_float(round(r_squared, 4)) if r_squared is not None else None,
            "rmse":      safe_float(round(rmse, 4)) if rmse is not None else None,
            "slope":     safe_float(round(float(slope), 4)) if slope is not None else None,
            "description": "Linear regression: post_les ~ pre_les. Higher R² means improvement is more predictable.",
        },

        "confidence_interval_95": {
            "lower": safe_float(ci[0]),
            "upper": safe_float(ci[1]),
            "label": f"95% CI for mean improvement: [{safe_float(ci[0]) or 'N/A'}, {safe_float(ci[1]) or 'N/A'}]",
            "description": "Range where the true population mean improvement is likely to fall (95% confidence)",
        },

        "histogram": histogram,
        "improvement_summary": improvement_summary,
    }


# ─────────────────────────────────────────────────────────────
# QUICK MODEL EVALUATION (for analytics dashboard)
# ─────────────────────────────────────────────────────────────

def evaluate_current_model(db: Session, ModelVersion=None) -> Dict:
    """
    Returns metrics for the currently active ML model version.

    Used by analytics dashboard to show current model performance.

    Args:
        db: SQLAlchemy Session
        ModelVersion: Optional reference to ModelVersion model (for testing/dependency injection)

    Returns:
        Dict with active model metrics or error status:
            {
                "version": int,
                "model_type": str,
                "r_squared": float,
                "rmse": float,
                "mae": float,
                "cross_val_score": float,
                "training_samples": int,
                "trigger": str,
                "trained_at": str (ISO format),
            }
    """
    if ModelVersion is None:
        try:
            from database import ModelVersion
        except ImportError:
            return {}

    active = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active == True)
        .order_by(ModelVersion.created_at.desc())
        .first()
    )

    if active is None:
        return {
            "status": "no_model",
            "message": "No trained model found. Run POST /analytics/retrain first.",
            "hint": "Use:  curl -X POST http://localhost:8000/analytics/retrain",
        }

    return {
        "version":          active.version_number,
        "model_type":       active.model_type,
        "r_squared":        round(active.r_squared, 4) if active.r_squared else None,
        "rmse":             round(active.rmse, 4) if active.rmse else None,
        "mae":              round(active.mae, 4) if active.mae else None,
        "cross_val_score":  round(active.cross_val_score, 4) if active.cross_val_score else None,
        "training_samples": active.training_samples,
        "trigger":          active.trigger,
        "triggered_by":     active.triggered_by,
        "trained_at":       active.created_at.isoformat() if active.created_at else None,
        "notes":            active.notes,
    }
