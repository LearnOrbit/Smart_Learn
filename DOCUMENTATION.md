# AcademiQ — Academic Process Automation System

## Complete Project Documentation

**Version:** 1.0.0  
**Last Updated:** March 7, 2026  
**Status:** Core System Complete — Production Ready for Pilot

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Getting Started](#4-getting-started)
5. [Database Schema](#5-database-schema)
6. [Backend API Reference](#6-backend-api-reference)
7. [Frontend Pages & Features](#7-frontend-pages--features)
8. [AI & ML Layer](#8-ai--ml-layer)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Project Completion Status](#10-project-completion-status)

---

## 1. Project Overview

**AcademiQ** is a full-stack academic process automation platform designed for outcome-based education (OBE). It automates the end-to-end workflow for teachers and students — from defining learning outcomes, creating assignments, collecting submissions, AI-powered evaluation, to generating attainment reports.

### Key Capabilities

| Capability               | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Outcome Management**   | Define and manage PO → CO → LO hierarchies per subject                                       |
| **Assignment System**    | Create assignments manually or via AI (CO-based / syllabus-based question generation)        |
| **Student Submissions**  | Single-PDF upload flow with automatic text extraction                                        |
| **AI Evaluation**        | Automated answer evaluation using TF-IDF cosine similarity against model solutions           |
| **CO-PO Mapping**        | Visual correlation matrix (1/2/3 levels) between Course Outcomes and Program Outcomes        |
| **Attainment Reporting** | Auto-computed LO → CO → PO attainment scores from graded submissions                         |
| **Predictive Analytics** | ML-based risk prediction (Learning Efficiency Score) using Random Forest + Gradient Boosting |
| **AI Advisory**          | Claude-powered personalized study plans, concept reinforcement, and adaptive schedules       |
| **Student Chatbot**      | AI assistant for students with performance-aware context                                     |
| **CSV Export**           | Downloadable reports for CO attainment, PO attainment, and student performance               |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│         Vite + TypeScript + shadcn/ui + TanStack     │
│                  Port 8080                           │
├─────────────────────────────────────────────────────┤
│                     API Client                       │
│            fetch() → http://localhost:8002/api        │
├─────────────────────────────────────────────────────┤
│                 Backend (FastAPI)                     │
│       Python 3.11 + SQLAlchemy + Pydantic            │
│                  Port 8002                           │
├──────────┬──────────┬──────────┬────────────────────┤
│ Auth     │ CRUD     │ ML       │ AI (Claude)        │
│ (JWT)    │ Endpoints│ Pipeline │ Advisory Layer     │
├──────────┴──────────┴──────────┴────────────────────┤
│              SQLite (core_quest.db)                   │
│         (PostgreSQL-ready via DATABASE_URL)           │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
core-quest-forge-00/
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints (~3200 lines)
│   ├── database.py           # SQLAlchemy models & engine
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── auth.py               # JWT + bcrypt authentication
│   ├── ai_advisory.py        # Claude AI integration (study plans, advisory)
│   ├── ml_models.py          # Scikit-learn ML pipeline (risk prediction)
│   ├── outcome_parser.py     # NLP-based outcome text parser
│   ├── models.py             # Legacy ORM models (Student, Course, etc.)
│   ├── seed_test_students.py # Seed script — 3 demo students + sample data
│   ├── migrate_*.py          # DB migration scripts
│   ├── core_quest.db         # SQLite database file
│   ├── uploads/              # Uploaded files (PDFs, images)
│   └── requirements.txt      # Python dependencies
│
├── src/
│   ├── App.tsx               # Route definitions
│   ├── main.tsx              # React entry point
│   ├── components/
│   │   ├── DashboardLayout.tsx  # Sidebar navigation (teacher/student)
│   │   ├── ProtectedRoute.tsx   # Auth guard wrapper
│   │   ├── NavLink.tsx          # Navigation link component
│   │   └── ui/                  # shadcn/ui component library (50+ components)
│   ├── hooks/
│   │   ├── useAuth.tsx          # Auth context hook
│   │   ├── AuthProvider.tsx     # Auth state provider
│   │   └── use-toast.ts         # Toast notification hook
│   ├── integrations/
│   │   └── api/client.ts        # API client (GET/POST/PUT/DELETE/FormData)
│   └── pages/
│       ├── Auth.tsx             # Login / Sign-up page
│       ├── Index.tsx            # Landing page
│       ├── Dashboard.tsx        # Route switcher (teacher → TeacherDashboard, student → StudentDashboard)
│       ├── TeacherDashboard.tsx # Teacher: assignment management, submissions overview
│       ├── StudentDashboard.tsx # Student: view assignments, upload PDF submissions
│       ├── OutcomesManager.tsx  # CRUD for PO/CO/LO with AI text parsing
│       ├── ScoresDashboard.tsx  # Teacher: grade submissions; Student: view scores
│       ├── COPOMapping.tsx      # CO-PO correlation matrix editor
│       ├── Reports.tsx          # Attainment reports with CSV export
│       ├── Analytics.tsx        # Teacher: student analytics + metrics; Student: own performance
│       ├── SubjectsManager.tsx  # Subject CRUD
│       ├── FeedbackTools.tsx    # AI-powered advisory plan generator
│       ├── AssignmentCreator.tsx # Create assignments (manual/CO-based/syllabus-based + model solutions)
│       ├── EvaluationReview.tsx # AI evaluation trigger, per-question scores, teacher override
│       ├── StudentChatbot.tsx   # AI chatbot for students
│       └── NotFound.tsx         # 404 page
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 3. Tech Stack

### Frontend

| Technology               | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| **React 18**             | UI framework                                   |
| **TypeScript**           | Type safety                                    |
| **Vite**                 | Build tool & dev server                        |
| **TanStack React Query** | Server state management & caching              |
| **React Router DOM v6**  | Client-side routing                            |
| **shadcn/ui**            | Component library (50+ Radix-based components) |
| **Tailwind CSS**         | Utility-first styling                          |
| **Recharts**             | Data visualization (charts)                    |
| **Lucide React**         | Icon library                                   |
| **Tesseract.js**         | Client-side OCR (image text extraction)        |
| **Zod**                  | Schema validation                              |
| **Vitest**               | Unit testing framework                         |

### Backend

| Technology               | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| **Python 3.11**          | Runtime                                                             |
| **FastAPI**              | Web framework                                                       |
| **SQLAlchemy 2.0**       | ORM & database toolkit                                              |
| **Pydantic v2**          | Data validation & serialization                                     |
| **SQLite**               | Default database (PostgreSQL-compatible)                            |
| **bcrypt**               | Password hashing                                                    |
| **python-jose**          | JWT token generation/verification                                   |
| **scikit-learn**         | ML pipeline (Random Forest, Gradient Boosting, Logistic Regression) |
| **Anthropic SDK**        | Claude API integration for AI features                              |
| **PyMuPDF / pdfplumber** | PDF text extraction                                                 |

---

## 4. Getting Started

### Prerequisites

- **Node.js** ≥ 18 (or Bun)
- **Python** ≥ 3.11
- **Anthropic API Key** (for AI features — optional)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# (Optional) Set environment variables
# Create .env file with:
# ANTHROPIC_API_KEY=sk-ant-...
# SECRET_KEY=your-jwt-secret

# Seed demo data (optional)
python seed_test_students.py

# Start server
uvicorn main:app --reload --port 8002
```

### Frontend Setup

```bash
# From project root
npm install        # or: bun install

# Start dev server
npm run dev        # Runs on http://localhost:8080
```

### Demo Accounts

| Role    | Email                        | Password     |
| ------- | ---------------------------- | ------------ |
| Teacher | `teacher@academiq.com`       | `teacher123` |
| Student | `alice.student@academiq.com` | `student123` |
| Student | `bob.student@academiq.com`   | `student123` |
| Student | `carol.student@academiq.com` | `student123` |

---

## 5. Database Schema

### Entity-Relationship Overview

```
Subject ─┬── ProgramOutcome (PO)
         │      └── CourseOutcome (CO)
         │             └── LearningOutcome (LO)
         │
         └── Assignment ─┬── Question
                         ├── ModelSolution
                         ├── AssignmentLOMapping → LO
                         └── Submission ─── QuestionEvaluation
                                │
                                └── (student_id → User)

User ─┬── StudentPerformance
      └── Analytics

COPOMappingActive ── (CO ↔ PO correlation)
```

### Tables

| Table                   | Description                                   | Key Fields                                                                   |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `users`                 | All users (teachers + students)               | id (UUID), email, full_name, password_hash, role                             |
| `subjects`              | Academic subjects                             | code (unique), name, description                                             |
| `program_outcomes`      | PO definitions                                | code, description, subject_id                                                |
| `course_outcomes`       | CO definitions                                | code, description, program_outcome_id, subject_id                            |
| `learning_outcomes`     | LO definitions                                | code, description, course_outcome_id, subject_id                             |
| `co_po_mappings_active` | CO↔PO correlation levels                      | course_outcome_id, program_outcome_id, correlation_level (1/2/3)             |
| `assignments`           | Teacher-created assignments                   | title, description, subject_id, total_marks, generation_method, due_date     |
| `questions`             | Per-assignment questions                      | question_text, marks, co_id, difficulty (easy/medium/hard)                   |
| `model_solutions`       | Expected answers per question                 | solution_text, rubric, file_path                                             |
| `assignment_lo_mapping` | Assignment ↔ LO links (for score computation) | assignment_id, learning_outcome_id                                           |
| `submissions`           | Student assignment submissions                | content, marks, grade, feedback, pdf_path, extracted_text                    |
| `question_evaluations`  | Per-question AI evaluation results            | ai_score, final_score, similarity_score, teacher_override                    |
| `student_performance`   | Teacher-entered performance metrics           | student_marks, attendance, internals, lab, assignments, study_hours, mastery |
| `analytics`             | Performance tracking records                  | student_id, assignment_id, performance_score, engagement_level               |

---

## 6. Backend API Reference

**Base URL:** `http://localhost:8002`  
**Authenticated endpoints require:** `Authorization: Bearer <jwt_token>` header  
**Total Endpoints:** ~120

### Authentication

| Method | Endpoint       | Description                                          |
| ------ | -------------- | ---------------------------------------------------- |
| POST   | `/auth/signup` | Register new user (email, password, full_name, role) |
| POST   | `/auth/login`  | Login → returns JWT token                            |
| GET    | `/auth/me`     | Get current user profile                             |

### Subjects

| Method | Endpoint            | Auth    | Description       |
| ------ | ------------------- | ------- | ----------------- |
| POST   | `/api/subjects`     | Teacher | Create subject    |
| GET    | `/api/subjects`     | Any     | List all subjects |
| GET    | `/api/subjects/:id` | Any     | Get subject by ID |
| PUT    | `/api/subjects/:id` | Teacher | Update subject    |
| DELETE | `/api/subjects/:id` | Teacher | Delete subject    |

### Outcome Management (PO / CO / LO)

Each outcome type (program-outcomes, course-outcomes, learning-outcomes) has full CRUD:

| Method | Endpoint Pattern   | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| POST   | `/api/{type}`      | Create outcome                                 |
| GET    | `/api/{type}`      | List all (filterable by subject_id, parent_id) |
| GET    | `/api/{type}/:id`  | Get by ID                                      |
| PUT    | `/api/{type}/:id`  | Update                                         |
| DELETE | `/api/{type}/:id`  | Delete                                         |
| POST   | `/api/{type}/bulk` | Bulk import                                    |

**AI Parsing:**

| Method | Endpoint              | Description                                                  |
| ------ | --------------------- | ------------------------------------------------------------ |
| POST   | `/api/parse-outcomes` | Extract structured PO/CO/LO from unstructured text using NLP |

### CO-PO Mapping

| Method | Endpoint                  | Description                                   |
| ------ | ------------------------- | --------------------------------------------- |
| GET    | `/api/co-po-mappings`     | List all mappings                             |
| POST   | `/api/co-po-mappings`     | Create/update mapping (CO + PO + level 1/2/3) |
| DELETE | `/api/co-po-mappings/:id` | Remove mapping                                |

### Assignments & Questions

| Method | Endpoint                         | Description                                 |
| ------ | -------------------------------- | ------------------------------------------- |
| POST   | `/api/assignments`               | Create assignment (with LO mappings)        |
| GET    | `/api/assignments`               | List assignments (filterable by teacher_id) |
| GET    | `/api/assignments/:id`           | Get assignment details                      |
| DELETE | `/api/assignments/:id`           | Delete assignment + cascade                 |
| GET    | `/api/assignments/:id/questions` | List questions for assignment               |
| POST   | `/api/assignments/:id/questions` | Add questions to assignment                 |
| DELETE | `/api/questions/:id`             | Delete a question                           |

**AI Question Generation:**

| Method | Endpoint                                 | Description                                                    |
| ------ | ---------------------------------------- | -------------------------------------------------------------- |
| POST   | `/api/generate-questions/co-based`       | Generate questions based on Course Outcomes + Bloom's taxonomy |
| POST   | `/api/generate-questions/syllabus-based` | Generate questions from syllabus text                          |

### Model Solutions

| Method | Endpoint                          | Description                                      |
| ------ | --------------------------------- | ------------------------------------------------ |
| POST   | `/api/model-solutions`            | Save model solution (text + rubric per question) |
| GET    | `/api/model-solutions`            | List solutions (by assignment_id)                |
| DELETE | `/api/model-solutions/:id`        | Delete solution                                  |
| POST   | `/api/model-solutions/upload-pdf` | Bulk upload PDF solution → text extraction       |

### Submissions

| Method | Endpoint                     | Description                                            |
| ------ | ---------------------------- | ------------------------------------------------------ |
| POST   | `/api/submissions`           | Create submission (student or teacher on behalf)       |
| GET    | `/api/submissions`           | List submissions (filter by assignment_id, student_id) |
| PUT    | `/api/submissions/:id`       | Update marks/grade/feedback                            |
| POST   | `/api/upload-submission-pdf` | Upload student answer PDF → text extraction            |
| POST   | `/api/upload-image`          | Upload image file                                      |

### AI Evaluation

| Method | Endpoint                          | Description                                                    |
| ------ | --------------------------------- | -------------------------------------------------------------- |
| POST   | `/api/evaluate-submission/:id`    | Run AI evaluation (TF-IDF cosine similarity vs model solution) |
| GET    | `/api/evaluations/:submission_id` | Get evaluation results per question                            |
| PUT    | `/api/evaluations/:id/override`   | Teacher override of AI score                                   |

### Text Extraction

| Method | Endpoint                  | Description                      |
| ------ | ------------------------- | -------------------------------- |
| POST   | `/api/extract-text/pdf`   | Extract text from uploaded PDF   |
| POST   | `/api/extract-text/image` | Extract text from uploaded image |

### Student Scores & Performance

| Method | Endpoint                       | Description                                            |
| ------ | ------------------------------ | ------------------------------------------------------ |
| GET    | `/api/student-scores/:id`      | Compute LO → CO → PO attainment for a student          |
| GET    | `/api/students-list`           | List all students with performance data (teacher only) |
| DELETE | `/api/students/:id`            | Delete student + all related data (teacher only)       |
| POST   | `/api/student-performance`     | Create/update student performance metrics              |
| GET    | `/api/student-performance/:id` | Get student performance data                           |

### Reports

| Method | Endpoint                               | Description                      |
| ------ | -------------------------------------- | -------------------------------- |
| GET    | `/api/reports/co-attainment`           | CO attainment summary            |
| GET    | `/api/reports/po-attainment`           | PO attainment summary            |
| GET    | `/api/reports/student-performance-csv` | Download student performance CSV |
| GET    | `/api/reports/co-attainment-csv`       | Download CO attainment CSV       |
| GET    | `/api/reports/po-attainment-csv`       | Download PO attainment CSV       |

### AI Advisory & Chatbot

| Method | Endpoint                           | Description                                    |
| ------ | ---------------------------------- | ---------------------------------------------- |
| POST   | `/analytics/advisory-plan`         | Generate personalized study plan (Claude API)  |
| POST   | `/analytics/predict`               | ML-based risk prediction                       |
| POST   | `/analytics/gap-analysis`          | Identify learning gaps                         |
| POST   | `/analytics/evaluate-intervention` | Evaluate intervention effectiveness            |
| POST   | `/api/chat`                        | Student AI chatbot (Claude, performance-aware) |

---

## 7. Frontend Pages & Features

### Teacher Portal

| Page                  | Route                | Features                                                                                                                                                |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assignments**       | `/dashboard`         | View all assignments, see submission counts, manage assignments                                                                                         |
| **Outcomes Manager**  | `/outcomes`          | Full CRUD for PO/CO/LO hierarchy, AI text parsing, bulk import                                                                                          |
| **Scores**            | `/scores`            | Select student → grade submissions (marks/grade/feedback), view LO→CO→PO scores                                                                         |
| **Create Assignment** | `/create-assignment` | 3 modes: Manual, CO-Based (AI), Syllabus-Based (AI). Per-question model solutions + rubrics. Bulk PDF solution upload                                   |
| **Evaluation**        | `/evaluation`        | Trigger AI evaluation on submissions, view per-question AI scores, teacher override                                                                     |
| **CO-PO Mapping**     | `/co-po-mapping`     | Interactive correlation matrix (CO vs PO), set levels 1/2/3                                                                                             |
| **Reports**           | `/reports`           | CO attainment charts, PO attainment charts, CSV downloads                                                                                               |
| **Analytics**         | `/analytics`         | Student list with search, performance metrics (marks, attendance, internals, lab, assignments, study hours, mastery), risk badges, edit/delete students |
| **Subjects**          | `/subjects`          | CRUD for academic subjects                                                                                                                              |
| **Feedback Tools**    | `/feedback`          | AI-powered advisory plan generator (study plan, concept reinforcement, mini-project, adaptive schedule)                                                 |

### Student Portal

| Page             | Route        | Features                                                                                                                                                |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assignments**  | `/dashboard` | View assigned work, expand to see questions, upload single PDF answer, see submission status with timestamp                                             |
| **My Scores**    | `/scores`    | View graded assignments (marks, grade, feedback), performance trends (moving average, overall average), LO/CO/PO attainment bars, AI-generated feedback |
| **Analytics**    | `/analytics` | Personal performance metrics, risk assessment, teacher remarks                                                                                          |
| **AI Assistant** | `/chatbot`   | Chat interface with Claude AI, context-aware (knows student's performance + submissions)                                                                |

### Shared Components

| Component         | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `DashboardLayout` | Fixed 250px sidebar with grouped navigation, mobile hamburger menu, user info footer |
| `ProtectedRoute`  | Auth guard — redirects to `/auth` if not logged in                                   |
| `ApiClient`       | Centralized fetch wrapper with JWT token management, auto-redirect on 401            |

---

## 8. AI & ML Layer

### Machine Learning Pipeline (`ml_models.py`)

| Model                     | Algorithm                   | Purpose                                                |
| ------------------------- | --------------------------- | ------------------------------------------------------ |
| **LES Predictor**         | Random Forest Regressor     | Predict Learning Efficiency Score from 7 input metrics |
| **Risk Classifier**       | Logistic Regression         | Classify students as low/medium/high risk              |
| **Performance Predictor** | Gradient Boosting Regressor | Predict future performance scores                      |

**Input Features:** student_marks, attendance, internal_assessments, lab_performance, assignment_scores, study_hours, concept_mastery

### AI Advisory Layer (`ai_advisory.py`)

Powered by **Claude 3.5 Sonnet** via the Anthropic SDK:

| Function                             | Description                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `generate_study_plan()`              | Personalized weekly study schedule based on weak areas & risk level           |
| `generate_concept_reinforcement()`   | Targeted reinforcement strategy for specific concepts                         |
| `identify_gaps()`                    | Analyze performance to detect weak concepts, low outcomes, skill deficiencies |
| `generate_mini_project()`            | Suggest project combining weak areas with student interests                   |
| `generate_adaptive_schedule()`       | Modified weekly schedule prioritizing weak areas                              |
| `generate_intervention_evaluation()` | Evaluate effectiveness of educational interventions                           |

### AI Evaluation Engine

- **Method:** TF-IDF vectorization + cosine similarity
- **Process:** Student answer text is compared against model solution text per question
- **Output:** Similarity score (0–1) scaled to question marks, with evaluation feedback
- **Teacher Override:** Teachers can manually adjust any AI-generated score

### Student Chatbot

- **Model:** Claude 3.5 Sonnet
- **Context:** Injects student's performance data + recent submission grades/feedback
- **History:** Maintains conversation history (last 20 messages) for continuity
- **Scope:** Study tips, concept explanations, coursework help, performance advice

---

## 9. Authentication & Authorization

### Flow

1. User signs up at `/auth` → `POST /auth/signup` → password hashed with bcrypt, stored in `users` table
2. User logs in → `POST /auth/login` → JWT token returned (HS256, 30-min expiry)
3. Token stored in `localStorage` by the API client
4. All protected API calls include `Authorization: Bearer <token>` header
5. Backend `get_current_user` dependency decodes JWT, fetches user from DB
6. Frontend `ProtectedRoute` component redirects to `/auth` if no valid session
7. API client auto-redirects to `/auth` on 401 response

### Roles

| Role        | Access                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| **teacher** | Full access to all features — create/manage assignments, grade, view all students, analytics, reports, AI tools |
| **student** | View own assignments, upload submissions, view own scores/analytics, use AI chatbot                             |

### Role-Based UI

The `DashboardLayout` sidebar renders different navigation groups based on `role`. The `Dashboard` page routes to `TeacherDashboard` or `StudentDashboard` based on role. Backend endpoints enforce role checks via `get_current_user`.

---

## 10. Project Completion Status

### Overall Progress: ~95% Core Features Complete

### Feature Completion Matrix

| #   | Module                            | Status      | Details                                                                        |
| --- | --------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| 1   | **Authentication (Login/Signup)** | ✅ Complete | JWT auth, bcrypt, role-based access, auto-redirect                             |
| 2   | **Subject Management**            | ✅ Complete | Full CRUD, teacher-only                                                        |
| 3   | **Outcome Hierarchy (PO/CO/LO)**  | ✅ Complete | Full CRUD, bulk import, AI text parsing, subject-linked                        |
| 4   | **CO-PO Mapping Matrix**          | ✅ Complete | Interactive grid, 3 correlation levels, persisted                              |
| 5   | **Assignment Creation**           | ✅ Complete | Manual + AI (CO-based, syllabus-based), model solutions, rubrics               |
| 6   | **Question Generation (AI)**      | ✅ Complete | CO-based with Bloom's taxonomy, syllabus-based extraction                      |
| 7   | **Model Solutions**               | ✅ Complete | Per-question text + rubric, bulk PDF upload with extraction                    |
| 8   | **Student Submissions**           | ✅ Complete | Single-PDF upload, text extraction, status tracking                            |
| 9   | **AI Evaluation**                 | ✅ Complete | TF-IDF cosine similarity, per-question scoring, feedback                       |
| 10  | **Teacher Override**              | ✅ Complete | Manual score adjustment on any AI evaluation                                   |
| 11  | **Grading System**                | ✅ Complete | Marks, grade, feedback per submission                                          |
| 12  | **Score Computation (LO→CO→PO)**  | ✅ Complete | Auto-computed from graded submissions + LO mappings                            |
| 13  | **Student Scores View**           | ✅ Complete | Graded assignments, attainment bars, trend analysis, feedback                  |
| 14  | **Reports & CSV Export**          | ✅ Complete | CO attainment, PO attainment, student performance CSVs                         |
| 15  | **Analytics Dashboard**           | ✅ Complete | Teacher: student list, metrics, risk badges, edit/delete. Student: own metrics |
| 16  | **ML Risk Prediction**            | ✅ Complete | Random Forest + Logistic Regression pipeline                                   |
| 17  | **AI Advisory (Study Plans)**     | ✅ Complete | Claude-powered study plans, concept reinforcement, mini-projects, schedules    |
| 18  | **Feedback Tools**                | ✅ Complete | AI advisory plan generator with performance inputs                             |
| 19  | **Student Chatbot**               | ✅ Complete | Claude-powered, performance-aware, conversation history                        |
| 20  | **Student Management**            | ✅ Complete | List, search, delete students from Analytics                                   |
| 21  | **Responsive Layout**             | ✅ Complete | Fixed sidebar (desktop) + mobile hamburger menu                                |
| 22  | **Seed Data**                     | ✅ Complete | 1 teacher + 3 students + sample outcomes/assignments                           |

### What's Built (Summary)

- **120 backend API endpoints** across auth, CRUD, AI, ML, reports
- **16 frontend pages** with role-based views
- **14 database tables** with full relational integrity
- **50+ reusable UI components** (shadcn/ui)
- **3 AI features** (question generation, evaluation, chatbot)
- **1 ML pipeline** (risk prediction)
- **5 CSV export endpoints** for reporting

### Potential Future Enhancements

| Enhancement                      | Priority | Description                                                    |
| -------------------------------- | -------- | -------------------------------------------------------------- |
| Real-time Notifications          | Medium   | WebSocket-based alerts for new grades, submission deadlines    |
| Batch Grading                    | Medium   | Grade multiple students simultaneously                         |
| Rubric-Based Evaluation          | Medium   | Structured rubric scoring instead of single similarity score   |
| Student Groups / Sections        | Low      | Organize students into class sections                          |
| Assignment Deadlines Enforcement | Low      | Auto-lock submissions past due date                            |
| Dashboard Statistics             | Low      | Summary cards on landing (total assignments, avg scores, etc.) |
| Dark Mode                        | Low      | Theme toggle (infrastructure exists via `next-themes`)         |
| File Preview                     | Low      | In-browser PDF preview for uploaded submissions                |
| Audit Logging                    | Low      | Track who changed what and when                                |
| PostgreSQL Migration             | Low      | Move from SQLite to PostgreSQL for production scale            |

---

## Appendix A: Environment Variables

### Backend (`backend/.env`)

| Variable            | Required | Default                     | Description                                |
| ------------------- | -------- | --------------------------- | ------------------------------------------ |
| `DATABASE_URL`      | No       | `sqlite:///./core_quest.db` | Database connection string                 |
| `SECRET_KEY`        | Yes      | `your-secret-key-...`       | JWT signing key — **change in production** |
| `ANTHROPIC_API_KEY` | No       | —                           | Claude API key for AI features             |

### Frontend (`.env`)

| Variable       | Required                                     | Description          |
| -------------- | -------------------------------------------- | -------------------- |
| `VITE_API_URL` | No (defaults to `http://localhost:8002/api`) | Backend API base URL |

---

## Appendix B: Running Tests

```bash
# Frontend tests
npm test              # Run once
npm run test:watch    # Watch mode

# Backend tests
cd backend
python -m pytest test_api.py -v
python -m pytest test_auth_complete.py -v
python -m pytest test_outcome_parser.py -v
```

---

## Appendix C: Deployment Checklist

- [ ] Change `SECRET_KEY` to a secure random value
- [ ] Set `ANTHROPIC_API_KEY` for AI features
- [ ] Migrate from SQLite to PostgreSQL (`DATABASE_URL`)
- [ ] Set `VITE_API_URL` to production backend URL
- [ ] Run `npm run build` for production frontend
- [ ] Configure CORS origins in `main.py` (currently allows all)
- [ ] Set up HTTPS/TLS
- [ ] Configure file upload size limits
- [ ] Set up database backups
