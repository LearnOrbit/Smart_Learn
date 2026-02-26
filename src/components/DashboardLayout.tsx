import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, FileText, Target } from "lucide-react";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const navItems = role === "teacher"
    ? [
        { path: "/dashboard", label: "Assignments", icon: FileText },
        { path: "/outcomes", label: "Outcomes", icon: Target },
      ]
    : [{ path: "/dashboard", label: "Assignments", icon: FileText }];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>AcademiQ</h1>
                <p className="text-xs text-muted-foreground capitalize">{role} Dashboard</p>
              </div>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    location.pathname === path
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
