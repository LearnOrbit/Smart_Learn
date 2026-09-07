import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Archive,
  Search,
  ArchiveRestore,
  Trash2,
  RotateCcw,
  BookOpen,
  Users,
  CalendarClock,
  Sparkles,
  Hash,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getArchivedClassrooms,
  unarchiveClassroom,
  deleteClassroom,
  Classroom,
} from "@/utils/mockClassrooms";

export default function ArchivedClasses() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("pages");
  const [archived, setArchived] = useState<Classroom[]>([]);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { void loadPageNamespace("archived"); }, []);

  const userName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Student";
  const isTeacher = role === "teacher";

  const loadArchived = () => {
    setArchived(getArchivedClassrooms());
  };

  useEffect(() => {
    loadArchived();
    window.addEventListener("classroomSync", loadArchived);
    window.addEventListener("storage", loadArchived);
    return () => {
      window.removeEventListener("classroomSync", loadArchived);
      window.removeEventListener("storage", loadArchived);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archived;
    return archived.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.teacherName.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q)
    );
  }, [archived, search]);

  const stats = useMemo(
    () => ({
      total: archived.length,
      subjects: new Set(archived.map((c) => c.subject)).size,
      teachers: new Set(archived.map((c) => c.teacherName)).size,
    }),
    [archived]
  );

  const handleRestore = async (id: string, name: string) => {
    await unarchiveClassroom(id);
    loadArchived();
    toast({
      title: t("archived:toasts.classRestored"),
      description: t("archived:toasts.classRestoredDesc", { name }),
    });
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteClassroom(id);
    setConfirmDelete(null);
    loadArchived();
    toast({
      title: t("archived:toasts.classDeleted"),
      description: t("archived:toasts.classDeletedDesc", { name }),
    });
  };

  const formatArchivedAgo = (ts?: number) => {
    if (!ts) return t("archived:card.format.archived");
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return t("archived:card.format.archivedToday");
    if (days === 1) return t("archived:card.format.archivedYesterday");
    if (days < 30) return t("archived:card.format.archivedDaysAgo", { count: days });
    const locale = i18n.language === "hi" ? "hi-IN" : i18n.language === "mr" ? "mr-IN" : "en-IN";
    return t("archived:card.format.archivedOn", { date: new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("archived:header.title")}
          description={t("archived:header.description")}
        />

        <StatCardGrid columns={3}>
          <StatCard
            title={t("archived:stats.archivedTitle")}
            value={stats.total}
            description={t("archived:stats.archivedDesc")}
            icon={<Archive className="h-5 w-5" />}
            iconBg="bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300"
          />
          <StatCard
            title={t("archived:stats.subjectsTitle")}
            value={stats.subjects}
            description={t("archived:stats.subjectsDesc")}
            icon={<BookOpen className="h-5 w-5" />}
            iconBg="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
          />
          <StatCard
            title={t("archived:stats.teachersTitle")}
            value={stats.teachers}
            description={t("archived:stats.teachersDesc")}
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
          />
        </StatCardGrid>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("archived:search.placeholder")}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("archived:search.countOf", { filtered: filtered.length, total: archived.length })}
          </p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="pt-2">
              {archived.length === 0 ? (
                <EmptyState
                  title={t("archived:empty.noClassesTitle")}
                  description={t("archived:empty.noClassesDesc")}
                  icon={<Archive className="h-8 w-8" />}
                />
              ) : (
                <EmptyState
                  title={t("archived:empty.noMatchesTitle")}
                  description={t("archived:empty.noMatchesDesc", { query: search })}
                  icon={<Search className="h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cls) => (
              <StaggerItem key={cls.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Card className="h-full overflow-hidden border-border/60 opacity-90 hover:opacity-100 transition-opacity">
                    <div
                      className="h-16 relative grayscale"
                      style={{
                        background: cls.bannerColor ||
                          "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-slate-900/80 text-white border-0 text-[10px]">
                          <Archive className="h-3 w-3 mr-1" />
                          {t("archived:card.archived")}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base truncate">{cls.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {cls.subject} · {t("archived:card.section", { section: cls.section })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                          {cls.teacherName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-muted-foreground truncate">{cls.teacherName}</span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {formatArchivedAgo(cls.archivedAt)}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-2">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {cls.code}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(cls.id, cls.name)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {t("archived:card.restore")}
                          </Button>
                          {isTeacher && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDelete(cls.id)}
                              className="h-7 px-2 text-xs gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Delete confirmation dialog */}
                <AnimatePresence>
                  {confirmDelete === cls.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setConfirmDelete(null)}
                      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{t("archived:delete.confirmTitle")}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("archived:delete.confirmDesc", { name: cls.name })}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                            {t("archived:delete.cancel")}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(cls.id, cls.name)}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" /> {t("archived:delete.delete")}
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Info footer */}
        {archived.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>
                <strong className="text-foreground">{t("archived:tip.label")}</strong> {t("archived:tip.text")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
