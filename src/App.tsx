import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import OutcomesManager from "./pages/OutcomesManager";
import ScoresDashboard from "./pages/ScoresDashboard";
import COPOMapping from "./pages/COPOMapping";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import SubjectsManager from "./pages/SubjectsManager";
import FeedbackTools from "./pages/FeedbackTools";
import AssignmentCreator from "./pages/AssignmentCreator";
import EvaluationReview from "./pages/EvaluationReview";
import StudentChatbot from "./pages/StudentChatbot";
import LESAnalyticsDashboard from "./pages/LESAnalyticsDashboard";
import LESDebug from "./pages/LESDebug";
import Announcements from "./pages/Announcements";
import QuestionPaperGenerator from "./pages/QuestionPaperGenerator";
import AIAssessmentGenerator from "./pages/AIAssessmentGenerator";
import AIQuizPage from "./pages/AIQuizPage";
import CalendarPage from "./pages/CalendarPage";
import EnrolledClasses from "./pages/EnrolledClasses";
import ArchivedClasses from "./pages/ArchivedClasses";
import SettingsPage from "./pages/SettingsPage";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/outcomes" element={<ProtectedRoute><OutcomesManager /></ProtectedRoute>} />
            <Route path="/scores" element={<ProtectedRoute><ScoresDashboard /></ProtectedRoute>} />
            <Route path="/co-po-mapping" element={<ProtectedRoute><COPOMapping /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/les-analytics" element={<ProtectedRoute><LESAnalyticsDashboard /></ProtectedRoute>} />
            <Route path="/les-debug" element={<ProtectedRoute><LESDebug /></ProtectedRoute>} />
            <Route path="/subjects" element={<ProtectedRoute><SubjectsManager /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><FeedbackTools /></ProtectedRoute>} />
            <Route path="/create-assignment" element={<ProtectedRoute><AssignmentCreator /></ProtectedRoute>} />
            <Route path="/evaluation" element={<ProtectedRoute><EvaluationReview /></ProtectedRoute>} />
            <Route path="/chatbot" element={<ProtectedRoute><StudentChatbot /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
            <Route path="/question-paper" element={<ProtectedRoute><QuestionPaperGenerator /></ProtectedRoute>} />
            <Route path="/ai-generator" element={<ProtectedRoute><AIAssessmentGenerator /></ProtectedRoute>} />
            <Route path="/ai-quiz" element={<ProtectedRoute><AIQuizPage /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/enrolled" element={<ProtectedRoute><EnrolledClasses /></ProtectedRoute>} />
            <Route path="/archived" element={<ProtectedRoute><ArchivedClasses /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
