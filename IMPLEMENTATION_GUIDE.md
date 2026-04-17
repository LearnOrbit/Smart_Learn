# AcademiQ - Developer Implementation Guide

## How Things Work & How to Extend Them

**This guide explains the internal architecture and how to add new features to the system.**

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Data Flow Architecture](#2-data-flow-architecture)
3. [How API Endpoints Work](#3-how-api-endpoints-work)
4. [How Frontend Pages Work](#4-how-frontend-pages-work)
5. [Database Operations](#5-database-operations)
6. [AI Integration](#6-ai-integration)
7. [ML Pipeline](#7-ml-pipeline)
8. [LES Engine](#8-les-engine-learning-efficiency-score)
9. [Statistical Validation Engine](#9-statistical-validation-engine)
10. [File Upload System](#10-file-upload-system)
11. [Analytics Processing](#11-analytics-processing)
12. [Adding New Features](#12-adding-new-features)

---

## 1. Authentication Flow

### How It Works

```
User Enters Email/Password
    ↓
Frontend sends POST /auth/login
    ↓
Backend validates credentials
    ├─ Query User from DB
    ├─ Verify password with bcrypt
    └─ Return error if invalid
    ↓
Generate JWT Token
    ├─ Payload: {sub: user_id}
    ├─ Algorithm: HS256
    └─ Expiry: 30 minutes
    ↓
Frontend stores token in localStorage
    ↓
All subsequent requests include Authorization header
    ├─ Header: "Authorization: Bearer <token>"
    └─ Client validates on each request
    ↓
Protected routes redirect to /auth if no token
```

### Code Locations

**Backend:**

- Authentication functions: [auth.py](backend/auth.py)
- Login endpoint: [main.py](backend/main.py#L177)
- Token verification: [main.py](backend/main.py#L100-L135)

**Frontend:**

- Auth context: [AuthContext.ts](src/hooks/AuthContext.ts)
- Auth provider: [AuthProvider.tsx](src/hooks/AuthProvider.tsx)
- useAuth hook: [useAuth.tsx](src/hooks/useAuth.tsx)
- Protected route: [ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)

### How to Add New Auth Method

Example: Add OAuth/Google login

1. **Backend:**

```python
# In auth.py
def verify_google_token(token: str):
    # Use google-auth-oauthlib
    pass

# In main.py
@app.post("/auth/google")
def google_login(token: schemas.GoogleToken):
    user_info = verify_google_token(token.id_token)
    # Find or create user
    # Return JWT token
```

2. **Frontend:**

```tsx
// In Auth.tsx
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

<GoogleLogin
  onSuccess={(credentialResponse) => {
    // Send credentialResponse.credential to /auth/google
  }}
/>;
```

---

## 2. Data Flow Architecture

### Request-Response Flow

**Example: Create Assignment**

```
Frontend Component
  ↓
User fills form & clicks Save
  ↓
React Hook Form validates
  ↓
API Client (client.ts) post("/assignments/", data)
  ↓
HTTP POST to http://localhost:8002/api/assignments/
  ├─ Headers: {"Authorization": "Bearer <token>"}
  └─ Body: {title, description, questions[], ...}
  ↓
FastAPI Route Handler
  ├─ @app.post("/assignments/")
  ├─ decode_access_token() validates JWT
  ├─ Pydantic validation (schemas.AssignmentCreate)
  └─ get_current_user() extracts user info
  ↓
Business Logic
  ├─ Create Assignment object
  ├─ Create Question objects
  ├─ Create ModelSolution
  └─ db.add_all() + db.commit()
  ↓
SQLAlchemy ORM
  ├─ Generates INSERT SQL
  ├─ Executes against SQLite/PostgreSQL
  └─ Returns generated IDs
  ↓
Response Serialization
  ├─ Convert ORM objects to Pydantic schemas
  └─ JSON serialization
  ↓
HTTP 201 Created Response
  └─ Body: {id, title, questions, ...}
  ↓
Frontend receives response
  ├─ Toast notification: "Assignment created!"
  ├─ Update local cache (React Query)
  ├─ Redirect to assignment details
  └─ Refetch assignments list
```

### State Management

**Frontend State Flow:**

```
User Action
  ↓
React Query Mutation
  ├─ optimisticUpdate (optional)
  ├─ Call API
  ├─ onSuccess: Invalidate cache
  └─ onError: Revert optimistic update
  ↓
Component State Update
  ├─ useQuery() hook refetches
  ├─ Component re-renders
  └─ UI updates
```

---

## 3. How API Endpoints Work

### Endpoint Structure Pattern

Every endpoint follows this pattern in `main.py`:

```python
@app.post("/resource/", response_model=schemas.ResourceResponse, status_code=201)
def create_resource(
    resource: schemas.ResourceCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new resource"""

    # 1. Validate input (Pydantic does this automatically)

    # 2. Business logic
    db_resource = Resource(**resource.dict())
    db_resource.created_by = current_user["id"]

    # 3. Database operation
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)

    # 4. Return response
    return db_resource
```

### Request/Response Example

**Request:**

```bash
curl -X POST http://localhost:8002/api/subjects/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CS101",
    "name": "Introduction to Computer Science",
    "description": "Fundamentals of programming"
  }'
```

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "CS101",
  "name": "Introduction to Computer Science",
  "description": "Fundamentals of programming",
  "created_by": "user-id-123",
  "created_at": "2026-03-31T10:00:00",
  "updated_at": "2026-03-31T10:00:00"
}
```

### Error Response

**Error Response (400):**

```json
{
  "detail": "Email already registered"
}
```

### Common Error Codes

| Code | Meaning      | Example                |
| ---- | ------------ | ---------------------- |
| 200  | OK           | GET request successful |
| 201  | Created      | POST resource created  |
| 204  | No Content   | DELETE successful      |
| 400  | Bad Request  | Invalid input data     |
| 401  | Unauthorized | Missing/invalid token  |
| 404  | Not Found    | Resource doesn't exist |
| 409  | Conflict     | Duplicate entry        |
| 500  | Server Error | Unhandled exception    |

---

## 4. How Frontend Pages Work

### Page Structure Pattern

**Example: OutcomesManager.tsx**

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";

export default function OutcomesManager() {
  // 1. STATE MANAGEMENT
  const [selectedTab, setSelectedTab] = useState("PO");

  // 2. FETCH DATA
  const { data: outcomes, isLoading } = useQuery({
    queryKey: ["outcomes", selectedTab],
    queryFn: () => apiClient.get(`/program-outcomes/`),
  });

  // 3. MUTATIONS (CREATE/UPDATE/DELETE)
  const createMutation = useMutation({
    mutationFn: (newOutcome) =>
      apiClient.post("/program-outcomes/", newOutcome),
    onSuccess: () => {
      queryClient.invalidateQueries(["outcomes"]);
      toast.success("Outcome created!");
    },
  });

  // 4. HANDLERS
  const handleCreate = (formData) => {
    createMutation.mutate(formData);
  };

  // 5. RENDER
  return (
    <div>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsContent value="PO">
          {isLoading ? <Loading /> : <OutcomeList data={outcomes} />}
          <CreateForm onSubmit={handleCreate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Page Data Flow

```
Component Mount
  ↓
useQuery fetches /program-outcomes/
  ├─ Loading state shown
  └─ Data cached
  ↓
User fills form & submits
  ↓
useMutation calls POST /program-outcomes/
  ├─ Optimistic update (optional)
  ├─ API request sent
  └─ Waiting for response
  ↓
Response received
  ├─ Cache invalidated
  ├─ Data refetched
  ├─ Toast shown
  └─ Form reset
```

### Component Libraries Used

**UI Components (shadcn/ui):**

- `<Button />` - Action buttons
- `<Input />` - Text inputs
- `<Select />` - Dropdowns
- `<Dialog />` - Modal dialogs
- `<Tabs />` - Tab navigation
- `<Table />` - Data tables
- `<Form />` - Form builder (React Hook Form)

**How to use Form:**

```tsx
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";

const form = useForm();
const onSubmit = (data) => {
  /* handle */
};

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <Input {...field} />
          </FormItem>
        )}
      />
      <Button type="submit">Save</Button>
    </form>
  </Form>
);
```

---

## 5. Database Operations

### How Queries Work

**Example: Get all subjects for a teacher**

```python
# In backend/main.py
@app.get("/api/subjects")
def list_subjects(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    # Query all subjects
    subjects = db.query(Subject)\
        .offset(skip)\
        .limit(limit)\
        .all()
    return subjects

# Generated SQL:
# SELECT * FROM subjects LIMIT 10 OFFSET 0
```

### Relationships Example

**Querying with relationships:**

```python
# Get subject with all outcomes
subject = db.query(Subject)\
    .options(
        joinedload(Subject.program_outcomes),
        joinedload(Subject.course_outcomes),
        joinedload(Subject.learning_outcomes)
    )\
    .filter(Subject.id == subject_id)\
    .first()

# Access relationships
for po in subject.program_outcomes:
    for co in po.course_outcomes:
        print(co.code, co.description)
```

### Adding New Database Operation

**Step 1: Add model to database.py**

```python
class StudentNote(Base):
    __tablename__ = "student_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())
```

**Step 2: Add schema to schemas.py**

```python
class StudentNoteCreate(BaseModel):
    student_id: str
    subject_id: str
    notes: str

class StudentNoteResponse(StudentNoteCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
```

**Step 3: Add endpoint to main.py**

```python
@app.post("/student-notes/", response_model=schemas.StudentNoteResponse)
def create_note(
    note: schemas.StudentNoteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    db_note = StudentNote(**note.dict())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note
```

---

## 6. AI Integration

### How Claude API Calls Work

**In ai_advisory.py:**

```python
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def generate_study_plan(
    student_name: str,
    weak_concepts: List[str],
    learning_efficiency_score: float,
    risk_level: str,
) -> str:
    # Build prompt
    prompt = f"""
    You are an expert academic advisor...
    [Full prompt with context]
    """

    # Call Claude
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract response
    return message.content[0].text
```

### Called from Backend Endpoint

**In main.py:**

```python
@app.post("/analytics/advisory-plan")
def generate_advisory_plan(
    request: schemas.AdvisoryPlanRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get student data
    student = db.query(User).filter(User.id == current_user["id"]).first()

    # Generate plan using Claude
    plan = generate_study_plan(
        student_name=student.name,
        weak_concepts=request.weak_concepts,
        learning_efficiency_score=request.les,
        risk_level=request.risk_level
    )

    return {"study_plan": plan}
```

### Usage from Frontend

```tsx
// In FeedbackTools.tsx
const generatePlan = async () => {
  const response = await apiClient.post("/analytics/advisory-plan", {
    weak_concepts: ["calculus", "linear algebra"],
    les: 45,
    risk_level: "High",
  });
  setPlan(response.data.study_plan);
};
```

### Adding New Claude Call

```python
# 1. In ai_advisory.py
def generate_exam_prep(exam_name: str, topics: List[str]) -> str:
    prompt = f"""
    Generate a 2-week exam preparation plan for {exam_name}
    Topics: {', '.join(topics)}

    Include:
    1. Daily study schedule
    2. Practice exam questions
    3. Common mistakes to avoid
    """

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text

# 2. In main.py
from ai_advisory import generate_exam_prep

@app.post("/analytics/exam-prep")
def get_exam_prep(
    request: schemas.ExamPrepRequest,
    current_user: dict = Depends(get_current_user)
):
    prep = generate_exam_prep(request.exam_name, request.topics)
    return {"exam_prep": prep}

# 3. Call from frontend
const examPrep = await apiClient.post("/analytics/exam-prep", {
  exam_name: "Calculus Midterm",
  topics: ["Derivatives", "Integrals"]
})
```

---

## 7. ML Pipeline

### How Risk Prediction Works

**In ml_models.py:**

```python
class MLPipeline:
    def __init__(self):
        # Initialize models
        self.les_model = RandomForestRegressor(n_estimators=100)
        self.risk_model = LogisticRegression()

    def preprocess_features(self, data: Dict) -> np.ndarray:
        # Extract features
        features = np.array([
            data.get("student_marks", 0),
            data.get("attendance", 0),
            # ... 7 features total
        ])

        # Apply weights
        weights = np.array([0.25, 0.10, 0.15, ...])
        weighted = features * weights

        # Normalize to 0-100
        normalized = np.clip(weighted, 0, 100)
        return normalized.reshape(1, -1)

    def calculate_les(self, features: np.ndarray) -> Tuple[float, Dict]:
        # Predict LES (Learning Efficiency Score)
        les = float(self.les_model.predict(features)[0])
        les = np.clip(les, 0, 100)
        return les, {"les": les, "r_squared": 0.0}

    def predict_risk_level(self, features: np.ndarray) -> Dict:
        # Map LES to risk level
        les = float(np.mean(features))
        if les >= 70:
            risk = "Low"
        elif les >= 40:
            risk = "Moderate"
        else:
            risk = "High"
        return {"les": les, "risk_level": risk}

# Global pipeline instance
ml_pipeline = MLPipeline()
```

### Called from Backend

```python
@app.post("/analytics/predict")
def predict_performance(
    request: schemas.PredictionRequest,
    db: Session = Depends(get_db)
):
    # Prepare data
    data = {
        "student_marks": request.student_marks,
        "attendance": request.attendance,
        # ... other features
    }

    # Preprocess
    features = ml_pipeline.preprocess_features(data)

    # Predict
    les, metrics = ml_pipeline.calculate_les(features)
    risk = ml_pipeline.predict_risk_level(features)

    return {
        "les": les,
        "risk_level": risk["risk_level"],
        "confidence": 0.85
    }
```

### Training the Model

```python
# Call this once with historical data
def train_ml_model():
    # Get training data from database
    students = db.query(StudentPerformance).all()

    X = np.array([
        [s.marks, s.attendance, s.assessments, ...]
        for s in students
    ])
    y = np.array([s.final_grade for s in students])

    # Train
    ml_pipeline.les_model.fit(X, y)

    # Evaluate
    score = ml_pipeline.les_model.score(X, y)
    print(f"R² Score: {score}")

    # Save
    ml_pipeline.save_model("models/les_model.pkl")
```

---

## 8. LES Engine (Learning Efficiency Score)

### Overview

The LES Engine (`les_engine.py`) handles the complete feedback loop:

```
Graded Submission
    ↓
Save LES Snapshot (tracks improvement)
    ↓
Check for Post-Intervention (did student follow up on study plan?)
    ↓
If followed up: Trigger ML Retrain (incremental warm_start)
    ↓
New model version saved & activated
```

### Core Functions

**1. Compute LES**

```python
from les_engine import compute_les

# Formula: (post_score - pre_score) / time_invested
les = compute_les(
    pre_score=45.0,      # score before advisory plan
    post_score=68.0,     # score on this submission
    time_invested=5.0    # study hours invested
)
# Result: 4.6 improvement per hour, normalized to 0-100
```

**2. Save LES Snapshot** (Called after every graded submission)

```python
from les_engine import save_les_snapshot
from database import LESSnapshot

snapshot = save_les_snapshot(
    db=db_session,
    student_id="student-123",
    post_score=68.0,
    student_data={
        "attendance": 90,
        "assignment_scores": 75,
        "internal_assessment": 60,
        "lab_performance": 70,
        "study_hours": 5.0,
        "concept_mastery": 65,
        "student_marks": 68
    },
    subject_id="cs101",
    submission_id="submission-456",
    LESSnapshot=LESSnapshot
)
# Automatically triggers feedback loop check
```

**3. Log Intervention** (When study plan is generated)

```python
from les_engine import log_intervention
from database import InterventionLog

log = log_intervention(
    db=db_session,
    student_id="student-123",
    les_at_intervention=45.0,
    risk_at_intervention="High",
    weak_concepts=["Calculus", "Linear Algebra"],
    advisory_plan="Full study plan text...",
    subject_id="cs101",
    InterventionLog=InterventionLog
)
```

**4. Get LES History** (For charting)

```python
from les_engine import get_les_history

history = get_les_history(
    db=db_session,
    student_id="student-123",
    subject_id="cs101",
    limit=20  # last 20 snapshots
)
# Returns: [{"les": 45.2, "pre_score": 35, "post_score": 68, ...}, ...]
```

### Integration with main.py

**Add to imports:**

```python
from les_engine import (
    save_les_snapshot,
    log_intervention,
    get_les_history,
    manual_retrain,
    LESSnapshot,
    InterventionLog,
)
```

**In your grading endpoint:**

```python
@app.put("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: str,
    grade: schemas.GradeSubmission,
    db: Session = Depends(get_db)
):
    submission = get_submission(db, submission_id)
    submission.score = grade.score
    db.commit()

    # 🆕 Capture LES snapshot after grading
    if submission.student_id:
        student_perf = db.query(StudentPerformance)\
            .filter(StudentPerformance.student_id == submission.student_id)\
            .first()

        if student_perf:
            save_les_snapshot(
                db=db,
                student_id=submission.student_id,
                post_score=grade.score,
                student_data={
                    "attendance": student_perf.attendance,
                    "assignment_scores": student_perf.assignment_scores,
                    "internal_assessment": student_perf.internal_assessments,
                    "lab_performance": student_perf.lab_performance,
                    "study_hours": student_perf.study_hours,
                    "concept_mastery": student_perf.concept_mastery,
                    "student_marks": student_perf.student_marks,
                },
                subject_id=submission.assignment.subject_id,
                submission_id=submission_id,
                LESSnapshot=LESSnapshot
            )

    return submission
```

**In your advisory plan endpoint:**

```python
@app.post("/analytics/advisory-plan")
def generate_advisory_plan(
    request: schemas.AdvisoryPlanRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == current_user["id"]).first()

    # Generate plan
    plan = generate_study_plan(
        student_name=student.name,
        weak_concepts=request.weak_concepts,
        learning_efficiency_score=request.les,
        risk_level=request.risk_level
    )

    # 🆕 Log the intervention for feedback loop
    log_intervention(
        db=db,
        student_id=student.id,
        les_at_intervention=request.les,
        risk_at_intervention=request.risk_level,
        weak_concepts=request.weak_concepts,
        advisory_plan=plan,
        subject_id=request.subject_id,
        InterventionLog=InterventionLog
    )

    return {"study_plan": plan}
```

**Manual retrain endpoint:**

```python
@app.post("/analytics/retrain")
def retrain_ml_model(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger manual ML model retrain."""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")

    result = manual_retrain(db, triggered_by=current_user["id"])
    return result
```

### Feedback Loop Workflow

```
Timeline:
─────────

Day 1: Student submission → Score 45% → LES Snapshot created
       ↓
       AI generates study plan → Intervention logged (les=45%)
       ↓
Day 7: Student completes study plan → Submits again → Score 68%
       ↓
       LES Snapshot created (pre=45, post=68) → LES = +4.6/hour
       ↓
       Feedback loop detected "post-intervention" submission
       ↓
       Intervention marked as "followed_up" → improvement_pct = +51%
       ↓
       Trigger ML retrain with new data
       ↓
       Model v2 saved with warm_start (50→60 estimators)
```

### Warm Start Explained

Traditional ML retrain discards prior learning. **Warm start** preserves it:

```python
# Old way (slow, forgetting):
rf_model = RandomForestRegressor(n_estimators=100)
rf_model.fit(X, y)  # Train 100 trees from scratch

# Warm start (fast, incremental):
rf_model.n_estimators = 110  # Add 10 more trees
rf_model.warm_start = True
rf_model.fit(X, y)           # Existing 100 trees stay; add 10 new
# Result: 10x faster, uses all historical knowledge
```

---

## 9. Statistical Validation Engine

### Purpose

Rigorous statistical analysis to measure intervention effectiveness using hypothesis testing, effect sizes, and confidence intervals. Answers critical questions:

- **Is the intervention statistically significant?** (Paired t-test, p-value)
- **What's the practical magnitude of improvement?** (Cohen's d effect size)
- **How confident are we in these results?** (95% CI, sample size)
- **Which students benefited most?** (Per-student breakdown)

### Core Concepts

**Paired t-test (Hypothesis Testing):**

```
H0 (Null): No difference between pre and post LES
H1 (Alt): Post-intervention LES differs from pre-intervention LES

If p-value < 0.05 → Reject H0 → Effect is statistically significant
If p-value >= 0.05 → Fail to reject H0 → No significant difference
```

**Cohen's d (Effect Size):**

```
Measures practical magnitude of improvement independent of sample size:
  |d| < 0.2  → negligible effect
  |d| < 0.5  → small effect (meaningful but limited)
  |d| < 0.8  → medium effect (moderate improvement)
  |d| ≥ 0.8  → large effect (substantial improvement)
```

**Confidence Interval (95%):**

```
Range where true population parameter likely falls with 95% confidence
Narrow CI = more precise; depends on sample size
Example: 95% CI = [12.3, 20.5] LES points
→ 95% confident the true average improvement is between 12.3 and 20.5
```

### Integration with main.py

**Analytics Endpoints:**

```python
from statistical_validation import run_statistical_validation, evaluate_current_model

@app.get("/analytics/intervention-effectiveness")
async def intervention_effectiveness_report(
    subject_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive statistical analysis:
    - Paired t-test (p-value, t-statistic)
    - Cohen's d (effect size)
    - Pre/post descriptive statistics
    - Per-student improvement breakdown
    - Histogram of LES distribution
    - 95% confidence interval for mean improvement
    """
    return run_statistical_validation(db, subject_id=subject_id)


@app.get("/analytics/model-performance")
async def get_model_performance(db: Session = Depends(get_db)):
    """
    Returns active ML model metrics for dashboard.
    Shows model version, accuracy (R²), error (RMSE), cross-validation score.
    """
    return evaluate_current_model(db)
```

### Example Response: Intervention Effectiveness Report

```python
{
    "sample_size": 45,

    "paired_ttest": {
        "t_statistic": 3.247,     # Test statistic
        "p_value": 0.002341,      # Probability under null hypothesis
        "interpretation": "very significant (p < 0.01)",  # Statistical significance
        "significant": True,       # Reject H0? Yes
    },

    "cohens_d": {
        "value": 0.523,           # Effect size
        "magnitude": "small",     # Practical significance
        "interpretation": "Effect size is small (+0.52)",
    },

    "group_stats": {
        "pre_mean": 42.3,         # Average LES before intervention
        "post_mean": 58.7,        # Average LES after intervention
        "mean_improvement": 16.4, # Average LES gain
        "pre_std": 18.2,          # Pre-intervention variability
        "post_std": 15.6,         # Post-intervention variability
    },

    "model_fit": {
        "r_squared": 0.612,       # How predictable improvements are
        "rmse": 12.4,             # Average prediction error
        "slope": 0.234,           # Trend: higher baseline → slightly higher gain
    },

    "confidence_interval_95": {
        "lower": 12.3,            # Lower bound of CI
        "upper": 20.5,            # Upper bound of CI
        "label": "95% CI for mean improvement: [12.3, 20.5]",
    },

    "histogram": [                # Distribution of LES scores
        {"range": "0–10", "pre_count": 5, "post_count": 1},
        {"range": "40–50", "pre_count": 18, "post_count": 8},
        {"range": "60–70", "pre_count": 8, "post_count": 24},
        ...
    ],

    "improvement_summary": [      # Per-student breakdown (sorted by improvement)
        {
            "student_id": "stu_042",
            "pre_les": 35,
            "post_les": 72,
            "improvement_pct": 105.7,  # Percent improvement
            "risk_before": "High",
            "intervention_date": "2024-01-15T10:00:00",
            "followup_date": "2024-01-20T14:30:00",
        },
        // More students...
    ],
}
```

### Dashboard Interpretation Example

**Real classroom scenario (High-School Math, post-intervention):**

```
✓ Statistical Significance: p = 0.002 (VERY SIGNIFICANT)
  → 99.8% confident this improvement is NOT due to chance
  → Intervention had real, measurable effect

✓ Effect Size: d = 0.523 (SMALL BUT MEANINGFUL)
  → For educational interventions, d > 0.3 is practically significant
  → Comparable to published intervention research

✓ Mean Improvement: +16.4 LES points
  → Pre-intervention: avg student at LES 42.3 (struggling)
  → Post-intervention: avg student at LES 58.7 (moderate)
  → 95% confident true improvement is between 12.3 and 20.5 points

✓ Top Responders:
  1. stu_042: +37 LES (35→72) - Recursion intervention ★★★
  2. stu_156: +32.5 LES (43→75) - Lab practice ★★
  3. stu_203: +28 LES (51→79) - Group tutoring ★★

→ INSIGHT: Recursive problem interventions show strongest ROI
```

### Functions Reference

**run_statistical_validation(db, subject_id, LESSnapshot, InterventionLog)**

- Full statistical analysis on all intervention data
- Requires: ≥3 interventions with followup submissions
- Returns: Dict with t-test, Cohen's d, CI, histograms, per-student breakdown

**cohens_d(group1, group2)**

- Computes effect size between two groups
- Returns: Float d value (-3 to +3)

**interpret_cohens_d(d)**

- Converts d value to magnitude label
- Returns: "negligible", "small", "medium", or "large"

**interpret_pvalue(p)**

- Converts p-value to significance label
- Returns: "highly significant (p < 0.001)", etc.

**evaluate_current_model(db, ModelVersion)**

- Quick metrics for active ML model
- Returns: Dict with R², RMSE, MAE, cross-val score, version info

### Statistical Methods Details

**Paired t-test:**

- Compares LES scores from same students across two time points
- Accounts for individual differences in baseline ability
- Robust for n > 15
- Assumes approximately normal distribution of differences
- Formula: t = (mean_diff) / (SE_diff)

**Cohen's d:**

- Effect size standardized by pooled standard deviation
- Independent of sample size (unlike p-value)
- Pooled SD accounts for variance in both groups
- Allows comparison across different interventions
- Formula: d = (mean_post - mean_pre) / pooled_std

**R² (Goodness of Fit):**

- Proportion of variance in post-LES explained by pre-LES
- High R² (>0.7): Strong baseline-outcome relationship
- Low R² (<0.3): Other factors (effort, prior knowledge) dominate
- Linear regression: post_les ~ pre_les

**Confidence Interval:**

- t-distribution based (accounts for small sample uncertainty)
- 95% → 5% chance interval doesn't contain true parameter
- Narrower CI = more precise estimate (requires larger sample)
- Standard Error (SE) based on sample SD and size: SE = SD / √n

---

## 10. File Upload System

### PDF Upload Flow

**Frontend (StudentDashboard.tsx):**

```tsx
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Create FormData
  const formData = new FormData();
  formData.append("file", file);
  formData.append("assignment_id", assignmentId);
  formData.append("student_id", userId);

  // Upload using postFormData method
  const response = await apiClient.postFormData("/submissions/", formData);

  if (response.error) {
    toast.error("Upload failed");
  } else {
    toast.success("Submission uploaded!");
    // Refresh submissions list
  }
};

<input type="file" accept=".pdf" onChange={handleFileUpload} />;
```

### Backend File Handling

**In main.py:**

```python
@app.post("/submissions/", response_model=schemas.SubmissionResponse)
async def upload_submission(
    file: UploadFile = File(...),
    assignment_id: str = Form(...),
    student_id: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        # Read file
        contents = await file.read()

        # Generate filename
        filename = f"{student_id}_{assignment_id}_{uuid.uuid4()}.pdf"
        filepath = os.path.join(UPLOADS_DIR, filename)

        # Save file
        with open(filepath, "wb") as f:
            f.write(contents)

        # Extract text (placeholder)
        extracted_text = extract_text_from_pdf(filepath)

        # Create submission record
        submission = Submission(
            student_id=student_id,
            assignment_id=assignment_id,
            file_path=filepath,
            extracted_text=extracted_text
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        return submission

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
```

### Adding Image Upload

```python
# In main.py
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

@app.post("/uploads/image/")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed")

    # Save file
    filename = f"image_{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    return {
        "filename": filename,
        "url": f"/uploads/{filename}"
    }
```

---

## 11. Analytics Processing

### Attainment Score Calculation

**How CO Attainment is Calculated:**

```python
# In main.py
@app.get("/analytics/course/{course_id}/co-attainment")
def get_co_attainment(course_id: str, db: Session = Depends(get_db)):
    # 1. Get all Course Outcomes for this course
    cos = db.query(CourseOutcome)\
        .filter(CourseOutcome.subject_id == course_id)\
        .all()

    attainment_data = []

    for co in cos:
        # 2. Get all Learning Outcomes under this CO
        los = db.query(LearningOutcome)\
            .filter(LearningOutcome.course_outcome_id == co.id)\
            .all()

        co_scores = []

        # 3. For each LO, calculate score
        for lo in los:
            # Get evaluations linked to this LO
            evaluations = db.query(QuestionEvaluation)\
                .join(Question)\
                .filter(Question.lo_id == lo.id)\
                .all()

            if evaluations:
                # Calculate average
                avg_score = np.mean([
                    e.score / e.max_marks * 100
                    for e in evaluations
                ])
                co_scores.append(avg_score)

        # 4. CO attainment = mean of LO scores
        if co_scores:
            co_attainment = np.mean(co_scores)
        else:
            co_attainment = 0

        attainment_data.append({
            "co_id": co.id,
            "co_code": co.code,
            "attainment_score": co_attainment,
            "threshold": 40,  # 40% is passing
            "status": "Pass" if co_attainment >= 40 else "Fail"
        })

    return {
        "course_id": course_id,
        "co_attainment": attainment_data
    }
```

### Multi-Level Calculation

```python
# LES (Learning Efficiency Score)
# Input: 7 student metrics
# Process: Weighted average + ML prediction
# Output: 0-100 score

# CO Attainment
# Input: Student scores on CO-mapped questions
# Process: Calculate mean of LO scores
# Output: Percentage

# PO Attainment
# Input: All CO attainments in a program
# Process: Calculate CO→PO mappings (weighted by correlation level)
# Output: Percentage per PO

# Risk Level
# Input: LES score
# Process: Threshold classification
# Output: Low/Moderate/High
```

---

## 12. Adding New Features

### Complete Workflow: Adding Email Notifications

#### Step 1: Design Data Model

```python
# In database.py
class EmailNotification(Base):
    __tablename__ = "email_notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending, sent, failed
    sent_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
```

#### Step 2: Create Pydantic Schema

```python
# In schemas.py
class EmailNotificationCreate(BaseModel):
    user_id: str
    subject: str
    message: str

class EmailNotificationResponse(EmailNotificationCreate):
    id: str
    status: str
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
```

#### Step 3: Create Email Service

```python
# backend/email_service.py
import smtplib
from email.mime.text import MIMEText

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 587))
        self.sender = os.getenv("SENDER_EMAIL")
        self.password = os.getenv("EMAIL_PASSWORD")

    def send_email(self, recipient: str, subject: str, message: str):
        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender, self.password)

                email = MIMEText(message, "html")
                email["Subject"] = subject
                email["From"] = self.sender
                email["To"] = recipient

                server.send_message(email)
            return True
        except Exception as e:
            print(f"Email send failed: {e}")
            return False

email_service = EmailService()
```

#### Step 4: Add API Endpoints

```python
# In main.py
from email_service import email_service

@app.post("/notifications/send-email")
def send_email_notification(
    notification: schemas.EmailNotificationCreate,
    db: Session = Depends(get_db)
):
    # Get recipient email
    user = db.query(User).filter(User.id == notification.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Try to send
    success = email_service.send_email(
        user.email,
        notification.subject,
        notification.message
    )

    # Record in DB
    record = EmailNotification(
        user_id=notification.user_id,
        subject=notification.subject,
        message=notification.message,
        status="sent" if success else "failed"
    )
    db.add(record)
    db.commit()

    return record

@app.post("/assignments/{assignment_id}/notify-students")
def notify_students_of_assignment(
    assignment_id: str,
    db: Session = Depends(get_db)
):
    # Get assignment
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(404, "Assignment not found")

    # Get enrolled students
    students = db.query(User).filter(User.role == "student").all()

    # Send notifications
    for student in students:
        email_service.send_email(
            student.email,
            f"New Assignment: {assignment.title}",
            f"A new assignment '{assignment.title}' has been created.\n\n{assignment.description}"
        )

    return {"message": f"Notified {len(students)} students"}
```

#### Step 5: Add Frontend Component

```tsx
// In a new file: src/pages/NotificationCenter.tsx
export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);

  const sendNotification = async (
    userIds: string[],
    subject: string,
    message: string,
  ) => {
    await apiClient.post("/notifications/send-email", {
      recipient_ids: userIds,
      subject,
      message,
    });
  };

  return (
    <div>
      <h2>Send Notifications</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Get form data
          // Call sendNotification()
        }}
      >
        <Input placeholder="Subject" />
        <Textarea placeholder="Message" />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
```

#### Step 6: Add Route

```tsx
// In App.tsx
import NotificationCenter from "./pages/NotificationCenter";

<Route
  path="/notifications"
  element={
    <ProtectedRoute>
      <NotificationCenter />
    </ProtectedRoute>
  }
/>;
```

#### Step 7: Add to Navigation

```tsx
// In DashboardLayout.tsx
if (role === "teacher") {
  return (
    <NavLink to="/notifications" icon={<Mail />}>
      Notifications
    </NavLink>
  );
}
```

#### Step 8: Add Environment Variables

```bash
# In .env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

---

## Common Patterns & Best Practices

### ✅ Do's

1. **Always use Pydantic schemas for validation**

   ```python
   # Good
   @app.post("/resource/")
   def create(resource: schemas.ResourceCreate):
       pass

   # Bad
   @app.post("/resource/")
   def create(data: dict):  # No validation!
       pass
   ```

2. **Use async for I/O operations**

   ```python
   # Good
   @app.post("/upload/")
   async def upload(file: UploadFile):
       contents = await file.read()

   # Bad
   @app.post("/upload/")
   def upload(file: UploadFile):  # Blocking!
       contents = file.read()
   ```

3. **Use React Query for server state**

   ```tsx
   // Good
   const { data } = useQuery({
     queryKey: ["assignments"],
     queryFn: () => apiClient.get("/assignments/"),
   });

   // Bad
   const [assignments, setAssignments] = useState([]);
   useEffect(() => {
     fetchAssignments(); // Manual re-fetching!
   }, []);
   ```

4. **Handle errors gracefully**
   ```python
   try:
       # operation
   except SpecificError as e:
       raise HTTPException(status_code=400, detail=str(e))
   except Exception as e:
       raise HTTPException(status_code=500, detail="Server error")
   ```

### ❌ Don'ts

1. **Don't query database in a loop**

   ```python
   # Bad (N+1 query problem)
   for co in cos:
       lo = db.query(LearningOutcome).filter(...).first()

   # Good (Single query with join)
   cos = db.query(CourseOutcome)\
       .options(joinedload(CourseOutcome.learning_outcomes))\
       .all()
   ```

2. **Don't store binary data in database**

   ```python
   # Bad
   file_data = file.read()
   record.file_binary = file_data

   # Good
   filepath = save_file_to_disk(file)
   record.file_path = filepath
   ```

3. **Don't make synchronous requests to AI in endpoint**

   ```python
   # Bad (blocks request)
   @app.post("/generate-plan/")
   def generate():
       plan = generate_study_plan(...)  # Waits 3+ seconds
       return plan

   # Good (queue for async processing)
   @app.post("/generate-plan/")
   def generate(request):
       task_id = queue_advisory_task(request)
       return {"task_id": task_id, "status": "processing"}
   ```

4. **Don't fetch all data without pagination**

   ```python
   # Bad
   users = db.query(User).all()  # 1 million users!

   # Good
   users = db.query(User).limit(10).offset(skip).all()
   ```

---

## Performance Tips

### Backend Optimization

1. **Use database indexes**

   ```python
   email = Column(String, unique=True, index=True)
   student_id = Column(String, ForeignKey(...), index=True)
   ```

2. **Use eager loading**

   ```python
   from sqlalchemy.orm import joinedload

   student = db.query(Student)\
       .options(joinedload(Student.assignments))\
       .filter(...)\
       .first()
   ```

3. **Cache predictions**

   ```python
   from functools import lru_cache

   @lru_cache(maxsize=128)
   def predict_risk(student_id: str):
       # Cached for 1 hour
       pass
   ```

### Frontend Optimization

1. **Lazy load components**

   ```tsx
   const Reports = lazy(() => import("./pages/Reports"))

   <Suspense fallback={<Loading />}>
     <Reports />
   </Suspense>
   ```

2. **Memoize expensive computations**

   ```tsx
   import { useMemo } from "react";

   const sortedData = useMemo(
     () => data.sort((a, b) => b.score - a.score),
     [data],
   );
   ```

3. **Debounce search inputs**

   ```tsx
   const [search, setSearch] = useState("");
   const debouncedSearch = useDebounce(search, 500);

   useEffect(() => {
     if (debouncedSearch) {
       queryClient.invalidateQueries(["search"]);
     }
   }, [debouncedSearch]);
   ```

---

This guide covers the core architecture and patterns used throughout the codebase. Use these as templates when adding new features!
