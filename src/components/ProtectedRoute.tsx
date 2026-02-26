import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
