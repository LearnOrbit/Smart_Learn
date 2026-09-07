import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { loadPageNamespace } from "@/i18n";
import { Target, BookMarked, Lightbulb, Users, TrendingUp, TrendingDown, Minus, MessageSquare, ClipboardEdit, Save, PlusCircle } from "lucide-react";

interface ScoreRow {
  po_id: string;
  po_code: string;
  po_score: number;
  co_id: string;
  co_code: string;
  co_score: number;
  lo_id: string;
  lo_code: string;
  lo_score: number;
}

// Rule-based feedback generator
function generateFeedback(
  scores: { code: string; score: number; type: string }[],
  t: (key: string, opts?: Record<string, unknown>) => string
): string[] {
  const feedback: string[] = [];
  const weak = scores.filter((s) => s.score < 40);
  const moderate = scores.filter((s) => s.score >= 40 && s.score < 70);
  const strong = scores.filter((s) => s.score >= 70);

  if (strong.length > 0) {
    feedback.push(
      t("scores:feedback.strong", { codes: strong.map((s) => s.code).join(", ") })
    );
  }
  if (moderate.length > 0) {
    feedback.push(
      t("scores:feedback.moderate", { codes: moderate.map((s) => s.code).join(", ") })
    );
  }
  if (weak.length > 0) {
    feedback.push(
      t("scores:feedback.weak", { codes: weak.map((s) => s.code).join(", ") })
    );
  }

  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b.score, 0) / scores.length : 0;
  if (avg >= 70) {
    feedback.push(t("scores:feedback.overallExcellent"));
  } else if (avg >= 40) {
    feedback.push(t("scores:feedback.overallModerate"));
  } else if (scores.length > 0) {
    feedback.push(t("scores:feedback.overallLow"));
  }

  return feedback;
}

interface SubmissionEntry {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string;
  marks: number | null;
  grade: string | null;
  feedback: string | null;
  submitted_at: string;
}

interface AssignmentEntry {
  id: string;
  title: string;
  description: string;
}

// ── Grade Submissions Panel (teacher only) ────────────────────────
function GradeSubmissionsPanel({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation("pages");
  useEffect(() => { void loadPageNamespace("scores"); }, []);

  // All assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["all_assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return (data || []) as AssignmentEntry[];
    },
  });

  // Student's existing submissions
  const { data: submissions = [] } = useQuery({
    queryKey: ["student_submissions", studentId],
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/submissions?student_id=${studentId}`);
      if (error) throw error;
      return (data || []) as SubmissionEntry[];
    },
    enabled: !!studentId,
  });

  // Grade / update a submission
  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, grade, feedback }: { id: string; marks: number | null; grade: string; feedback: string }) => {
      const { error } = await apiClient.put(`/submissions/${id}`, { marks, grade, feedback });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_submissions", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student_scores", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student_submissions_history", studentId] });
      toast({ title: t("scores:grade.toasts.saved") });
    },
    onError: (e: Error) => toast({ title: t("scores:grade.toasts.error"), description: e.message, variant: "destructive" }),
  });

  // Create a submission on behalf of the student (so teacher can then grade it)
  const createMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await apiClient.post("/submissions", {
        assignment_id: assignmentId,
        student_id: studentId,
        content: "Created by teacher for grading",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_submissions", studentId] });
      toast({ title: t("scores:grade.toasts.submissionCreated") });
    },
    onError: (e: Error) => toast({ title: t("scores:grade.toasts.error"), description: e.message, variant: "destructive" }),
  });

  // Map assignment_id -> submission for quick lookup
  const subByAssignment = new Map<string, SubmissionEntry>();
  submissions.forEach((s) => subByAssignment.set(s.assignment_id, s));

  // Local editable state keyed by submission id
  const [edits, setEdits] = useState<Record<string, { marks: string; grade: string; feedback: string }>>({});

  const getEdit = (s: SubmissionEntry) => edits[s.id] || {
    marks: s.marks != null ? String(s.marks) : "",
    grade: s.grade || "",
    feedback: s.feedback || "",
  };

  const setField = (id: string, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...getEditById(id), [field]: value },
    }));
  };

  const getEditById = (id: string) => {
    const s = submissions.find((x) => x.id === id);
    return edits[id] || {
      marks: s?.marks != null ? String(s.marks) : "",
      grade: s?.grade || "",
      feedback: s?.feedback || "",
    };
  };

  const handleSave = (sub: SubmissionEntry) => {
    const e = getEdit(sub);
    gradeMutation.mutate({
      id: sub.id,
      marks: e.marks ? Number(e.marks) : null,
      grade: e.grade,
      feedback: e.feedback,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardEdit className="h-4 w-4" /> {t("scores:grade.title")}
        </CardTitle>
        <CardDescription>{t("scores:grade.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("scores:grade.noAssignments")}</p>
        ) : (
          <div className="divide-y">
            {assignments.map((a) => {
              const sub = subByAssignment.get(a.id);
              return (
                <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    {sub ? (
                      <Badge variant={sub.marks != null ? "default" : "secondary"} className="text-xs">
                        {sub.marks != null
                          ? t("scores:grade.marksWithCount", { count: sub.marks })
                          : t("scores:grade.notGraded")}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => createMutation.mutate(a.id)}
                        disabled={createMutation.isPending}
                      >
                        <PlusCircle className="h-3 w-3 mr-1" />
                        {t("scores:grade.addEntry")}
                      </Button>
                    )}
                  </div>
                  {sub && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={t("scores:grade.marksPlaceholder")}
                        className="w-24 h-8 text-sm"
                        value={getEdit(sub).marks}
                        onChange={(e) => setField(sub.id, "marks", e.target.value)}
                      />
                      <Input
                        placeholder={t("scores:grade.gradePlaceholder")}
                        className="w-20 h-8 text-sm"
                        value={getEdit(sub).grade}
                        onChange={(e) => setField(sub.id, "grade", e.target.value)}
                      />
                      <Input
                        placeholder={t("scores:grade.feedbackPlaceholder")}
                        className="flex-1 h-8 text-sm"
                        value={getEdit(sub).feedback}
                        onChange={(e) => setField(sub.id, "feedback", e.target.value)}
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => handleSave(sub)}
                        disabled={gradeMutation.isPending}
                      >
                        <Save className="h-3 w-3 mr-1" /> {t("scores:grade.save")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  const TrendIcon = score >= 70 ? TrendingUp : score >= 40 ? Minus : TrendingDown;
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium w-16 shrink-0">{label}</span>
      <Progress value={score} className="flex-1 h-2" />
      <TrendIcon className={`h-4 w-4 shrink-0 ${color}`} />
      <span className={`text-sm font-bold w-12 text-right ${color}`}>{score.toFixed(1)}%</span>
    </div>
  );
}

function StudentScoresView({ studentId }: { studentId: string }) {
  const { t } = useTranslation("pages");
  useEffect(() => { void loadPageNamespace("scores"); }, []);
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["student_scores", studentId],
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/student-scores/${studentId}`);
      if (error) throw error;
      return (data as ScoreRow[]) || [];
    },
    enabled: !!studentId,
  });

  // Fetch submission history for moving average
  const { data: submissions = [] } = useQuery({
    queryKey: ["student_submissions_history", studentId],
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/submissions?student_id=${studentId}`);
      if (error) throw error;
      // Filter to only graded submissions
      return (data || []).filter((s: any) => s.marks != null);
    },
    enabled: !!studentId,
  });

  // Fetch assignment titles for display
  const { data: allAssignments = [] } = useQuery({
    queryKey: ["all_assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return (data || []) as AssignmentEntry[];
    },
  });

  const assignmentMap = new Map(allAssignments.map((a) => [a.id, a.title]));

  if (isLoading) return <p className="text-muted-foreground">{t("scores:view.loading")}</p>;

  if (scores.length === 0 && submissions.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        {t("scores:view.noScores")}
      </CardContent>
    </Card>
  );

  // Deduplicate
  const poMap = new Map<string, { code: string; score: number }>();
  const coMap = new Map<string, { code: string; score: number }>();
  const loMap = new Map<string, { code: string; score: number }>();

  scores.forEach((r) => {
    if (!poMap.has(r.po_id)) poMap.set(r.po_id, { code: r.po_code, score: Number(r.po_score) });
    if (!coMap.has(r.co_id)) coMap.set(r.co_id, { code: r.co_code, score: Number(r.co_score) });
    if (!loMap.has(r.lo_id)) loMap.set(r.lo_id, { code: r.lo_code, score: Number(r.lo_score) });
  });

  // Compute moving average (last 3 submissions)
  const recentMarks = submissions.slice(-3).map((s: any) => Number(s.marks));
  const movingAvg = recentMarks.length > 0
    ? recentMarks.reduce((a: number, b: number) => a + b, 0) / recentMarks.length
    : null;

  const allMarks = submissions.map((s: any) => Number(s.marks));
  const overallAvg = allMarks.length > 0
    ? allMarks.reduce((a: number, b: number) => a + b, 0) / allMarks.length
    : null;

  // Trend detection
  const trend = movingAvg !== null && overallAvg !== null
    ? movingAvg > overallAvg + 5 ? "improving" : movingAvg < overallAvg - 5 ? "declining" : "stable"
    : null;

  // Collect all scores for feedback
  const allScores = [
    ...[...loMap.entries()].map(([, { code, score }]) => ({ code, score, type: "LO" })),
  ];
  const feedbackMessages = generateFeedback(allScores, t);

  return (
    <div className="space-y-6">
      {/* Graded Submissions */}
      {submissions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardEdit className="h-4 w-4" /> {t("scores:view.graded.title")}
            </CardTitle>
            <CardDescription>{t("scores:view.graded.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {submissions.map((s: any) => (
                <div key={s.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {assignmentMap.get(s.assignment_id) || t("scores:view.assignment")}
                    </p>
                    {s.feedback && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.feedback}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.marks != null && (
                      <Badge variant="default" className="text-xs">{t("scores:grade.marksWithCount", { count: s.marks })}</Badge>
                    )}
                    {s.grade && (
                      <Badge variant="secondary" className="text-xs">{s.grade}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      {(movingAvg !== null || feedbackMessages.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> {t("scores:view.insights.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {movingAvg !== null && (
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <span className="text-muted-foreground">{t("scores:view.insights.recentAvg")}</span>
                  <span className="font-bold">{movingAvg.toFixed(1)}</span>
                </div>
                {overallAvg !== null && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                    <span className="text-muted-foreground">{t("scores:view.insights.overallAvg")}</span>
                    <span className="font-bold">{overallAvg.toFixed(1)}</span>
                  </div>
                )}
                {trend && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                    <span className="text-muted-foreground">{t("scores:view.insights.trend")}</span>
                    {trend === "improving" && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {trend === "declining" && <TrendingDown className="h-4 w-4 text-red-600" />}
                    {trend === "stable" && <Minus className="h-4 w-4 text-yellow-600" />}
                    <span className="font-medium">{t(`scores:view.insights.${trend}`)}</span>
                  </div>
                )}
              </div>
            )}
            {feedbackMessages.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {feedbackMessages.map((msg, i) => (
                  <p key={i} className="text-sm text-foreground">{msg}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scores.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" /> {t("scores:view.po.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...poMap.entries()].map(([id, { code, score }]) => (
                <ScoreBar key={id} label={code} score={score} icon={Target} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookMarked className="h-4 w-4" /> {t("scores:view.co.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...coMap.entries()].map(([id, { code, score }]) => (
                <ScoreBar key={id} label={code} score={score} icon={BookMarked} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> {t("scores:view.lo.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...loMap.entries()].map(([id, { code, score }]) => (
                <ScoreBar key={id} label={code} score={score} icon={Lightbulb} />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ScoresDashboard() {
  const { role, user } = useAuth();
  const { t } = useTranslation("pages");
  useEffect(() => { void loadPageNamespace("scores"); }, []);
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  const { data: students = [] } = useQuery({
    queryKey: ["student_profiles"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/students-list");
      if (error) throw error;
      return (data || []).map((s: any) => ({ user_id: s.id, full_name: s.name }));
    },
    enabled: role === "teacher",
  });

  if (role === "student") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t("scores:student.title")}</h2>
            <p className="text-muted-foreground">{t("scores:student.description")}</p>
          </div>
          <StudentScoresView studentId={user!.id} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t("scores:teacher.title")}</h2>
          <p className="text-muted-foreground">{t("scores:teacher.description")}</p>
        </div>

        <div className="max-w-xs">
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger>
              <SelectValue placeholder={t("scores:teacher.selectStudent")} />
            </SelectTrigger>
            <SelectContent>
              {students.map((s: any) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.full_name || s.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStudent ? (
          <div className="space-y-6">
            <GradeSubmissionsPanel studentId={selectedStudent} />
            <StudentScoresView studentId={selectedStudent} />
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {t("scores:teacher.selectStudentHint")}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
