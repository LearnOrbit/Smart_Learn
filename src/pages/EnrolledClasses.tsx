import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatCardGrid } from "@/components/ui/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/ui/AnimatedPage";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BookOpen,
  Search,
  Plus,
  Users,
  GraduationCap,
  Hash,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  getClassrooms,
  getEnrollments,
  requestJoinClass,
  Classroom,
  refreshClassrooms,
  migrateLegacyClassroomsIfNeeded,
} from "@/utils/mockClassrooms";

export default function EnrolledClasses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [search, setSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => { void loadPageNamespace("enrolled"); }, []);

  const userName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Student";

  /* Sync classroom data */
  const sync = () => {
    const all = getClassrooms();
    const enrollments = getEnrollments();
    setClassrooms(
      all.filter((c) =>
        enrollments.some((e) => e.classroomId === c.id && e.studentName === userName)
      )
    );
  };

  useEffect(() => {
    sync();
    (async () => {
      try {
        await migrateLegacyClassroomsIfNeeded();
        await refreshClassrooms();
        sync();
      } catch (e) {
        console.warn("EnrolledClasses: sync/migration failed", e);
      }
    })();
    window.addEventListener("classroomSync", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("classroomSync", sync);
      window.removeEventListener("storage", sync);
    };
  }, [userName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.teacherName.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q)
    );
  }, [classrooms, search]);

  const stats = useMemo(
    () => ({
      enrolled: classrooms.length,
      subjects: new Set(classrooms.map((c) => c.subject)).size,
      teachers: new Set(classrooms.map((c) => c.teacherName)).size,
    }),
    [classrooms]
  );

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast({ title: t("enrolled:toasts.enterCode"), variant: "destructive" });
      return;
    }
    setRequesting(true);
    try {
      const res = await requestJoinClass(joinCode.trim(), userName);
      if (res.success) {
        toast({ title: t("enrolled:toasts.joined"), description: res.msg });
        setJoinCode("");
        // Refresh the cache so this new class appears in the list.
        await refreshClassrooms();
        sync();
      } else {
        toast({ title: t("enrolled:toasts.couldNotJoin"), description: res.msg, variant: "destructive" });
      }
    } catch (e) {
      toast({
        title: t("enrolled:toasts.couldNotJoin"),
        description: e instanceof Error ? e.message : t("enrolled:toasts.networkError"),
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("enrolled:header.title")}
          description={t("enrolled:header.description")}
        />

        <StatCardGrid columns={3}>
          <StatCard
            title={t("enrolled:stats.enrolledTitle")}
            value={stats.enrolled}
            description={t("enrolled:stats.enrolledDesc")}
            icon={<BookOpen className="h-5 w-5" />}
            iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          />
          <StatCard
            title={t("enrolled:stats.subjectsTitle")}
            value={stats.subjects}
            description={t("enrolled:stats.subjectsDesc")}
            icon={<GraduationCap className="h-5 w-5" />}
            iconBg="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
          />
          <StatCard
            title={t("enrolled:stats.teachersTitle")}
            value={stats.teachers}
            description={t("enrolled:stats.teachersDesc")}
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
          />
        </StatCardGrid>

        {/* Join a class */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{t("enrolled:joinCard.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("enrolled:joinCard.description")}
                </p>
              </div>
              <div className="flex gap-2 sm:w-auto w-full">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder={t("enrolled:joinCard.codePlaceholder")}
                  className="sm:w-44"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <Button onClick={handleJoin} disabled={requesting} className="gap-2 shrink-0">
                  {requesting ? <Clock className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t("enrolled:joinCard.join")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("enrolled:search.placeholder")}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("enrolled:search.countOf", { filtered: filtered.length, total: classrooms.length })}
          </p>
        </div>

        {/* Class grid */}
        {filtered.length === 0 ? (
          classrooms.length === 0 ? (
            <Card>
              <CardContent className="pt-2">
                <EmptyState
                  title={t("enrolled:empty.noClassesTitle")}
                  description={t("enrolled:empty.noClassesDesc")}
                  icon={<BookOpen className="h-8 w-8" />}
                  action={
                    <Button onClick={() => navigate("/dashboard")} className="gap-2">
                      <Sparkles className="h-4 w-4" /> {t("enrolled:empty.backToDashboard")}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-2">
                <EmptyState
                  title={t("enrolled:empty.noMatchesTitle")}
                  description={t("enrolled:empty.noMatchesDesc", { query: search })}
                  icon={<Search className="h-8 w-8" />}
                />
              </CardContent>
            </Card>
          )
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cls) => (
              <StaggerItem key={cls.id}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="cursor-pointer h-full"
                  onClick={() => navigate("/dashboard", { state: { openClass: cls.id } })}
                >
                  <Card
                    className="h-full overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-lg transition-all"
                    style={{ background: cls.cardColor || undefined }}
                  >
                    {/* Banner */}
                    <div
                      className="h-20 relative"
                      style={{
                        background: cls.bannerColor ||
                          "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="bg-white/90 text-foreground text-[10px] font-semibold">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                          {t("enrolled:card.enrolled")}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base truncate">{cls.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {cls.subject} · {t("enrolled:card.section", { section: cls.section })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          {cls.teacherName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-muted-foreground truncate">{cls.teacherName}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {cls.code}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          {t("enrolled:card.open")} <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </DashboardLayout>
  );
}
