# 🎨 Smart Learn — Implemented Frontend UI & Component Documentation

> **Project Version**: 1.0.0  
> **Tech Stack**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix UI), Recharts, TanStack Query, Lucide Icons, Tesseract.js  
> **Repository Location**: `/Users/apple/Desktop/miniproject/Smart_Learn`

---

## 📌 Executive Summary

The **Smart Learn** frontend is a modern, responsive, data-driven web application tailored for educational institutions. It provides separate role-based interfaces (Teacher / Student / Admin) for outcome-based education (OBE), automated question paper generation with OCR capabilities, Course Outcome & Program Outcome (CO-PO) matrix mapping, real-time score analytics, and student interaction tools.

---

## 🗺️ Complete Implemented UI Pages & Route Map

The frontend routing is configured using `react-router-dom` in [`App.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/App.tsx).

| Route | Page File | Core UI Features & Description |
| :--- | :--- | :--- |
| `/` | [`Index.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/Index.tsx) | **Landing Page**: Modern hero section, key features grid, role quick-access cards (Teacher vs Student entry), call-to-action buttons. |
| `/auth` | [`Auth.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/Auth.tsx) | **Authentication**: Tabbed Sign In / Sign Up card with role selection dropdown (Student / Teacher), email & password fields, form validation, and toast notifications. |
| `/dashboard` | [`Dashboard.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/Dashboard.tsx) | **Role-Based Router View**: Automatically resolves to `TeacherDashboard.tsx` or `StudentDashboard.tsx` based on user auth role state. |
| `/dashboard` *(Student)* | [`StudentDashboard.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/StudentDashboard.tsx) | **Student Portal**: Stats counters (Enrolled Courses, Target Attainment, Pending Assignments), score overview charts, upcoming tasks, announcement feed, and subject breakdown. |
| `/dashboard` *(Teacher)* | [`TeacherDashboard.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/TeacherDashboard.tsx) | **Teacher Portal**: Class performance summary, pending evaluations counter, recent submissions table, quick assignment generator triggers, and student analytics modals. |
| `/outcomes` | [`OutcomesManager.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/OutcomesManager.tsx) | **CO/PO Outcomes Management**: Configurator for Course Outcomes (COs) and Program Outcomes (POs), threshold targets, bloom taxonomy levels, and attainment levels. |
| `/co-po-mapping` | [`COPOMapping.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/COPOMapping.tsx) | **CO-PO Matrix Mapping**: Interactive matrix grid for mapping COs (1-5) to POs (1-12) with correlation strength selection (Low: 1, Medium: 2, High: 3), automated average calculations, and heatmaps. |
| `/scores` | [`ScoresDashboard.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/ScoresDashboard.tsx) | **Scores & Marks Tracker**: Student marks table, grade distribution charts, filterable subject dropdowns, and individual performance meters. |
| `/analytics` | [`Analytics.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/Analytics.tsx) | **General Analytics**: Recharts-based bar & line charts for overall class progress, outcome achievement trends, and comparative metrics. |
| `/les-analytics` | [`LESAnalyticsDashboard.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/LESAnalyticsDashboard.tsx) | **Learning Evaluation System (LES) Analytics**: Advanced attainment analytics dashboard, direct vs indirect assessment tracking, Bloom's level breakdown, and compliance reports. |
| `/les-debug` | [`LESDebug.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/LESDebug.tsx) | **LES System Diagnostic**: Internal debug console for testing API payloads, data validation, and calculation engine states. |
| `/subjects` | [`SubjectsManager.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/SubjectsManager.tsx) | **Subject Management**: Grid of course subjects, credit details, instructor assignment cards, and subject creation dialogs. |
| `/feedback` | [`FeedbackTools.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/FeedbackTools.tsx) | **Student Feedback Hub**: Feedback creation form, rating stars, custom feedback prompts, sentiment summaries, and survey history. |
| `/create-assignment` | [`AssignmentCreator.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/AssignmentCreator.tsx) | **Assignment Builder**: Multi-step assignment editor, CO mapping tags, total marks assigner, deadline picker, and distribution options. |
| `/question-paper` | [`QuestionPaperGenerator.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/QuestionPaperGenerator.tsx) | **Smart Paper Generator**: Question pool filter, difficulty distribution, OCR image upload powered by `tesseract.js` for auto-extracting typed/handwritten questions, and paper preview export. |
| `/evaluation` | [`EvaluationReview.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/EvaluationReview.tsx) | **Evaluation & Grading**: Submission viewer, inline grading input, feedback note attachers, and mark confirmation actions. |
| `/chatbot` | [`StudentChatbot.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/StudentChatbot.tsx) | **AI Learning Assistant**: Instant messaging UI layout, prompt suggestions, chat history bubbles, typing indicators, and subject-matter assistance. |
| `/announcements` | [`Announcements.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/Announcements.tsx) | **Notice Board**: Categorized announcement feed (Urgent, General, Exams), post creator for teachers, date badges, and search filter. |
| `*` | [`NotFound.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/pages/NotFound.tsx) | **404 Error Page**: Clean error card with "Return to Home/Dashboard" navigation. |

---

## 🎨 Layout & Architecture System

### 1. Global Shell Layout ([`DashboardLayout.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/components/DashboardLayout.tsx))
The core dashboard frame wraps protected pages and includes:
- **Responsive Collapsible Sidebar**: Navigation links with active route highlighting using [`NavLink.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/components/NavLink.tsx) and Lucide icons.
- **Top Header Navbar**: User avatar dropdown, role badge, quick notifications trigger, and theme toggle.
- **Content View Area**: Main viewport container with dynamic scroll management and toast providers ([`sonner`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/components/ui/sonner.tsx) & [`toaster`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/components/ui/toaster.tsx)).

### 2. UI Primitives & Design Tokens (`src/components/ui/`)
Built with **shadcn/ui** and **Radix UI** primitives styled via Tailwind CSS:

```
src/components/ui/
├── card.tsx          # Card container, Header, Title, Description, Content, Footer
├── button.tsx        # Variants: default, destructive, outline, secondary, ghost, link
├── dialog.tsx        # Accessible Modal popups & overlay backdrops
├── table.tsx         # Data tables with sticky headers & responsive horizontal scroll
├── tabs.tsx          # Tabbed navigation containers
├── badge.tsx         # Color-coded indicator tags (Primary, Secondary, Destructive, Outline)
├── select.tsx        # Custom accessible select dropdowns
├── input.tsx         # Form text input controls
├── chart.tsx         # Recharts integration wrapper & custom tooltips
├── sidebar.tsx       # Collapsible navigation drawer primitives
└── toast.tsx/sonner  # Notification popovers & alert banners
```

---

## 🔍 Detailed Feature Showcase & UI Components

### 📄 1. Question Paper Generator (`/question-paper`)
- **Interactive Form Inputs**: Subject selection, Total Marks, Bloom's Taxonomy breakdown (Remember, Understand, Apply, Analyze).
- **OCR Image Recognition**: Built-in `tesseract.js` image dropzone. Allows teachers to upload scans/photos of previous question papers or notes to automatically extract question text.
- **Live Preview & Export**: Formatted question paper view ready for printing/exporting.

### 📊 2. CO-PO Matrix Mapping (`/co-po-mapping`)
- **Matrix Grid Input**: Interactive table allowing teachers to set correlation values (0, 1, 2, 3) between Course Outcomes (CO1-CO5) and Program Outcomes (PO1-PO12).
- **Visual Attainment Calculation**: Real-time average correlation score per PO column.
- **Export Capabilities**: CSV/PDF export options for accreditation (NBA/NAAC) documentation.

### 📈 3. LES & Performance Analytics (`/les-analytics` & `/analytics`)
- **Recharts Data Visualization**:
  - Bar Charts: CO Attainment percentages against target benchmarks.
  - Pie/Donut Charts: Student grade distributions across courses.
  - Radar Charts: Skill set & PO fulfillment profiles.
- **Interactive Student Analytics Modal** ([`StudentAnalyticsModal.tsx`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/components/StudentAnalyticsModal.tsx)): Detailed pop-up view for deep-diving into individual student outcome progress.

### 🤖 4. AI Student Chatbot (`/chatbot`)
- **Chat Interface**: Clean message stream layout distinguishing student prompts and AI responses.
- **Suggested Prompts**: Quick pill buttons ("Explain CO2 concept", "How is PO attainment calculated?", "Show upcoming deadlines").
- **Auto-scroll & Typing State**: Smooth auto-scrolling to latest response with animated pulse indicators.

---

## 🎨 Theme & Color Palette Specification

Defined in [`index.css`](file:///Users/apple/Desktop/miniproject/Smart_Learn/src/index.css) and [`tailwind.config.ts`](file:///Users/apple/Desktop/miniproject/Smart_Learn/tailwind.config.ts):

- **Background**: Light Mode (`#FFFFFF` / `hsl(0 0% 100%)`), Dark Mode (`hsl(224 71% 4%)`)
- **Primary Accent**: Electric Blue / Slate `hsl(221.2 83.2% 53.3%)`
- **Secondary**: Soft Slate / Muted Neutral `hsl(210 40% 96.1%)`
- **Card Containers**: Glassmorphism border styles with `bg-card` and subtle `border-border/50`
- **Typography**: Inter / Sans-serif variable font stack

---

## 🛠️ How to Add New UI Components or Pages

1. **Create the Page Component**:
   Add a new file in `src/pages/NewPage.tsx` wrapped in `<DashboardLayout>`:
   ```tsx
   import DashboardLayout from "@/components/DashboardLayout";
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

   export default function NewPage() {
     return (
       <DashboardLayout>
         <div className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle>New Implemented UI Feature</CardTitle>
             </CardHeader>
             <CardContent>
               <p>Content goes here...</p>
             </CardContent>
           </Card>
         </div>
       </DashboardLayout>
     );
   }
   ```

2. **Register Route in `App.tsx`**:
   ```tsx
   <Route path="/new-page" element={<ProtectedRoute><NewPage /></ProtectedRoute>} />
   ```

3. **Add Navigation Link**:
   Update `src/components/DashboardLayout.tsx` to include the route in the sidebar menu.

---

## 👨‍💻 Developer Summary
The Smart Learn UI is fully modularized, responsive across mobile, tablet, and desktop devices, type-safe with TypeScript, and styled with accessible UI standards.
