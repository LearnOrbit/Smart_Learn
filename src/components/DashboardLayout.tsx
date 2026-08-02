import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap, LogOut, FileText, Target, BarChart3,
  FileBarChart, Activity, BookOpen, MessageSquare,
  Menu, Sparkles, ClipboardCheck, Bot, TrendingUp, Megaphone,
  Home, Calendar, Archive, Settings, ScrollText, Bell, Search, X,
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
  const userInitial = user?.email?.charAt(0)?.toUpperCase() || "?";
  const displayName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "User";

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold leading-tight tracking-tight font-heading">
            Smart Learn
          </h1>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {role} Portal
          </p>
        </div>
      </div>

      <div className="mx-4">
        <Separator className="opacity-50" />
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 hide-scrollbar">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
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
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                    )}
                    <Icon className={`h-[17px] w-[17px] shrink-0 transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold ring-2 ring-primary/20">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold capitalize">{displayName}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border/50 bg-card/80 backdrop-blur-xl lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 h-full w-[280px] bg-card shadow-elevated animate-scale-in origin-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border/50 bg-card/60 backdrop-blur-xl px-4 lg:px-6">
          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="lg:hidden rounded-lg" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-bold font-heading">Smart Learn</span>
          </div>

          {/* Desktop search bar */}
          <div className="hidden lg:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search assignments, classes..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-muted/40 border-0 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 lg:flex-none" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
            </Button>
            <div className="hidden lg:flex items-center gap-2.5 ml-2 pl-3 border-l border-border/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight capitalize truncate max-w-[120px]">{displayName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
