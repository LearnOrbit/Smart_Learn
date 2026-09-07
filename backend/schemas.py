from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

# ============= AUTH SCHEMAS =============


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserSignUp(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "student"  # "student" or "teacher"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ============= STUDENT SCHEMAS =============


class StudentBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class StudentResponse(StudentBase):
    id: int
    enrollment_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentWithCourses(StudentResponse):
    courses: List['CourseBasic'] = []

# ============= COURSE SCHEMAS =============


class CourseBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    semester: int
    department: str


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    semester: Optional[int] = None
    department: Optional[str] = None


class CourseBasic(BaseModel):
    id: int
    code: str
    name: str
    semester: int
    department: str

    class Config:
        from_attributes = True


class CourseResponse(CourseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CourseWithOutcomes(CourseResponse):
    course_outcomes: List['CourseOutcomeResponse'] = []
    assessments: List['AssessmentBasic'] = []

# ============= PROGRAM OUTCOME SCHEMAS =============


class ProgramOutcomeBase(BaseModel):
    code: str
    description: str
    version: Optional[str] = "1.0"


class ProgramOutcomeCreate(ProgramOutcomeBase):
    pass


class ProgramOutcomeUpdate(BaseModel):
    description: Optional[str] = None
    version: Optional[str] = None


class ProgramOutcomeResponse(ProgramOutcomeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============= COURSE OUTCOME SCHEMAS =============


class CourseOutcomeBase(BaseModel):
    course_id: int
    code: str
    description: str
    bloom_level: str


class CourseOutcomeCreate(CourseOutcomeBase):
    pass


class CourseOutcomeUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    bloom_level: Optional[str] = None


class CourseOutcomeResponse(CourseOutcomeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============= CO-PO MAPPING SCHEMAS =============


class CorrelationLevelEnum(str, Enum):
    WEAK = "weak"
    MEDIUM = "medium"
    STRONG = "strong"


class COPOMappingBase(BaseModel):
    course_outcome_id: int
    program_outcome_id: int
    correlation_level: CorrelationLevelEnum = CorrelationLevelEnum.MEDIUM
    correlation_value: Optional[float] = Field(None, ge=0.0, le=1.0)


class COPOMappingCreate(COPOMappingBase):
    pass


class COPOMappingUpdate(BaseModel):
    correlation_level: Optional[CorrelationLevelEnum] = None
    correlation_value: Optional[float] = Field(None, ge=0.0, le=1.0)


class COPOMappingResponse(COPOMappingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class COPOMappingWithDetails(COPOMappingResponse):
    course_outcome: CourseOutcomeResponse
    program_outcome: ProgramOutcomeResponse

# ============= ASSESSMENT SCHEMAS =============


class AssessmentTypeEnum(str, Enum):
    MCQ = "mcq"
    CODING = "coding"
    DESCRIPTIVE = "descriptive"
    PRACTICAL = "practical"


class AssessmentBase(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = None
    assessment_type: AssessmentTypeEnum
    total_marks: float
    duration_minutes: Optional[int] = None


class AssessmentCreate(AssessmentBase):
    pass


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assessment_type: Optional[AssessmentTypeEnum] = None
    total_marks: Optional[float] = None
    duration_minutes: Optional[int] = None


class AssessmentBasic(BaseModel):
    id: int
    title: str
    assessment_type: AssessmentTypeEnum
    total_marks: float

    class Config:
        from_attributes = True


class AssessmentResponse(AssessmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssessmentWithSubmissions(AssessmentResponse):
    submissions: List['SubmissionBasic'] = []

# ============= SUBMISSION SCHEMAS =============


class SubmissionBase(BaseModel):
    assessment_id: int
    student_id: int
    content: str


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    content: Optional[str] = None


class SubmissionBasic(BaseModel):
    id: int
    submitted_at: datetime

    class Config:
        from_attributes = True


class SubmissionResponse(SubmissionBase):
    id: int
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubmissionWithResult(SubmissionResponse):
    result: Optional['ResultResponse'] = None

# ============= RESULT SCHEMAS =============


class GradingStatusEnum(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ResultBase(BaseModel):
    submission_id: int
    marks_obtained: float
    feedback: Optional[str] = None
    grading_status: GradingStatusEnum = GradingStatusEnum.PENDING


class ResultCreate(ResultBase):
    pass


class ResultUpdate(BaseModel):
    marks_obtained: Optional[float] = None
    feedback: Optional[str] = None
    grading_status: Optional[GradingStatusEnum] = None


class ResultResponse(ResultBase):
    id: int
    evaluated_by: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResultWithSubmission(ResultResponse):
    submission: SubmissionResponse


# Update forward references
StudentWithCourses.model_rebuild()
CourseWithOutcomes.model_rebuild()
COPOMappingWithDetails.model_rebuild()
AssessmentWithSubmissions.model_rebuild()
SubmissionWithResult.model_rebuild()
ResultWithSubmission.model_rebuild()

# ============= ANALYTICS SCHEMAS =============


class StudentPerformanceData(BaseModel):
    """Student performance metrics for ML analysis"""

    student_marks: float = Field(ge=0, le=100)
    attendance: float = Field(ge=0, le=100)
    internal_assessments: float = Field(ge=0, le=20)
    lab_performance: float = Field(ge=0, le=25)
    assignment_scores: float = Field(ge=0, le=10)
    study_hours: float = Field(ge=0)
    concept_mastery: float = Field(ge=0, le=100)


class PredictionResponse(BaseModel):
    """ML prediction response"""

    les: float = Field(ge=0, le=100, description="Learning Efficiency Score")
    risk_level: str = Field(
        description="Risk level: low, moderate, or high"
    )
    metrics: dict = Field(description="Model metrics (R², RMSE, etc.)")
    los_mapping: dict = Field(description="LO-CO-PO mapping and weights")


class GapAnalysisResponse(BaseModel):
    """Learning gap analysis response"""

    weak_concepts: List[str] = Field(default_factory=list)
    low_outcomes: List[str] = Field(default_factory=list)
    skill_deficiencies: List[str] = Field(default_factory=list)


class AdvisoryPlanResponse(BaseModel):
    """Generative AI advisory plan response"""

    study_plan: str
    concept_reinforcement: str
    mini_project: str
    adaptive_schedule: str


class EvaluationResponse(BaseModel):
    """Post-intervention evaluation response"""

    improvement_analysis: str
    updated_les: float
    effectiveness_rating: str
    next_steps: str


# ============= SUBJECT SCHEMAS =============


class SubjectBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = ""


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= PROGRAM OUTCOME SCHEMAS =============


class ProgramOutcomeBase(BaseModel):
    code: str
    description: str
    subject_id: Optional[str] = None


class ProgramOutcomeCreate(ProgramOutcomeBase):
    pass


class ProgramOutcomeUpdate(BaseModel):
    description: Optional[str] = None
    subject_id: Optional[str] = None


class ProgramOutcomeResponse(ProgramOutcomeBase):
    id: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============= COURSE OUTCOME SCHEMAS =============


class CourseOutcomeBase(BaseModel):
    code: str
    description: str
    program_outcome_id: Optional[str] = None
    subject_id: Optional[str] = None


class CourseOutcomeCreate(CourseOutcomeBase):
    pass


class CourseOutcomeUpdate(BaseModel):
    description: Optional[str] = None
    program_outcome_id: Optional[str] = None
    subject_id: Optional[str] = None


class CourseOutcomeResponse(CourseOutcomeBase):
    id: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============= LEARNING OUTCOME SCHEMAS =============


class LearningOutcomeBase(BaseModel):
    code: str
    description: str
    course_outcome_id: Optional[str] = None
    subject_id: Optional[str] = None


class LearningOutcomeCreate(LearningOutcomeBase):
    pass


class LearningOutcomeUpdate(BaseModel):
    description: Optional[str] = None
    course_outcome_id: Optional[str] = None
    subject_id: Optional[str] = None


class LearningOutcomeResponse(LearningOutcomeBase):
    id: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============= PARSED OUTCOME SCHEMAS =============


class ParseOutcomesRequest(BaseModel):
    text: str = Field(..., description="Raw text extracted from a PDF")


class ParsedOutcomeItem(BaseModel):
    type: str = Field(..., description="Outcome type: PO, CO, or LO")
    number: int = Field(..., description="Outcome number")
    code: str = Field(..., description="Full code e.g. PO1, CO3")
    description: str = Field(..., description="Outcome description")
    original_code: Optional[str] = Field(
        None, description="Original course code e.g. CSL603.1")


# ============= BULK IMPORT SCHEMAS =============


class BulkOutcomeItem(BaseModel):
    code: str
    description: str
    type: str  # "PO", "CO", or "LO"


class BulkImportRequest(BaseModel):
    outcomes: List[BulkOutcomeItem]
    subject_id: str


# ============= ASSIGNMENT SCHEMAS =============


class AssignmentCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[datetime] = None
    subject_id: Optional[str] = None
    classroom_id: Optional[str] = None   # ← links assignment to a classroom
    status: Optional[str] = "draft"      # ← "draft" | "published"
    total_marks: Optional[int] = None
    generation_method: Optional[str] = "manual"
    learning_outcome_ids: Optional[List[str]] = []
    # [{question_text, marks, co_id, difficulty}]
    questions: Optional[List[dict]] = []


class QuestionInAssignment(BaseModel):
    id: str
    question_number: int
    question_text: str
    marks: int
    difficulty: Optional[str] = "medium"
    co_id: Optional[str] = None
    co_code: Optional[str] = None

    class Config:
        from_attributes = True


class AssignmentResponse(BaseModel):
    id: str
    teacher_id: str
    title: str
    description: Optional[str] = ""
    due_date: Optional[datetime] = None
    subject_id: Optional[str] = None
    total_marks: Optional[int] = None
    generation_method: Optional[str] = "manual"
    status: Optional[str] = "published"
    created_at: datetime
    updated_at: datetime
    questions: Optional[List[QuestionInAssignment]] = []

    class Config:
        from_attributes = True



# ============= ASSIGNMENT LO MAPPING SCHEMAS =============


class AssignmentLOMappingResponse(BaseModel):
    id: str
    assignment_id: str
    learning_outcome_id: str
    learning_outcome_code: Optional[str] = None
    learning_outcome_description: Optional[str] = None

    class Config:
        from_attributes = True


# ============= API SUBMISSION SCHEMAS =============


class APISubmissionCreate(BaseModel):
    assignment_id: str
    content: str = ""
    # teachers can specify; students default to self
    student_id: Optional[str] = None
    image_path: Optional[str] = None
    pdf_path: Optional[str] = None
    extracted_text: Optional[str] = None


class APISubmissionUpdate(BaseModel):
    marks: Optional[int] = None
    grade: Optional[str] = None
    feedback: Optional[str] = None


class APISubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    content: str
    marks: Optional[int] = None
    grade: Optional[str] = None
    feedback: Optional[str] = None
    image_path: Optional[str] = None
    pdf_path: Optional[str] = None
    extracted_text: Optional[str] = None
    submitted_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============= STUDENT PERFORMANCE SCHEMAS =============


class StudentPerformanceCreate(BaseModel):
    """Data for creating/updating a student's performance metrics."""
    student_id: str
    subject_id: Optional[str] = None
    student_marks: float = Field(ge=0, le=100, default=0)
    attendance: float = Field(ge=0, le=100, default=0)
    internal_assessments: float = Field(ge=0, le=20, default=0)
    lab_performance: float = Field(ge=0, le=25, default=0)
    assignment_scores: float = Field(ge=0, le=10, default=0)
    study_hours: float = Field(ge=0, default=0)
    concept_mastery: float = Field(ge=0, le=100, default=0)
    teacher_remarks: Optional[str] = ""


class StudentPerformanceResponse(BaseModel):
    id: str
    student_id: str
    subject_id: Optional[str] = None
    student_marks: float
    attendance: float
    internal_assessments: float
    lab_performance: float
    assignment_scores: float
    study_hours: float
    concept_mastery: float
    teacher_remarks: Optional[str] = ""
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentListItem(BaseModel):
    """A student user with optional performance data."""
    id: str
    email: str
    name: str
    role: str
    performance: Optional[StudentPerformanceResponse] = None


# ============= ADVANCED ANALYTICS SCHEMAS =============


class ChapterPerformance(BaseModel):
    """Performance data for a specific chapter/topic."""
    chapter_name: str
    marks_obtained: float = Field(ge=0, le=100)
    max_marks: float = Field(ge=0, le=100, default=100)


class InternalAssessmentData(BaseModel):
    """Internal assessment data with two components."""
    ia1: float = Field(ge=0, le=20, description="Internal Assessment 1 (0-20)")
    ia2: float = Field(ge=0, le=20, description="Internal Assessment 2 (0-20)")


class StudentAnalyticsRequest(BaseModel):
    """Request data for comprehensive student analytics."""
    student_id: str
    ia_data: InternalAssessmentData = Field(description="IA1 and IA2 marks")
    chapter_marks: List[ChapterPerformance] = Field(
        description="Chapter-wise performance")
    attendance_percentage: float = Field(ge=0, le=100, default=75)
    lab_performance: float = Field(ge=0, le=25, default=0)
    assignment_scores: float = Field(ge=0, le=10, default=0)


class TopicStudyInfo(BaseModel):
    """Study information for a specific topic."""
    topic_name: str
    performance_level: str  # "Weak", "Moderate", "Strong"
    estimated_hours: float
    priority: int  # 1 (highest) to 3 (lowest)


class StudyPlan(BaseModel):
    """5-day study plan with daily breakdown."""
    day: int
    topics: List[str]
    daily_hours: float
    focus_areas: List[str]


class StudentAnalyticsResponse(BaseModel):
    """Comprehensive analytics response for student."""
    student_id: str

    # Average IA calculation
    average_ia: float = Field(description="Average of IA1 and IA2")

    # Performance classification
    performance_level: str  # "Poor", "Average", "Good", "Excellent"
    performance_score: float  # 0-100 range for classification

    # Chapter-wise analysis
    weak_topics: List[str] = Field(description="Topics with <50% performance")
    moderate_topics: List[str] = Field(
        description="Topics with 50-70% performance")
    strong_topics: List[str] = Field(
        description="Topics with >70% performance")

    # Topic-wise study requirements
    topics_study_info: List[TopicStudyInfo] = Field(
        description="Estimated study time per topic")

    # Overall metrics
    overall_score: float = Field(description="Weighted overall score")
    total_study_hours_needed: float = Field(
        description="Total estimated study hours")
    attendance_percentage: float

    # Recommended 5-day study plan
    five_day_study_plan: List[StudyPlan] = Field(
        description="Auto-generated 5-day study plan")

    # Additional insights
    key_recommendations: List[str] = Field(
        description="Key recommendations for improvement")
    next_milestones: List[str] = Field(
        description="Suggested next learning milestones")


class StudentListItem(BaseModel):
    """A student user with optional performance data."""
    id: str
    email: str
    name: str
    role: str
    performance: Optional[StudentPerformanceResponse] = None

    class Config:
        from_attributes = True


# ============= CO-PO MAPPING (Active) =============

class COPOMappingActiveCreate(BaseModel):
    course_outcome_id: str
    program_outcome_id: str
    correlation_level: int = 2  # 1, 2, or 3


class COPOMappingActiveUpdate(BaseModel):
    correlation_level: int


class COPOMappingActiveResponse(BaseModel):
    id: str
    course_outcome_id: str
    program_outcome_id: str
    correlation_level: int
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============= QUESTION SCHEMAS =============

class QuestionCreate(BaseModel):
    question_text: str
    marks: int = 10
    co_id: Optional[str] = None
    difficulty: Optional[str] = "medium"


class QuestionResponse(BaseModel):
    id: str
    assignment_id: str
    question_number: int
    question_text: str
    marks: int
    co_id: Optional[str] = None
    difficulty: Optional[str] = "medium"
    created_at: datetime

    class Config:
        from_attributes = True


# ============= MODEL SOLUTION SCHEMAS =============

class ModelSolutionCreate(BaseModel):
    assignment_id: str
    question_id: Optional[str] = None
    solution_text: Optional[str] = ""
    rubric: Optional[str] = ""


class ModelSolutionResponse(BaseModel):
    id: str
    assignment_id: str
    question_id: Optional[str] = None
    solution_text: Optional[str] = ""
    rubric: Optional[str] = ""
    file_path: Optional[str] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============= QUESTION EVALUATION SCHEMAS =============

class QuestionEvaluationResponse(BaseModel):
    id: str
    submission_id: str
    question_id: str
    student_answer_text: Optional[str] = ""
    ai_score: Optional[float] = None
    final_score: Optional[float] = None
    max_marks: int
    similarity_score: Optional[float] = None
    teacher_override: Optional[float] = None
    evaluation_feedback: Optional[str] = ""
    evaluated_at: datetime

    class Config:
        from_attributes = True


class TeacherOverrideRequest(BaseModel):
    final_score: float
    feedback: Optional[str] = None


# ============= QUESTION GENERATION SCHEMAS =============

class COBasedGenerationRequest(BaseModel):
    """Generate questions based on selected COs"""
    co_ids: List[str]
    num_questions: int = 5
    difficulty: Optional[str] = "medium"  # easy | medium | hard
    marks_per_question: int = 10


class SyllabusGenerationRequest(BaseModel):
    """Generate questions from uploaded syllabus text"""
    syllabus_text: str
    num_questions: int = 5
    difficulty: Optional[str] = "medium"
    marks_per_question: int = 10


# ============= LES ENGINE SCHEMAS (NEW) =============

class LESSnapshotCreate(BaseModel):
    """Create or save a Learning Efficiency Score snapshot"""
    student_id: str
    subject_id: Optional[str] = None
    submission_id: Optional[str] = None
    post_score: float = Field(
        ge=0, le=100, description="Score after intervention")
    student_data: dict = Field(
        ..., description="Student metrics: attendance, assignment_scores, etc.")
    snapshot_type: str = "auto"


class LESSnapshotResponse(BaseModel):
    """LES snapshot data"""
    id: str
    les: float = Field(ge=0, le=100, description="Learning Efficiency Score")
    pre_score: Optional[float] = Field(description="Pre-intervention score")
    post_score: float = Field(
        ge=0, le=100, description="Post-intervention score")
    risk_level: str = Field(description="Low, Moderate, or High")
    created_at: str

    class Config:
        from_attributes = True


class InterventionLogCreate(BaseModel):
    """Log a study plan intervention"""
    student_id: str
    subject_id: Optional[str] = None
    les_at_intervention: float = Field(
        ge=0, le=100, description="LES when plan was created")
    risk_at_intervention: str = Field(
        description="Risk level at time of intervention")
    weak_concepts: List[str] = Field(
        default_factory=list, description="Areas identified as weak")
    advisory_plan: str = Field(..., description="Generated study plan text")


class InterventionLogResponse(BaseModel):
    """Intervention log record"""
    id: str
    student_id: str
    les_at_intervention: float
    created_at: str

    class Config:
        from_attributes = True


class RetrainResponse(BaseModel):
    """ML model retrain result"""
    version: Optional[int] = Field(
        None, description="New model version number")
    r_squared: Optional[float] = Field(None, description="Model R² accuracy")
    rmse: Optional[float] = Field(None, description="Root mean squared error")
    mae: Optional[float] = Field(None, description="Mean absolute error")
    cross_val_score: Optional[float] = Field(
        None, description="Cross-validation score")
    training_samples: Optional[int] = Field(
        None, description="Number of samples used")
    error: Optional[str] = Field(
        None, description="Error message if retrain failed")


class LESHistoryResponse(BaseModel):
    """LES history trend data"""
    student_id: str
    history: List[dict] = Field(...,
                                description="List of LES records with timestamps")


class ModelStatusResponse(BaseModel):
    """Current active ML model status"""
    version: Optional[int] = Field(None, description="Model version")
    model_type: Optional[str] = Field(None, description="e.g., RandomForest")
    r_squared: Optional[float] = Field(None, description="Accuracy metric")
    rmse: Optional[float] = Field(None, description="Prediction error")
    mae: Optional[float] = Field(None, description="Mean absolute error")
    cross_val_score: Optional[float] = Field(
        None, description="Cross-validation performance")
    training_samples: Optional[int] = Field(
        None, description="Records used for training")
    trigger: Optional[str] = Field(
        None, description="What triggered this version (manual/feedback_loop)")
    trained_at: Optional[str] = Field(
        None, description="When model was trained")
    status: Optional[str] = Field(None, description="no_model or similar")
    message: Optional[str] = Field(None, description="Status message")


# ============= ANNOUNCEMENT SCHEMAS =============

class AnnouncementCreate(BaseModel):
    """Create a new announcement"""
    title: Optional[str] = ""
    message: str
    subject_id: Optional[str] = None
    pinned: Optional[bool] = False


class AnnouncementUpdate(BaseModel):
    """Update an announcement"""
    title: Optional[str] = None
    message: Optional[str] = None
    pinned: Optional[bool] = None


class AnnouncementResponse(BaseModel):
    """Announcement response"""
    id: str
    teacher_id: str
    teacher_name: str
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    title: str
    message: str
    pinned: bool
    created_at: str
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class AnnouncementsListResponse(BaseModel):
    """List of announcements"""
    announcements: List[AnnouncementResponse]


# ============= AI ASSESSMENT GENERATOR SCHEMAS =============
# These mirror the JSON shapes that the prompts module produces and
# the route layer returns. The route layer uses them as `response_model`
# so the OpenAPI docs are accurate and the frontend gets typed JSON.

# Single-item shapes --------------------------------------------------

class AIGeneratedQA(BaseModel):
    """A single Q&A as returned by the AI (and as stored in AIQuestion)."""
    question: str
    answer: str
    marks: int = Field(..., ge=1, le=100)
    difficulty: str  # easy|medium|hard
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    source_type: Optional[str] = "topic"  # topic|syllabus|document


class AIGeneratedMCQ(BaseModel):
    """A single MCQ as returned by the AI (and as stored in MCQQuestion)."""
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str  # A|B|C|D
    explanation: Optional[str] = ""
    marks: int = Field(default=1, ge=1, le=100)
    difficulty: str
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    source_type: Optional[str] = "topic"


# Request/response envelopes ------------------------------------------

class AIGenerateQaRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    co_id: Optional[str] = None
    co_code: Optional[str] = None
    co_description: Optional[str] = None
    difficulty: str = "medium"
    marks: int = Field(default=5, ge=1, le=100)
    count: int = Field(default=5, ge=1, le=20)
    source_type: str = "topic"  # topic|syllabus|document
    source_text: Optional[str] = None
    subject_id: Optional[str] = None


class AIGenerateQaResponse(BaseModel):
    questions: List[AIGeneratedQA]


class AIGenerateMCQRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    co_id: Optional[str] = None
    co_code: Optional[str] = None
    co_description: Optional[str] = None
    difficulty: str = "medium"
    marks: int = Field(default=1, ge=1, le=100)
    count: int = Field(default=5, ge=1, le=20)
    source_type: str = "topic"
    source_text: Optional[str] = None
    subject_id: Optional[str] = None


class AIGenerateMCQResponse(BaseModel):
    mcqs: List[AIGeneratedMCQ]


class AIRegenerateRequest(BaseModel):
    kind: str = Field(..., pattern="^(qa|mcq)$")
    previous: dict
    instruction: str = Field(..., min_length=1)


class AIRegenerateResponse(BaseModel):
    question: Optional[AIGeneratedQA] = None
    mcq: Optional[AIGeneratedMCQ] = None


# Persisted-row output shapes -----------------------------------------

class AIQuestionOut(BaseModel):
    id: str
    question_text: str
    answer: str
    marks: int
    difficulty: str
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    source_type: str
    source_ref: Optional[str] = None
    subject_id: Optional[str] = None
    co_id: Optional[str] = None
    topic: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AIMCQOut(BaseModel):
    id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    explanation: str
    marks: int
    difficulty: str
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    subject_id: Optional[str] = None
    co_id: Optional[str] = None
    topic: Optional[str] = None
    source: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AIQuestionListResponse(BaseModel):
    questions: List[AIQuestionOut]


class AIMCQListResponse(BaseModel):
    mcqs: List[AIMCQOut]


# Save / delete envelopes ---------------------------------------------

class AIQuestionSaveRequest(BaseModel):
    """Payload to persist a single Q&A. The model layer fills in
    `created_by` and `created_at`; the frontend sends the rest."""
    question_text: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    marks: int = Field(default=5, ge=1, le=100)
    difficulty: str = "medium"
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    source_type: str = "topic"
    source_ref: Optional[str] = None
    subject_id: Optional[str] = None
    co_id: Optional[str] = None
    topic: Optional[str] = None


class MCQSaveRequest(BaseModel):
    question_text: str = Field(..., min_length=1)
    option_a: str = Field(..., min_length=1)
    option_b: str = Field(..., min_length=1)
    option_c: str = Field(..., min_length=1)
    option_d: str = Field(..., min_length=1)
    correct_answer: str = Field(..., pattern="^[ABCD]$")
    explanation: str = ""
    marks: int = Field(default=1, ge=1, le=100)
    difficulty: str = "medium"
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None
    subject_id: Optional[str] = None
    co_id: Optional[str] = None
    topic: Optional[str] = None
    source: Optional[str] = "ai"


# Quiz ----------------------------------------------------------------

class QuizCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    mcq_ids: List[str] = Field(..., min_length=1)


class QuizMCQOut(BaseModel):
    id: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    explanation: str
    marks: int
    difficulty: str
    bloom_level: Optional[str] = None
    course_outcome_code: Optional[str] = None


class QuizQuestionOut(BaseModel):
    position: int
    mcq: QuizMCQOut


class QuizOut(BaseModel):
    id: str
    title: str
    description: str
    created_by: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    questions: List[QuizQuestionOut] = []


class QuizListResponse(BaseModel):
    quizzes: List[QuizOut]


# Misc helpers --------------------------------------------------------

class ExtractSourceResponse(BaseModel):
    """Returned by /api/ai/extract-source after OCR / PDF text extract.

    The route layer reuses the existing /api/extract-text/pdf and
    /api/extract-text/image endpoints internally; this is just a
    convenience for the AI generator page so the UI doesn't have to
    branch on file type.
    """
    text: str
    pages: Optional[int] = None
    file_name: Optional[str] = None


# ============= quick-quiz (student + teacher) ==============================


class QuickQuizRequest(BaseModel):
    """Request body for /api/ai/quick-quiz.

    Open to BOTH students and teachers — the route does NOT gate on
    role. No DB write; the response is ephemeral and the quiz lives
    only in the browser tab.

    Caps are intentionally smaller than the full AI generator:
      - topic length 1..200 (the full generator has no explicit cap)
      - count 1..15 (the full generator allows up to 20)
    Difficulty is constrained to the three known levels so the
    prompt layer doesn't have to validate.
    """
    topic: str = Field(..., min_length=1, max_length=200)
    count: int = Field(default=5, ge=1, le=15)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    co_code: Optional[str] = None
    co_description: Optional[str] = None
    subject_id: Optional[str] = None
