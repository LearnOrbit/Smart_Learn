import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";

export default function Dashboard() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!role) return <Navigate to="/auth" replace />;

  return role === "teacher" ? <TeacherDashboard /> : <StudentDashboard />;
}
