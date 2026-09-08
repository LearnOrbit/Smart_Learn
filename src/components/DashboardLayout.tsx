import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, LogOut, FileText, Target, BarChart3,
  FileBarChart, Activity, BookOpen, MessageSquare,
  Menu, Sparkles, ClipboardCheck, Bot, TrendingUp, Megaphone,
  Home, Calendar, Archive, Settings, ScrollText, X, Bell, Search, Wrench,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for header effects
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      setScrolled(target.scrollTop > 10);
    };

    const main = document.querySelector('main');
    if (main) {
      main.addEventListener("scroll", handleScroll);
      return () => main.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const teacherGroups = [
    {
      label: t("nav.main"),
      items: [
        { path: "/dashboard", label: t("nav.assignments"), icon: FileText },
        { path: "/scores", label: t("nav.scores"), icon: BarChart3 },
        { path: "/create-assignment", label: t("nav.createAssignment"), icon: Sparkles },
        { path: "/evaluation", label: t("nav.evaluation"), icon: ClipboardCheck },
      ],
    },
    {
      label: t("nav.analytics"),
      items: [
        { path: "/outcomes", label: t("nav.outcomes"), icon: Target },
        { path: "/reports", label: t("nav.reports"), icon: FileBarChart },
        { path: "/analytics", label: t("nav.analytics"), icon: Activity },
        { path: "/les-analytics", label: t("nav.lesAnalytics"), icon: TrendingUp },
      ],
    },
    {
      label: t("nav.tools"),
      items: [
        { path: "/subjects", label: t("nav.subjects"), icon: BookOpen },
        { path: "/question-paper", label: t("nav.questionPaper"), icon: ScrollText },
        { path: "/ai-quiz", label: t("nav.quickAiQuiz"), icon: Bot },
        { path: "/ai-generator", label: t("nav.aiGenerator"), icon: Bot },
        { path: "/feedback", label: t("nav.feedback"), icon: MessageSquare },
        { path: "/announcements", label: t("nav.announcements"), icon: Megaphone },
        { path: "/research-trends", label: t("nav.researchTrends"), icon: TrendingUp },
        { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
        { path: "/academic-tools", label: "Academic tools", icon: Wrench },
      ],
    },
  ];

  const studentGroups = [
    {
      label: t("nav.navigation"),
      items: [
        { path: "/dashboard", label: t("nav.home"), icon: Home },
        { path: "/scores", label: t("nav.scores"), icon: BarChart3 },
        { path: "/calendar", label: t("nav.calendar"), icon: Calendar },
        { path: "/enrolled", label: t("nav.enrolled"), icon: BookOpen },
        { path: "/archived", label: t("nav.archived"), icon: Archive },
        { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
        { path: "/announcements", label: t("nav.announcements"), icon: Megaphone },
        { path: "/settings", label: t("nav.settings"), icon: Settings },
      ],
    },
    {
      label: t("nav.aiTools"),
      items: [
        { path: "/ai-quiz", label: t("nav.aiQuiz"), icon: Bot },
        { path: "/chatbot", label: "AI tutor", icon: MessageSquare },
        { path: "/academic-tools", label: "Student support tools", icon: Wrench },
      ],
    },
  ];

  const groups = role === "teacher" ? teacherGroups : studentGroups;

  const NavItem = ({ path, label, icon: Icon }: { path: string; label: string; icon: any }) => {
    const active = location.pathname === path;
    return (
      <motion.button
        onClick={() => {
          navigate(path);
          setMobileOpen(false);
        }}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {/* Active indicator bar */}
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-primary rounded-r-full"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}

        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            active
              ? "text-primary"
              : "text-muted-foreground group-hover:text-foreground"
          }`}
        />
        <span className="truncate">{label}</span>

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-lg bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
      </motion.button>
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar-background">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <motion.div
          whileHover={{ rotate: 12, scale: 1.1 }}
          transition={{ duration: 0.2 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/20"
        >
          <GraduationCap className="h-5 w-5 text-primary-foreground" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-lg font-bold leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("app.name")}
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {role === "teacher" ? t("app.teacherPortal") : t("app.studentPortal")}
          </p>
        </div>

        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={t("topbar.closeMenu")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="mx-4 w-auto bg-border/50" />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group, groupIndex) => (
          <motion.div
            key={group.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: groupIndex * 0.05 }}
          >
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item, i) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: groupIndex * 0.05 + i * 0.02 }}
                >
                  <NavItem {...item} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 px-3 py-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-primary-foreground text-sm font-bold uppercase shadow-sm">
            {user?.email?.charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
            <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {role}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
            title={t("topbar.signOut")}
            aria-label={t("topbar.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border/50 bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-card shadow-2xl lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`flex h-14 sm:h-16 items-center gap-2 sm:gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 transition-shadow ${
            scrolled ? "shadow-sm" : ""
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("topbar.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <motion.div
              whileHover={{ rotate: 12 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light"
            >
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </motion.div>
            <span className="font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>
              {t("app.name")}
            </span>
          </div>

          <div className="flex-1" />

          <LanguageSwitcher />
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t("topbar.notifications")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive">
              <span className="absolute inset-0 rounded-full bg-destructive animate-ping" />
            </span>
          </Button>
        </motion.header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}