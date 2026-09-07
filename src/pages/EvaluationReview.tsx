import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/integrations/api/client";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Play, CheckCircle2, AlertTriangle, Upload,
  FileText, Eye, PenLine, Sparkles, BarChart3,
} from "lucide-react";

interface AssignmentBrief { id: string; title: string; total_marks: number | null }
interface SubmissionItem {
  id: string;
  student_email?: string;
  student_name?: string;
  content: string | null;
  marks: number | null;
  submitted_at: string;
  assignment_id: string;
}
interface QuestionEval {
  id: string;
  question_id: string;
  question_number?: number;
  question_text?: string;
  student_answer_text: string | null;
  ai_score: number | null;
  final_score: number | null;
  max_marks: number;
  similarity_score: number | null;
  teacher_override: number | null;
  evaluation_feedback: string | null;
}
interface ModelSolution {
  id: string;
  assignment_id: string;
  question_id: string | null;
  solution_text: string | null;
  rubric: string | null;
}

export default function EvaluationReview() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const queryClient = useQueryClient();

  useEffect(() => { void loadPageNamespace("evaluation"); }, []);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [overrideValues, setOverrideValues] = useState<Record<string, { score: string; feedback: string }>>({});

  // ─── Queries ───
  const { data: assignments = [] } = useQuery<AssignmentBrief[]>({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions = [], isLoading: subsLoading } = useQuery<SubmissionItem[]>({
    queryKey: ["submissions", selectedAssignmentId],
    enabled: !!selectedAssignmentId,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/submissions?assignment_id=${selectedAssignmentId}`);
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [], isLoading: evalsLoading, refetch: refetchEvals } = useQuery<QuestionEval[]>({
    queryKey: ["evaluations", selectedSubmissionId],
    enabled: !!selectedSubmissionId,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/evaluations/${selectedSubmissionId}`);
      if (error) throw error;
      return data;
    },
  });

  const { data: modelSolutions = [] } = useQuery<ModelSolution[]>({
    queryKey: ["model-solutions", selectedAssignmentId],
    enabled: !!selectedAssignmentId,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/model-solutions?assignment_id=${selectedAssignmentId}`);
      if (error) throw error;
      return data;
    },
  });

  // ─── Upload model solution PDF ───
  const uploadSolutionMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assignment_id", selectedAssignmentId);
      const { data, error } = await apiClient.postFormData("/model-solutions/upload-pdf", formData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-solutions", selectedAssignmentId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", selectedAssignmentId] });
      toast({ title: t("evaluation:toasts.solutionUploaded") });
    },
    onError: (e: Error) => toast({ title: t("evaluation:toasts.solutionUploadFailed"), description: e.message, variant: "destructive" }),
  });

  // ─── Trigger AI evaluation ───
  const evaluateMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await apiClient.post(`/evaluate-submission/${submissionId}`, {});
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchEvals();
      queryClient.invalidateQueries({ queryKey: ["submissions", selectedAssignmentId] });
      toast({ title: t("evaluation:toasts.evaluationComplete"), description: t("evaluation:toasts.evaluationCompleteDesc", { score: data.total_ai_score, max: data.total_max_marks }) });
    },
    onError: (e: Error) => toast({ title: t("evaluation:toasts.evaluationFailed"), description: e.message, variant: "destructive" }),
  });

  // ─── Teacher override ───
  const overrideMutation = useMutation({
    mutationFn: async ({ evalId, score, feedback }: { evalId: string; score: number; feedback: string }) => {
      const { error } = await apiClient.put(`/evaluations/${evalId}/override`, {
        override_score: score,
        feedback,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEvals();
      queryClient.invalidateQueries({ queryKey: ["submissions", selectedAssignmentId] });
      toast({ title: t("evaluation:toasts.overrideSaved") });
    },
    onError: (e: Error) => toast({ title: t("evaluation:toasts.overrideFailed"), description: e.message, variant: "destructive" }),
  });

  const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {t("evaluation:header.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("evaluation:header.description")}
          </p>
        </div>

        {/* Selection bar */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("evaluation:selects.assignmentLabel")}</Label>
            <Select value={selectedAssignmentId || undefined} onValueChange={(v) => { setSelectedAssignmentId(v); setSelectedSubmissionId(""); }}>
              <SelectTrigger><SelectValue placeholder={t("evaluation:selects.assignmentPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {assignments.length === 0 ? (
                  <SelectItem value="none" disabled>{t("evaluation:selects.noAssignments")}</SelectItem>
                ) : (
                  assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("evaluation:selects.submissionLabel")}</Label>
            <Select value={selectedSubmissionId || undefined} onValueChange={setSelectedSubmissionId} disabled={!selectedAssignmentId}>
              <SelectTrigger><SelectValue placeholder={subsLoading ? t("evaluation:selects.loading") : t("evaluation:selects.submissionPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {submissions.length === 0 && !subsLoading ? (
                  <SelectItem value="none" disabled>{t("evaluation:selects.noSubmissions")}</SelectItem>
                ) : (
                  submissions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.student_email || s.student_name || t("evaluation:selects.studentFallback")} — {s.marks ?? t("evaluation:selects.ungraded")}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Model solution management */}
        {selectedAssignmentId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> {t("evaluation:modelSolutions.title")}
              </CardTitle>
              <CardDescription>{t("evaluation:modelSolutions.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSolutionMutation.mutate(f);
                    }}
                  />
                  <Button variant="outline" asChild disabled={uploadSolutionMutation.isPending}>
                    <span>
                      {uploadSolutionMutation.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("evaluation:modelSolutions.uploading")}</>
                        : <><Upload className="h-4 w-4 mr-2" />{t("evaluation:modelSolutions.uploadPdf")}</>
                      }
                    </span>
                  </Button>
                </label>
                <Badge variant="secondary">{t("evaluation:modelSolutions.solutionsCount", { count: modelSolutions.length })}</Badge>
              </div>
              {modelSolutions.length > 0 && (
                <div className="rounded border p-3 max-h-32 overflow-y-auto text-sm text-muted-foreground">
                  {modelSolutions.map((ms, i) => (
                    <div key={ms.id} className="mb-1">
                      <span className="font-medium text-foreground">{t("evaluation:modelSolutions.solutionNumber", { n: i + 1 })}</span>{" "}
                      {ms.solution_text ? ms.solution_text.slice(0, 200) + (ms.solution_text.length > 200 ? "..." : "") : t("evaluation:modelSolutions.fileBased")}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Selected submission */}
        {selectedSubmission && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Student answer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" /> {t("evaluation:studentAnswer.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded border bg-muted/30 p-4 max-h-72 overflow-y-auto text-sm whitespace-pre-wrap">
                  {selectedSubmission.content || <span className="text-muted-foreground italic">{t("evaluation:studentAnswer.noContent")}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline">
                    {selectedSubmission.marks !== null && selectedSubmission.marks !== undefined
                      ? t("evaluation:studentAnswer.currentMarks", { marks: selectedSubmission.marks })
                      : t("evaluation:studentAnswer.currentMarksEmpty")}
                  </Badge>
                  <Button
                    onClick={() => evaluateMutation.mutate(selectedSubmissionId)}
                    disabled={evaluateMutation.isPending}
                  >
                    {evaluateMutation.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("evaluation:studentAnswer.evaluating")}</>
                      : <><Sparkles className="h-4 w-4 mr-2" />{t("evaluation:studentAnswer.runEvaluation")}</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Evaluations list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> {t("evaluation:evaluations.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evalsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("evaluation:evaluations.loading")}
                  </div>
                ) : evaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("evaluation:evaluations.empty")}</p>
                ) : (
                  evaluations.map((ev) => {
                    const pct = ev.max_marks > 0 ? ((ev.final_score ?? ev.ai_score ?? 0) / ev.max_marks) * 100 : 0;
                    const overrideKey = ev.id;
                    return (
                      <div key={ev.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{t("evaluation:evaluations.questionLabel", { n: ev.question_number ?? "?" })}</Badge>
                            <span className="text-sm font-medium">
                              {ev.final_score ?? ev.ai_score ?? 0}/{ev.max_marks}
                            </span>
                            {ev.teacher_override !== null && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px]">
                                <PenLine className="h-3 w-3 mr-0.5" /> {t("evaluation:evaluations.overridden")}
                              </Badge>
                            )}
                          </div>
                          {ev.similarity_score !== null && (
                            <span className="text-xs text-muted-foreground">
                              {t("evaluation:studentAnswer.similarity", { pct: Math.round(ev.similarity_score * 100) })}
                            </span>
                          )}
                        </div>

                        <Progress value={pct} className="h-1.5" />

                        {ev.student_answer_text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{ev.student_answer_text}</p>
                        )}

                        {ev.evaluation_feedback && (
                          <p className="text-xs italic text-muted-foreground">
                            {ev.evaluation_feedback}
                          </p>
                        )}

                        {/* Override controls */}
                        <div className="flex items-end gap-2 pt-1">
                          <div className="space-y-1 w-20">
                            <Label className="text-[10px]">{t("evaluation:evaluations.overrideLabel")}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={ev.max_marks}
                              placeholder={t("evaluation:evaluations.scorePlaceholder")}
                              className="h-8 text-xs"
                              value={overrideValues[overrideKey]?.score ?? ""}
                              onChange={(e) => setOverrideValues((prev) => ({
                                ...prev,
                                [overrideKey]: { ...prev[overrideKey], score: e.target.value, feedback: prev[overrideKey]?.feedback ?? "" },
                              }))}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px]">{t("evaluation:evaluations.feedbackLabel")}</Label>
                            <Input
                              placeholder={t("evaluation:evaluations.feedbackPlaceholder")}
                              className="h-8 text-xs"
                              value={overrideValues[overrideKey]?.feedback ?? ""}
                              onChange={(e) => setOverrideValues((prev) => ({
                                ...prev,
                                [overrideKey]: { ...prev[overrideKey], feedback: e.target.value, score: prev[overrideKey]?.score ?? "" },
                              }))}
                            />
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={!overrideValues[overrideKey]?.score || overrideMutation.isPending}
                            onClick={() => {
                              const val = overrideValues[overrideKey];
                              if (val?.score) {
                                overrideMutation.mutate({
                                  evalId: ev.id,
                                  score: Number(val.score),
                                  feedback: val.feedback || "",
                                });
                              }
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> {t("evaluation:evaluations.save")}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
