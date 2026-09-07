# 🎓 Smart Learn — Frontend Architecture & Developer Guide

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Radix_Primitives-000000?style=for-the-badge)

Welcome to the frontend repository for **Smart Learn** (Smart Feedback & Learning Outcome Analytics System). Smart Learn is an AI-enhanced educational platform for managing course outcomes (CO-PO mapping), student evaluations, automated question paper generation, real-time analytics, and interactive student support.

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🛠 Tech Stack & Dependencies](#-tech-stack--dependencies)
- [📁 Directory Structure](#-directory-structure)
- [🚀 Quick Start & Installation](#-quick-start--installation)
- [📜 Scripts & Commands](#-scripts--commands)
- [🎨 Design System & UI Architecture](#-design-system--ui-architecture)
- [💡 Best Practices & Frontend Improvements](#-best-practices--frontend-improvements)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [🌐 Deployment Guide](#-deployment-guide)

---

## ✨ Key Features

* 📊 **Role-Based Dashboards**: Tailored views for Teachers and Students with real-time score tracking and assignment overviews.
* 🎯 **CO-PO Mapping & Outcomes Manager**: Complex matrix mapping between Course Outcomes (COs) and Program Outcomes (POs) with target calculations.
* 📝 **Question Paper & Assignment Creator**: Smart paper generator powered by OCR (`tesseract.js`) for image-to-text extraction.
* 📈 **LES Analytics & Visual Reports**: Deep performance charts rendered using `Recharts` for outcome attainment and trend analysis.
* 💬 **AI Student Chatbot**: Interactive query resolution assistant for students.
* 📢 **Announcements & Evaluation Review**: Centralized updates feed and grading review tools.

---

## 🛠 Tech Stack & Dependencies

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Core Framework** | React 18 + Vite | Fast HMR build setup using SWC / Vite |
| **Language** | TypeScript 5.8 | Type safety across components and hooks |
| **Styling** | Tailwind CSS + `clsx` + `tailwind-merge` | Utility-first styling with merge utilities |
| **UI Components** | Radix UI primitives + shadcn/ui | Accessible, headless UI component primitives |
| **State & Data Fetching**| TanStack Query (React Query) | Cache management and server state sync |
| **Forms & Validation** | React Hook Form + Zod | Schema validation and optimized form handling |
| **Charts & Visuals** | Recharts | Responsive SVG charts and progress meters |
| **OCR Utility** | Tesseract.js | Client-side optical character recognition |
| **Icons & Notifications**| Lucide React + Sonner | Modern icons and toast notifications |
| **Testing** | Vitest + React Testing Library | Fast unit and component testing |

---

## 📁 Directory Structure

```text
src/
├── components/          # Reusable UI components
│   ├── ui/              # Primitive UI components (shadcn/ui buttons, dialogs, cards)
│   ├── analytics/       # Chart widgets & data visualization cards
│   ├── dashboard/       # Role-specific dashboard widgets
│   └── shared/          # Navigation, Header, Sidebar, Footer
├── hooks/               # Custom React hooks (auth, data-fetching, dark mode)
├── integrations/        # External services & API clients (Supabase/REST backend)
├── lib/                 # Utility functions, formatters, and shadcn helper (`utils.ts`)
├── pages/               # Application routes / views
│   ├── TeacherDashboard.tsx
│   ├── StudentDashboard.tsx
│   ├── COPOMapping.tsx
│   ├── LESAnalyticsDashboard.tsx
│   ├── QuestionPaperGenerator.tsx
│   ├── AssignmentCreator.tsx
│   ├── StudentChatbot.tsx
│   └── ...
├── test/                # Test utilities & mock data
├── utils/               # Helper algorithms (CO-PO math, grade calculators)
├── App.tsx              # Main routing configuration
├── index.css            # Global CSS, Tailwind directives & CSS variables
└── main.tsx             # Application entry point
```

---

## 🚀 Quick Start & Installation

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or `pnpm` / `yarn`)

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RIT2006ESH/Smart_Learn.git
   cd Smart_Learn
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## 📜 Scripts & Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Launches Vite local development server with HMR |
| `npm run build` | Compiles TypeScript and creates optimized production build in `dist/` |
| `npm run build:dev` | Compiles production build in development mode |
| `npm run preview` | Previews production build locally |
| `npm run lint` | Runs ESLint to check for code style issues |
| `npm run test` | Runs unit tests using Vitest |
| `npm run test:watch` | Runs Vitest in interactive watch mode |

---

## 🎨 Design System & UI Architecture

### Color System & Theming
Smart Learn leverages CSS variables mapped inside `index.css` and `tailwind.config.ts`. It provides seamless light/dark mode support.

- Primary Brand: HSL tailored vibrant primary hues.
- Surface Cards: Subtle border accents and glassmorphism styling (`backdrop-blur`).
- Feedback States: Success, Warning, Destructive, and Info tokens.

### Component Design Principles
1. **Single Responsibility**: Atomic components inside `components/ui/`.
2. **Type Safety**: Strictly typed props using TypeScript interfaces.
3. **Accessibility (a11y)**: Built on top of Radix UI primitives to ensure screen reader support, keyboard focus management, and ARIA roles.

---

## 💡 Recommended Frontend Improvement Roadmap

To take this application to production grade, consider the following technical improvements:

### 1. ⚡ Code Splitting & Dynamic Imports
Large pages like `StudentDashboard.tsx` and `OutcomesManager.tsx` should be lazy-loaded using React `React.lazy()` and `Suspense` to reduce initial bundle loading time.

```tsx
// Example in App.tsx
import { lazy, Suspense } from 'react';
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
```

### 2. 🧱 Component Decomposition (Refactoring Large Files)
Some page files (e.g., `StudentDashboard.tsx` ~90KB) can be split into smaller, dedicated sub-components under `src/components/dashboard/student/` for better maintainability and code readability.

### 3. 🛡️ Global Error Boundaries
Wrap critical feature routes with React Error Boundaries to prevent whole-page white screens in case of unexpected runtime rendering errors.

### 4. 🚀 PWA / Offline Caching
Implement service workers or `@vite-pwa/plugin` so students can view cached scores and announcements even with unstable network connectivity.

---

## 🧪 Testing & Quality Assurance

Unit and integration tests are configured using **Vitest** and **React Testing Library**.

```bash
# Execute test suite
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 🌐 Deployment Guide

### Deploying to Vercel

1. Push your latest code to GitHub.
2. Connect your repository to [Vercel](https://vercel.com).
3. Set Framework Preset to **Vite**.
4. Configure Build Command: `npm run build` and Output Directory: `dist`.
5. Add any required Environment Variables in Vercel settings.

---

## 👨‍💻 Contributing & Maintainers

Maintained by **Ritesh & Team**. Contributions, issues, and feature requests are welcome!
