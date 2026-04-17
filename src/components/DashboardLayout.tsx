import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap, LogOut, FileText, Target, BarChart3,
  FileBarChart, Activity, BookOpen, MessageSquare,
  Menu, Sparkles, ClipboardCheck, Bot, TrendingUp, Megaphone,
  Home, Calendar, Archive, Settings, ScrollText,
} from "lucide-react";
import { ReactNode, useState } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const teacherGroups = [
    {
      label: "Main",
      items: [
        { path: "/dashboard", label: "Assignments", icon: FileText },
        { path: "/scores", label: "Scores", icon: BarChart3 },
        { path: "/create-assignment", label: "Create Assignment", icon: Sparkles },
        { path: "/evaluation", label: "Evaluation", icon: ClipboardCheck },
      ],
    },
    {
      label: "Analytics & Mapping",
      items: [
        { path: "/outcomes", label: "Outcomes", icon: Target },
        { path: "/reports", label: "Reports", icon: FileBarChart },
        { path: "/analytics", label: "Analytics", icon: Activity },
        { path: "/les-analytics", label: "LES Analytics", icon: TrendingUp },
      ],
    },
    {
      label: "Tools",
      items: [
        { path: "/subjects", label: "Subjects", icon: BookOpen },
        { path: "/question-paper", label: "Question Paper", icon: ScrollText },
        { path: "/feedback", label: "Feedback", icon: MessageSquare },
        { path: "/announcements", label: "Announcements", icon: Megaphone },
      ],
    },
  ];

  const studentGroups = [
    {
      label: "Navigation",
      items: [
        { path: "/dashboard", label: "Home", icon: Home },
        { path: "/calendar", label: "Calendar", icon: Calendar },
        { path: "#enrolled", label: "Enrolled", icon: BookOpen },
        { path: "/archived", label: "Archived Classes", icon: Archive },
        { path: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  const groups = role === "teacher" ? teacherGroups : studentGroups;

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <GraduationCap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            AcademiQ
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {role} Portal
          </p>
        </div>
      </div>

      <Separator className="mx-4 w-auto" />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path);
                      setMobileOpen(false);
                    }}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold uppercase">
            {user?.email?.charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSignOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[250px] shrink-0 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 h-full w-[270px] bg-card shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar – mobile only */}
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>AcademiQ</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
