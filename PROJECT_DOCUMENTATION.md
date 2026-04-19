# AcademiQ - Intelligent Academic Automation System

A full-stack GenAI-powered learning management and academic tracking system. It integrates intelligent student performance tracking, AI-automated PDF grading, dynamic Course Outcome mapping (CO/PO), and a Google NotebookLM-style analytical chatbot for students.

## Architecture & Technology Stack

**Frontend Frameworks & Libraries**
- **React.js** (Vite build system)
- **TypeScript** (Strong typing and type safety)
- **Tailwind CSS** (Utility-first responsive styling)
- **Shadcn/ui & Radix UI** (Accessible layout components)
- **React Router** (Client-side routing)
- **React Query** (Asynchronous backend state management)
- **Lucide React** (Consistent icon sets)
- **Recharts** (Interactive data visualization for Analytics/Reports)

**Backend Frameworks & Libraries**
- **Python 3.10+** (Core language)
- **FastAPI** (High-performance API framework routing)
- **Uvicorn** (ASGI asynchronous web server)
- **SQLAlchemy** (Database Object Relational Mapper)
- **SQLite3** (Relational Database)
- **Anthropic Claude 3.5 Sonnet** (Primary GenAI Engine API)
- **PyMuPDF (`fitz`) & pdf2image** (PDF processing and OCR parsing)
- **Transformers / scikit-learn** (Sentence Transformers & ML NLP computations)
- **Pydantic** (Data validation & API schema defining)

---

## End-to-End Workflows & Features

### 1. Authentication & Role Handling
The application uses secure LocalStorage-backed authentication mapped to a SQLite User database. There are two distinct roles:
- **Teachers**: Can create classrooms, manage students, upload assignments, grade papers with AI, and manage Course Outcomes (COs).
- **Students**: Receive assignments, upload PDF submissions, read announcements, view analytics, and interact with the AI Chatbot.

### 2. Teacher Workflows

**Classroom & Assignment Generation:**
Teachers manage specific classes. Through the `AssignmentCreator.tsx`, a teacher can upload model solution PDFs. The backend utilizes **PyMuPDF** to scrape the text, map elements line by line to Course Outcomes, and formulate assignments. Assignments can be broadcasted globally or to isolated Classrooms.

**Automated Intelligent Evaluation (`EvaluationReview.tsx`):**
1. Students submit their answers as PDFs.
2. The Teacher triggers "AI Evaluation".
3. The system runs an automated Natural Language Processing comparison of the Student's PDF text against the Teacher's Model Solution.
4. It compares semantic similarity and outputs suggested scores, automated constructive feedback, and calculates a percentage.
5. Teachers can perform manual overrides and publish the grades directly to the Student Dashboard.

**Course Outcomes & Mapping (`OutcomesManager.tsx` & `COPOMapping.tsx`):**
Teachers map Program Outcomes (POs) down to Course Outcomes (COs) and Learning Outcomes (LOs). The system validates institutional alignment.

**Predictive Analytics & LES Score (`LESAnalyticsDashboard.tsx` & `Reports.tsx`):**
An advanced Machine Learning pipeline evaluates student risk based on historical parameters (Internal marks, Lab Performance, Study hours, Attendance). It computes an aggregate **LES (Learning Efficiency Score)** algorithm.
- Displays Data generated globally across radar, bar, and pie charts dynamically.

### 3. Student Workflows

**Student Google-Classroom Style Dashboard (`StudentDashboard.tsx`):**
A vertically scrolling feed that interleaves Assignments, Teacher Announcements, and System Activities chronologically. Students can natively upload their PDF responses which securely transmit to the FastAPI server and write to the DB.

**NotebookLM-Style Chatbot (`StudentChatbot.tsx`):**
- Actively integrates to imported syllabus documents.
- Features a multi-pane interface demonstrating "Loaded Sources" on the left and conversational query inputs on the right.
- Driven originally by **Anthropic Claude** (`ai_advisory.py`). Offers dynamic localized fallback mocking offline demonstrations if API keys are not supplied. 
- Capabilities include one-click actions: "Generate Study Guide", "Generate FAQ", "Generate Timeline", and an interactive "Deep Dive Audio Podcast Placeholder" visual layout.

### 4. Advanced AI API Advisory (`student_analytics.py`)
This microservice engine consumes current grading, attendance, and assignment metrics and intelligently outputs customized multi-tier 5-Day Study Plans and Pedagogical Milestones directly matching the teacher's original Course Outcomes.

---

## Directory Structure Overview

```text
/
├── .env                       # Environment configuration and API Keys
├── package.json               # Frontend dependencies and Vite scripts
├── PROJECT_DOCUMENTATION.md   # System Guide (This File)
├── src/                       # FRONTEND APPLICATION FOLDER
│   ├── components/            # Reusable UI Blocks (Navbar, Modals, Forms)
│   ├── integrations/api/      # Frontend Axious/Fetch client configurations  
│   ├── pages/                 # Full Page Component Views (Dashboard, Chatbot, etc)
│   └── styles/                # Global CSS configurations
└── backend/                   # PYTHON FASTAPI FOLDER
    ├── main.py                # Core FastApi Application Initialization & Routes
    ├── database.py            # SQLAlchemy Model Schema & Relational Links
    ├── schemas.py             # Pydantic Typing definitions for JSON I/O
    ├── ai_advisory.py         # Anthropic API connection orchestrator
    ├── student_analytics.py   # AI Academic Recommendation Engine
    └── uploads/               # Temporary runtime storage for PDFs & Data files
```

## Setup & Running Locally

1. **Start the Frontend:**
   ```bash
   npm install
   npm run dev
   ```
   *Runs by default on http://localhost:8080*

2. **Start the Backend:**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate      # Windows Environment
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
   *Runs by default on http://localhost:8000*

3. **Configure LLM Parameters (Optional):**
   Add your Anthropic Key inside `.env` to disable the Demonstration Mock engine and enable real-time generative capabilities.
   ```
   ANTHROPIC_API_KEY=sk-ant-api03...
   ```
