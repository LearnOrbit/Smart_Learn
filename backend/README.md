# Academic Process Automation - FastAPI Backend

FastAPI backend for the Hybrid AI-Based Academic Process Automation System.

## Features

- **SQLAlchemy ORM** with PostgreSQL database
- **3NF Normalized** schema for data integrity
- **Pydantic schemas** for request/response validation
- **Full CRUD APIs** for all entities
- **Analytics endpoints** for CO attainment and student performance
- **Proper foreign key relationships** with cascade operations

## Database Schema

### Core Tables

1. **Student** - Student information and enrollment history
2. **Course** - Course details and metadata
3. **Program Outcome (PO)** - Program-level learning outcomes
4. **Course Outcome (CO)** - Course-level learning outcomes
5. **CO-PO Mapping** - Correlation between COs and POs
6. **Assessment** - Assignments, tests, and evaluations
7. **Submission** - Student submissions for assessments
8. **Result** - Grading results and feedback

### Relationships

```
Student --[many-to-many]-- Course  (via course_student_association)
Course --[one-to-many]-- CourseOutcome
Course --[one-to-many]-- Assessment
CourseOutcome --[many-to-many]-- ProgramOutcome (via CO_PO_Mapping)
Assessment --[one-to-many]-- Submission
Student --[one-to-many]-- Submission
Submission --[one-to-one]-- Result
```

## Installation

### Prerequisites

- Python 3.10+
- PostgreSQL 12+
- pip or conda

### Setup

1. **Clone/Extract the backend directory**

   ```bash
   cd backend
   ```

2. **Create virtual environment**

   ```bash
   python -m venv venv

   # Windows
   .\venv\Scripts\activate

   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure database**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/academic_automation
   ```

5. **Run the application**

   ```bash
   python main.py
   ```

   Or with uvicorn directly:

   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

6. **Access API documentation**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Database Migrations

Available migration scripts to add new features:

### 1. Assignment Tables (`migrate_assignments.py`)

Adds core assignment and question tables.

```bash
python migrate_assignments.py
```

### 2. PDF Support (`migrate_pdf_path.py`)

Adds PDF path storage for submission tracking.

```bash
python migrate_pdf_path.py
```

### 3. Feedback Loop (`migrate_feedback_loop.py`) ⭐ NEW

Adds feedback loop infrastructure for tracking intervention effectiveness:

- **les_snapshots** - LES score history per student (tracks efficiency improvements)
- **intervention_log** - Tracks when study plans were generated (for post-intervention analysis)
- **model_versions** - ML model retrain history (audit trail for ML improvements)

```bash
python migrate_feedback_loop.py
```

**Use Case:** After generating an AI study plan, capture before/after LES scores to measure intervention effectiveness and retrain ML models with improved data.

## LES Engine (`les_engine.py`) ⭐ NEW

The Learning Efficiency Score (LES) Engine automatically tracks student performance improvements, detects intervention effectiveness, and triggers incremental ML model retraining.

### Core Functions

#### 1. **Compute LES Score**

```python
from les_engine import compute_les, compute_weighted_les

# Simple LES: improvement hours invested + baseline
les = compute_les(pre_score=45, post_score=68, time_invested=5.0)
# Returns: 54.6 (normalized to 0-100)

# Weighted LES from student profile
les = compute_weighted_les(student_data={
    "attendance": 90,
    "assignment_scores": 75,
    "internal_assessment": 80,
    "lab_performance": 70,
    "study_hours": 5,
    "concept_mastery": 45,
})
```

#### 2. **Save LES Snapshot**

Automatically triggered after student receives a graded submission. Persists to les_snapshots table and triggers feedback loop.

```python
from les_engine import save_les_snapshot

# After grading: captures performance at that moment
save_les_snapshot(
    db=db_session,
    student_id="stu001",
    post_score=68,
    student_data={...},  # Current student metrics
    assignment_id="asn001",
    subject_id="subj001",
)
# Auto-detects if student has unresolved intervention → triggers feedback loop
```

#### 3. **Log Intervention**

Records when an AI study plan is generated. Used by feedback loop to detect post-intervention submissions.

```python
from les_engine import log_intervention

log_intervention(
    db=db_session,
    student_id="stu001",
    subject_id="subj001",
    les_at_intervention=42,  # LES when plan was created
    risk="High",  # Risk level from AI assessment
    weak_concepts=["Recursion", "Pointers"],
    advisory_plan="Focus on recursion examples...",
)
```

#### 4. **Get LES History**

Retrieve LES scores over time for charting progress.

```python
from les_engine import get_les_history

history = get_les_history(
    db=db_session,
    student_id="stu001",
    subject_id="subj001",
    limit=10,  # Last 10 snapshots
)
# Returns: [{"les": 42, "created_at": "2024-01-15"}, ...]
```

#### 5. **Manual Retrain**

Trigger ML model retraining by teacher (non-blocking). Uses warm-start to preserve existing trees.

```python
from les_engine import manual_retrain

result = manual_retrain(db=db_session, triggered_by="teacher_001")
# Returns: {"version": 5, "status": "Training...", "message": "Model retrain initiated"}
```

### Feedback Loop Workflow

```
1. Student takes assignment → Graded submission recorded
                              ↓
2. LES snapshot created → save_les_snapshot() called
                          ↓
3. Check for unresolved intervention → _check_and_trigger_feedback_loop()
                                        ↓
4. If intervention exists:
   - Compare new LES with intervention LES
   - Calculate improvement_pct = (new_les - prev_les) / prev_les × 100
   - Mark intervention as followed_up
   - If improvement > 5%: Trigger incremental ML retrain
                          ↓
5. _incremental_retrain() executes:
   - Load existing model (warm_start=True)
   - Add 10 more decision trees
   - Retrain on all historical + new data
   - Evaluate: R², RMSE, cross-val score
   - Save new ModelVersion with metrics
```

### Integration with main.py

**After Grading Endpoint:**

```python
from les_engine import save_les_snapshot

@app.post("/submissions/{submission_id}/grade")
async def grade_submission(submission_id: str, score: int, db: Session):
    submission = db.query(Submission).get(submission_id)
    submission.score = score

    # NEW: Save LES snapshot (auto-triggers feedback loop)
    save_les_snapshot(
        db=db,
        student_id=submission.student_id,
        post_score=score,
        student_data=get_student_metrics(db, submission.student_id),
        assignment_id=submission_id,
        subject_id=submission.subject_id,
    )

    db.commit()
    return {"status": "graded"}
```

**Advisory Plan Endpoint:**

```python
from les_engine import log_intervention

@app.post("/advisory/generate-plan")
async def generate_study_plan(request: AdvisoryRequest, db: Session):
    # Generate plan via AI...
    plan = generate_ai_plan(request)

    # NEW: Log for feedback loop
    log_intervention(
        db=db,
        student_id=request.student_id,
        subject_id=request.subject_id,
        les_at_intervention=plan["les_score"],
        risk=plan["risk_level"],
        weak_concepts=plan["concepts"],
        advisory_plan=plan["text"],
    )

    return plan
```

**Manual Retrain Endpoint:**

```python
from les_engine import manual_retrain

@app.post("/analytics/retrain")
async def trigger_retrain(teacher_id: str, db: Session):
    result = manual_retrain(db=db, triggered_by=teacher_id)
    return result
```

### Model Versioning

Each retrain creates a ModelVersion record:

```python
{
    "version_number": 5,
    "model_type": "RandomForest",
    "trigger": "post_intervention_feedback_loop",
    "r_squared": 0.78,
    "rmse": 12.3,
    "mae": 9.5,
    "training_samples": 1247,
    "cross_val_score": 0.75,
    "model_path": "/backend/models/les_model_v5.pkl",
    "triggered_by": "system",
    "is_active": true,
    "created_at": "2024-01-15T14:32:00Z"
}
```

### Warm-Start ML Retraining

Instead of rebuilding the entire model from scratch every feedback loop:

- **Traditional Retraining**: 100 trees × 1 hour = slow, discards prior learning
- **Warm-Start Strategy**: Add 10 trees to existing 100 trees = 6 minutes, preserves learning

```python
# Each retrain increments trees by 10
model.fit(X_train, y_train)  # Adds 10 new trees to existing forest
# Result: Faster convergence + lower training error + audit trail of all versions
```

## Statistical Validation (`statistical_validation.py`) ⭐ NEW

Rigorous statistical analysis of intervention effectiveness using hypothesis testing, effect sizes, and confidence intervals.

### Core Functions

#### 1. **Run Statistical Validation**

Comprehensive analysis of all intervention data with paired t-test, effect size, and student-level breakdown.

```python
from statistical_validation import run_statistical_validation

result = run_statistical_validation(db, subject_id="subj001")

# Returns:
{
    "sample_size": 45,
    "paired_ttest": {
        "t_statistic": 3.247,
        "p_value": 0.002341,
        "interpretation": "very significant (p < 0.01)",
        "significant": True,
    },
    "cohens_d": {
        "value": 0.523,
        "magnitude": "small",  # or "medium", "large"
        "interpretation": "Effect size is small (+0.52)",
    },
    "group_stats": {
        "pre_mean": 42.3,
        "post_mean": 58.7,
        "mean_improvement": 16.4,  # Average LES gain
        "pre_std": 18.2,
        "post_std": 15.6,
    },
    "model_fit": {
        "r_squared": 0.612,      # Improvement predictability
        "rmse": 12.4,            # Avg deviation magnitude
        "slope": 0.234,          # Trend: higher pre scores → slightly higher post
    },
    "confidence_interval_95": {
        "lower": 12.3,
        "upper": 20.5,
        "label": "95% CI for mean improvement: [12.3, 20.5]"
    },
    "histogram": [
        {"range": "0–10", "pre_count": 5, "post_count": 1},
        {"range": "40–50", "pre_count": 18, "post_count": 8},
        {"range": "60–70", "pre_count": 8, "post_count": 24},
        ...
    ],
    "improvement_summary": [
        {
            "student_id": "stu_042",
            "pre_les": 35,
            "post_les": 72,
            "improvement_pct": 105.7,
            "risk_before": "High",
            "intervention_date": "2024-01-15T10:00:00",
            "followup_date": "2024-01-20T14:30:00",
        },
        ...  # Sorted by improvement_pct descending
    ],
}
```

#### 2. **Interpret Results**

**Paired t-test (`p_value`):**

- p < 0.05 → Intervention effect is statistically significant
- p < 0.01 → Very strong evidence of improvement
- p ≥ 0.05 → No significant difference detected

**Cohen's d (effect size):**

- |d| < 0.2 → Negligible effect (change not noticeable)
- |d| < 0.5 → Small effect (meaningful but limited)
- |d| < 0.8 → Medium effect (moderate improvement)
- |d| ≥ 0.8 → Large effect (substantial improvement)

**Confidence Interval (95%):**

- Range where true population improvement likely falls
- Narrower CI = more precise estimate
- Example: CI=[12.3, 20.5] means we're 95% confident the true avg improvement is between 12.3 and 20.5 LES points

#### 3. **Evaluate Current Model**

Quick metrics check for the active ML model version.

```python
from statistical_validation import evaluate_current_model

model_metrics = evaluate_current_model(db)

# Returns:
{
    "version": 5,
    "model_type": "RandomForest",
    "r_squared": 0.782,
    "rmse": 9.23,
    "mae": 7.15,
    "cross_val_score": 0.758,
    "training_samples": 1247,
    "trigger": "post_intervention_feedback_loop",
    "triggered_by": "system",
    "trained_at": "2024-01-20T14:08:00Z",
}
```

### Integration with main.py

**Analytics Dashboard Endpoint:**

```python
from statistical_validation import run_statistical_validation, evaluate_current_model

@app.get("/analytics/intervention-effectiveness")
async def intervention_effectiveness_report(
    subject_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive statistical analysis of intervention impact.
    Shows paired t-test, Cohen's d, and per-student breakdown.
    """
    return run_statistical_validation(db, subject_id=subject_id)


@app.get("/analytics/model-performance")
async def get_model_performance(db: Session = Depends(get_db)):
    """
    Returns current ML model metrics.
    Used by dashboard to show model health and accuracy.
    """
    return evaluate_current_model(db)
```

### Example Dashboard Interpretation

**Scenario: High-School Math Class, Post-Intervention Analysis**

```
Sample Size: 45 students with study plan interventions
Paired t-test: t=3.247, p=0.002 → VERY SIGNIFICANT (p < 0.01) ✓
Cohen's d: d=0.523 → SMALL EFFECT

Narrative:
→ "Study plan interventions significantly improved LES scores (t=3.25, p=.002).
  Average gain = +16.4 points (pre: 42.3 → post: 58.7).
  Effect size is small but meaningful for educational interventions.
  95% confident true improvement is between 12.3 and 20.5 LES points."

Best Responders (Top 3):
1. stu_042: LES +37.0 (35→72) - Intense focus on recursion
2. stu_156: LES +32.5 (43→75) - Lab practice intervention
3. stu_203: LES +28.1 (51→79) - Group tutoring sessions

Insight: Recursive problem interventions show strongest ROI.
```

### Statistical Methods Reference

**Paired t-test:**

- Compares same students' LES before and after intervention
- Null hypothesis: No difference between pre and post
- Robust for sample sizes > 15
- Assumes approximately normal distribution of differences

**Cohen's d:**

- Effect size independent of sample size
- Allows comparison across different interventions
- Formula: d = (mean_post - mean_pre) / pooled_std

**R² (Coefficient of Determination):**

- Proportion of variance in post-LES explained by pre-LES
- High R² (>0.7): Improvement is predictable
- Low R² (<0.3): Other factors driving change

**Confidence Interval:**

- 95% CI: range containing true population parameter with 95% confidence
- Narrower = more precise; depends on sample size
- Formula: mean ± t_critical × SE

## API Endpoints Overview

### Students

- `POST /students/` - Create student
- `GET /students/` - List students
- `GET /students/{student_id}` - Get student with courses
- `PUT /students/{student_id}` - Update student
- `DELETE /students/{student_id}` - Delete student

### Courses

- `POST /courses/` - Create course
- `GET /courses/` - List courses
- `GET /courses/{course_id}` - Get course with outcomes
- `PUT /courses/{course_id}` - Update course
- `DELETE /courses/{course_id}` - Delete course
- `POST /courses/{course_id}/enroll/{student_id}` - Enroll student

### Program Outcomes

- `POST /program-outcomes/` - Create PO
- `GET /program-outcomes/` - List POs
- `GET /program-outcomes/{po_id}` - Get PO
- `PUT /program-outcomes/{po_id}` - Update PO
- `DELETE /program-outcomes/{po_id}` - Delete PO

### Course Outcomes

- `POST /course-outcomes/` - Create CO
- `GET /course-outcomes/` - List COs (filter by course_id)
- `GET /course-outcomes/{co_id}` - Get CO
- `PUT /course-outcomes/{co_id}` - Update CO
- `DELETE /course-outcomes/{co_id}` - Delete CO

### CO-PO Mappings

- `POST /co-po-mappings/` - Create mapping
- `GET /co-po-mappings/` - List mappings
- `GET /co-po-mappings/{mapping_id}` - Get mapping with details
- `PUT /co-po-mappings/{mapping_id}` - Update mapping
- `DELETE /co-po-mappings/{mapping_id}` - Delete mapping

### Assessments

- `POST /assessments/` - Create assessment
- `GET /assessments/` - List assessments (filter by course_id)
- `GET /assessments/{assessment_id}` - Get assessment with submissions
- `PUT /assessments/{assessment_id}` - Update assessment
- `DELETE /assessments/{assessment_id}` - Delete assessment

### Submissions

- `POST /submissions/` - Create submission
- `GET /submissions/` - List submissions (filter by assessment_id, student_id)
- `GET /submissions/{submission_id}` - Get submission with result
- `PUT /submissions/{submission_id}` - Update submission
- `DELETE /submissions/{submission_id}` - Delete submission

### Results

- `POST /results/` - Create result
- `GET /results/` - List results
- `GET /results/{result_id}` - Get result with submission
- `PUT /results/{result_id}` - Update result (grading)
- `DELETE /results/{result_id}` - Delete result

### Analytics

- `GET /analytics/course/{course_id}/co-attainment` - CO attainment calculation
- `GET /analytics/student/{student_id}/performance` - Student performance summary

## Data Normalization (3NF)

✅ **First Normal Form (1NF)** - All attributes are atomic
✅ **Second Normal Form (2NF)** - No partial dependencies
✅ **Third Normal Form (3NF)** - No transitive dependencies

Schema follows entity-attribute relationships where:

- Student, Course, PO, CO, Assessment are independent entities
- Submission and Result are dependent entities
- CO-PO Mapping connects outcomes for correlation tracking

## Example API Usage

### Create Student

```bash
curl -X POST http://localhost:8000/students/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "9876543210"
  }'
```

### Create Course

```bash
curl -X POST http://localhost:8000/courses/ \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CS101",
    "name": "Introduction to Programming",
    "semester": 1,
    "department": "Computer Science"
  }'
```

### Enroll Student

```bash
curl -X POST http://localhost:8000/courses/1/enroll/1
```

### Create Assessment

```bash
curl -X POST http://localhost:8000/assessments/ \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "title": "Midterm Exam",
    "assessment_type": "mcq",
    "total_marks": 100
  }'
```

### Submit Assessment

```bash
curl -X POST http://localhost:8000/submissions/ \
  -H "Content-Type: application/json" \
  -d '{
    "assessment_id": 1,
    "student_id": 1,
    "content": "1. A\n2. B\n3. C..."
  }'
```

### Grade Submission

```bash
curl -X POST http://localhost:8000/results/ \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": 1,
    "marks_obtained": 85.5,
    "feedback": "Good performance",
    "grading_status": "completed"
  }'
```

## Architecture

```
backend/
├── main.py              # FastAPI application & routes
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── database.py          # Database configuration
├── seed.py              # Sample data population
├── test_api.py          # API tests
├── requirements.txt     # Python dependencies
├── .env.example         # Environment template
├── docker-compose.yml   # PostgreSQL container
└── README.md            # This file
```

## Next Steps

- Add authentication/authorization (JWT/OAuth)
- Implement assessment question generation module
- Add auto-grading engines (MCQ, Coding, NLP)
- Integrate ML model for risk prediction
- Build analytics dashboards
- Add email notifications
- Implement audit logging

## License

MIT License
