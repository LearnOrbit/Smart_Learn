import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import { GraduationCap } from "lucide-react";

export default function Dashboard() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg animate-pulse-soft">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold font-heading text-foreground">Smart Learn</p>
            <p className="text-xs text-muted-foreground">Loading your dashboard...</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!role) return <Navigate to="/auth" replace />;

  return role === "teacher" ? <TeacherDashboard /> : <StudentDashboard />;
}
