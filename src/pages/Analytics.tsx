import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import StudentAnalyticsModal from "@/components/StudentAnalyticsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { StatCard, StatCardGrid, MiniStat } from "@/components/ui/StatCard";
import { EmptyState, NoDataEmptyState, NoResultsEmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable, SkeletonCard } from "@/components/ui/LoadingSkeleton";
import { StaggerContainer, StaggerItem, AnimatedPageSection } from "@/components/ui/AnimatedPage";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Users,
  Edit,
  Save,
  Search,
  UserCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  BarChart3,
  UserPlus,
  ShieldAlert,
  Activity,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface PerformanceData {
  id: string;
  student_id: string;
  subject_id: string | null;
  student_marks: number;
  attendance: number;
  internal_assessments: number;
  lab_performance: number;
  assignment_scores: number;
  study_hours: number;
  concept_mastery: number;
  teacher_remarks: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StudentItem {
  id: string;
  email: string;
  name: string;
  role: string;
  performance: PerformanceData | null;
}

interface MetricsForm {
  student_marks: number;
  attendance: number;
  internal_assessments: number;
  lab_performance: number;
  assignment_scores: number;
  study_hours: number;
  concept_mastery: number;
  teacher_remarks: string;
}

const DEFAULT_METRICS: MetricsForm = {
  student_marks: 0,
  attendance: 0,
  internal_assessments: 0,
  lab_performance: 0,
  assignment_scores: 0,
  study_hours: 0,
  concept_mastery: 0,
  teacher_remarks: "",
};

// ── Helper ───────────────────────────────────────────────────────────

function averageScore(p: PerformanceData): number {
  // Use weighted academic components (Matching LES Engine weights)
  const w = { marks: 0.25, attendance: 0.15, ia: 0.20, lab: 0.15, assign: 0.10, study: 0.05, mastery: 0.10 };

  return Math.round(
    (p.student_marks * w.marks) +
    (p.attendance * w.attendance) +
    ((p.internal_assessments / 20) * 100 * w.ia) +
    ((p.lab_performance / 25) * 100 * w.lab) +
    ((p.assignment_scores / 10) * 100 * w.assign) +
    (Math.min((p.study_hours / 168) * 100, 100) * w.study) +
    (p.concept_mastery * w.mastery)
  );
}

function riskBadge(avg: number, t: (key: string) => string, prefix: "analytics:teacher.risk" | "analytics:student.risk") {
  if (avg >= 70) return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 font-semibold">{t(`${prefix}.low`)}</Badge>;
  if (avg >= 50) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 font-semibold">{t(`${prefix}.moderate`)}</Badge>;
  return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-0 font-semibold">{t(`${prefix}.high`)}</Badge>;
}

// ── Component ────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const queryClient = useQueryClient();

  useEffect(() => { void loadPageNamespace("analytics"); }, []);

  const [search, setSearch] = useState("");
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [analyticsStudent, setAnalyticsStudent] = useState<{id: string; name: string} | null>(null);
  const [form, setForm] = useState<MetricsForm>(DEFAULT_METRICS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch students (teacher) ───────────────────────────────────────
  const {
    data: students = [],
    isLoading,
  } = useQuery<StudentItem[]>({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/students-list");
      if (error) throw error;
      return data || [];
    },
    enabled: user?.role === "teacher",
  });

  // ── Fetch own performance (student) ────────────────────────────────
  const { data: myPerformance } = useQuery<PerformanceData | null>({
    queryKey: ["my-performance"],
    queryFn: async () => {
      const { data, error } = await apiClient.get(
        `/student-performance/${user?.id}`
      );
      if (error) return null;
      return data;
    },
    enabled: user?.role === "student",
  });

  // ── Save performance mutation ──────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      student_id: string;
      metrics: MetricsForm;
    }) => {
      const { data, error } = await apiClient.post("/student-performance", {
        student_id: payload.student_id,
        ...payload.metrics,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      setEditingStudent(null);
      toast({ title: t("analytics:teacher.toasts.saved"), description: t("analytics:teacher.toasts.savedDesc") });
    },
    onError: (e: Error) => {
      toast({
        title: t("analytics:teacher.toasts.error"),
        description: e.message || t("analytics:teacher.toasts.saveFailed"),
        variant: "destructive",
      });
    },
  });

  // ── Delete student mutation ────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await apiClient.delete(`/students/${studentId}`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: t("analytics:teacher.toasts.deleted") });
    },
    onError: (e: Error) => {
      toast({
        title: t("analytics:teacher.toasts.error"),
        description: e.message || t("analytics:teacher.toasts.deleteFailed"),
        variant: "destructive",
      });
    },
  });

  // ── Open edit dialog ───────────────────────────────────────────────
  const openEdit = (student: StudentItem) => {
    const p = student.performance;
    setForm(
      p
        ? {
            student_marks: p.student_marks,
            attendance: p.attendance,
            internal_assessments: p.internal_assessments,
            lab_performance: p.lab_performance,
            assignment_scores: p.assignment_scores,
            study_hours: p.study_hours,
            concept_mastery: p.concept_mastery,
            teacher_remarks: p.teacher_remarks || "",
          }
        : { ...DEFAULT_METRICS }
    );
    setEditingStudent(student);
  };

  // ── Filter students ────────────────────────────────────────────────
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Computed stats ─────────────────────────────────────────────────
  const atRiskCount = students.filter(
    (s) => s.performance && averageScore(s.performance) < 50
  ).length;
  const marksEnteredCount = students.filter((s) => s.performance).length;
  const avgOverall = students
    .filter((s) => s.performance)
    .reduce((sum, s) => sum + averageScore(s.performance!), 0) /
    (marksEnteredCount || 1);

  // ── TEACHER VIEW ───────────────────────────────────────────────────
  if (user?.role === "teacher") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <PageHeader
            title={t("analytics:teacher.title")}
            description={t("analytics:teacher.description")}
          />

          {/* Stats cards */}
          <StatCardGrid columns={4}>
            <StatCard
              title={t("analytics:teacher.stats.totalStudents")}
              value={students.length}
              icon={<Users className="h-5 w-5" />}
              iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
            />
            <StatCard
              title={t("analytics:teacher.stats.marksEntered")}
              value={marksEnteredCount}
              icon={<Activity className="h-5 w-5" />}
              iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
            />
            <StatCard
              title={t("analytics:teacher.stats.atRisk")}
              value={atRiskCount}
              icon={<ShieldAlert className="h-5 w-5" />}
              iconBg="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
            />
            <StatCard
              title={t("analytics:teacher.stats.classAverage")}
              value={`${Math.round(avgOverall)}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconBg="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
            />
          </StatCardGrid>

          {/* Search */}
          <Card>
            <CardContent className="pt-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("analytics:teacher.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Student list */}
          {isLoading ? (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <SkeletonTable rows={5} columns={4} />
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            students.length === 0 ? (
              <NoDataEmptyState
                title={t("analytics:teacher.empty.noStudents")}
                description={t("analytics:teacher.empty.noStudentsDesc")}
                icon={UserPlus}
              />
            ) : (
              <NoResultsEmptyState
                title={t("analytics:teacher.empty.noMatching")}
                description={t("analytics:teacher.empty.noMatchingDesc")}
              />
            )
          ) : (
            <StaggerContainer className="space-y-3" staggerDelay={0.04}>
              {filtered.map((student) => {
                const perf = student.performance;
                const avg = perf ? averageScore(perf) : null;
                const isExpanded = expandedId === student.id;

                return (
                  <StaggerItem key={student.id}>
                    <motion.div
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Card className="overflow-hidden">
                        {/* Collapsed row */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors gap-3 flex-wrap"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : student.id)
                          }
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-semibold shrink-0">
                              {student.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {student.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {perf ? (
                              <>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">{t("analytics:teacher.row.average")}</p>
                                  <p className="text-sm font-bold leading-none">{avg}%</p>
                                </div>
                                {riskBadge(avg!, t, "analytics:teacher.risk")}
                              </>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">{t("analytics:teacher.row.noData")}</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(student);
                              }}
                              className="h-8"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              {perf ? t("analytics:teacher.row.edit") : t("analytics:teacher.row.enterMarks")}
                            </Button>
                            {perf && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log(`📊 Analytics clicked for:`, {
                                    studentName: student.name,
                                    studentId: student.id,
                                    hasPerformanceData: !!perf
                                  });
                                  setAnalyticsStudent({ id: student.id, name: student.name });
                                }}
                                className="h-8"
                              >
                                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                                {t("analytics:teacher.row.analytics")}
                              </Button>
                            )}
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t("analytics:teacher.row.deleteConfirm", { name: student.name }))) {
                                  deleteMutation.mutate(student.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="border-t pt-4 pb-4">
                                {perf ? (
                                  <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                      <MetricPill label={t("analytics:teacher.metrics.marks")} value={perf.student_marks} />
                                      <MetricPill label={t("analytics:teacher.metrics.attendance")} value={perf.attendance} />
                                      <MetricPill
                                        label={t("analytics:teacher.metrics.internals")}
                                        value={perf.internal_assessments}
                                        max={20}
                                      />
                                      <MetricPill
                                        label={t("analytics:teacher.metrics.lab")}
                                        value={perf.lab_performance}
                                        max={25}
                                      />
                                      <MetricPill
                                        label={t("analytics:teacher.metrics.assignments")}
                                        value={perf.assignment_scores}
                                        max={10}
                                      />
                                      <MetricPill
                                        label={t("analytics:teacher.metrics.studyHrs")}
                                        value={perf.study_hours}
                                        max={40}
                                      />
                                      <MetricPill
                                        label={t("analytics:teacher.metrics.mastery")}
                                        value={perf.concept_mastery}
                                      />
                                    </div>
                                    {perf.teacher_remarks && (
                                      <p className="mt-3 text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                                        {t("analytics:teacher.remarks")}: {perf.teacher_remarks}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {t("analytics:teacher.metrics.noDataHint")}
                                  </p>
                                )}
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}

          {/* ── Edit Dialog ───────────────────────────────────────── */}
          <Dialog
            open={!!editingStudent}
            onOpenChange={(open) => !open && setEditingStudent(null)}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent?.performance
                    ? t("analytics:teacher.dialog.editTitle", { name: editingStudent.name })
                    : t("analytics:teacher.dialog.enterTitle", { name: editingStudent.name })}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Field
                  label={t("analytics:teacher.dialog.fields.marks")}
                  value={form.student_marks}
                  onChange={(v) => setForm({ ...form, student_marks: v })}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.attendance")}
                  value={form.attendance}
                  onChange={(v) => setForm({ ...form, attendance: v })}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.internals")}
                  value={form.internal_assessments}
                  onChange={(v) =>
                    setForm({ ...form, internal_assessments: v })
                  }
                  max={20}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.lab")}
                  value={form.lab_performance}
                  onChange={(v) => setForm({ ...form, lab_performance: v })}
                  max={25}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.assignments")}
                  value={form.assignment_scores}
                  onChange={(v) => setForm({ ...form, assignment_scores: v })}
                  max={10}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.studyHours")}
                  value={form.study_hours}
                  onChange={(v) => setForm({ ...form, study_hours: v })}
                  max={168}
                />
                <Field
                  label={t("analytics:teacher.dialog.fields.mastery")}
                  value={form.concept_mastery}
                  onChange={(v) => setForm({ ...form, concept_mastery: v })}
                />
              </div>
              <div className="mt-2 space-y-1.5">
                <Label>{t("analytics:teacher.dialog.teacherRemarks")}</Label>
                <Textarea
                  value={form.teacher_remarks}
                  onChange={(e) =>
                    setForm({ ...form, teacher_remarks: e.target.value })
                  }
                  placeholder={t("analytics:teacher.dialog.remarksPlaceholder")}
                  rows={3}
                />
              </div>
              <Button
                className="w-full mt-4"
                disabled={saveMutation.isPending}
                onClick={() =>
                  editingStudent &&
                  saveMutation.mutate({
                    student_id: editingStudent.id,
                    metrics: form,
                  })
                }
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? t("analytics:teacher.dialog.saving") : t("analytics:teacher.dialog.save")}
              </Button>
            </DialogContent>
          </Dialog>

          {/* ── Analytics Modal ────────────────────────────────────── */}
          {analyticsStudent && (
            <StudentAnalyticsModal
              isOpen={!!analyticsStudent}
              onClose={() => setAnalyticsStudent(null)}
              studentId={analyticsStudent.id}
              studentName={analyticsStudent.name}
            />
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── STUDENT VIEW ───────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("analytics:student.title")}
          description={t("analytics:student.description")}
        />

        {myPerformance ? (
          <>
            <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4" staggerDelay={0.05}>
              <StaggerItem>
                <MetricCard label={t("analytics:student.metrics.marks")} value={myPerformance.student_marks} />
              </StaggerItem>
              <StaggerItem>
                <MetricCard label={t("analytics:student.metrics.attendance")} value={myPerformance.attendance} />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.internals")}
                  value={myPerformance.internal_assessments}
                  max={20}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.lab")}
                  value={myPerformance.lab_performance}
                  max={25}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.assignments")}
                  value={myPerformance.assignment_scores}
                  max={10}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.studyHrs")}
                  value={myPerformance.study_hours}
                  max={40}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.mastery")}
                  value={myPerformance.concept_mastery}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  label={t("analytics:student.metrics.average")}
                  value={averageScore(myPerformance)}
                />
              </StaggerItem>
            </StaggerContainer>

            <AnimatedPageSection>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t("analytics:student.overall")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <span className="text-lg font-semibold">
                    {t("analytics:student.averageLabel", { pct: averageScore(myPerformance) })}
                  </span>
                  {riskBadge(averageScore(myPerformance), t, "analytics:student.risk")}
                </CardContent>
              </Card>
            </AnimatedPageSection>

            {myPerformance.teacher_remarks && (
              <AnimatedPageSection>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics:student.teacherRemarks")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{myPerformance.teacher_remarks}</p>
                  </CardContent>
                </Card>
              </AnimatedPageSection>
            )}
          </>
        ) : (
          <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                    {t("analytics:student.noData.title")}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-400/80">
                    {t("analytics:student.noData.desc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function MetricPill({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-base">
        {value}
        {max === 100 ? "%" : ""}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70
      ? "from-emerald-50 to-emerald-100/50 text-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:text-emerald-300"
      : pct >= 50
      ? "from-amber-50 to-amber-100/50 text-amber-700 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-300"
      : "from-rose-50 to-rose-100/50 text-rose-700 dark:from-rose-950/40 dark:to-rose-900/20 dark:text-rose-300";
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`bg-gradient-to-br ${color} rounded-xl p-4 border border-current/10 shadow-sm hover:shadow-md transition-shadow`}
    >
      <p className="text-xs opacity-70 font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {value}
        {max === 100 ? "%" : ""}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-white/40 dark:bg-black/20 overflow-hidden">
        <div
          className="h-full bg-current rounded-full opacity-60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </motion.div>
  );
}
