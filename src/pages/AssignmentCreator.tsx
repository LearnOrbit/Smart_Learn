import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getClassrooms } from "@/utils/mockClassrooms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, FileText, Upload, Loader2, Sparkles,
  BookOpen, ClipboardList, GraduationCap, Lightbulb,
  ChevronDown, ChevronUp, FileCheck, Send, BookMarked,
  Eye, CheckCircle2, AlertCircle, Users,
} from "lucide-react";

interface COItem { id: string; code: string; description: string; subject_id: string | null }
interface LOItem { id: string; code: string; description: string; course_outcome_id: string | null; subject_id: string | null }
interface SubjectItem { id: string; code: string; name: string }
interface ClassroomItem { id: string; name: string; code: string; student_count?: number }
interface GeneratedQuestion {
  question_number: number;
  question_text: string;
  marks: number;
  co_id: string | null;
  co_code: string | null;
  difficulty: string;
  solution_text: string;
  rubric: string;
}

type AssignmentStatus = "draft" | "published";

export default function AssignmentCreator() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  useEffect(() => { void loadPageNamespace("assignmentCreator"); }, []);
  const queryClient = useQueryClient();

  // ─── Assignment details ───
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subjectId, setSubjectId] = useState("none");
  // ── NEW: classroom selection ──
  const [classroomId, setClassroomId] = useState("none");
  const [localClassrooms, setLocalClassrooms] = useState<ClassroomItem[]>([]);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [generationMethod, setGenerationMethod] = useState("manual");
  const [expandedSolutions, setExpandedSolutions] = useState<Record<number, boolean>>({});
  const [bulkSolutionUploading, setBulkSolutionUploading] = useState(false);
  const solutionFileRef = useRef<HTMLInputElement | null>(null);

  // ─── Preview/approval state ───
  const [showPreview, setShowPreview] = useState(false);

  // ─── CO-based generation ───
  const [selectedCOs, setSelectedCOs] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [marksPerQ, setMarksPerQ] = useState(10);

  // ─── Syllabus-based generation ───
  const [syllabusText, setSyllabusText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ─── Past Papers ───
  const [pastPaperUploading, setPastPaperUploading] = useState(false);
  const pastPaperFileRef = useRef<HTMLInputElement | null>(null);

  // ─── Queries ───
  const { data: courseOutcomes = [] } = useQuery<COItem[]>({
    queryKey: ["course-outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/course-outcomes"); if (error) throw error; return data ?? []; },
  });

  const { data: learningOutcomes = [] } = useQuery<LOItem[]>({
    queryKey: ["learning-outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/learning-outcomes"); if (error) throw error; return data ?? []; },
  });

  const { data: subjects = [] } = useQuery<SubjectItem[]>({
    queryKey: ["subjects"],
    queryFn: async () => { const { data, error } = await apiClient.get("/subjects"); if (error) throw error; return data ?? []; },
  });

  // ── Load classrooms from localStorage (same source as TeacherDashboard) ──
  useEffect(() => {
    const load = () => {
      const cls = getClassrooms();
      setLocalClassrooms(cls.map(c => ({ id: c.id, name: c.name, code: c.code })));
    };
    load();
    window.addEventListener("classroomSync", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("classroomSync", load);
      window.removeEventListener("storage", load);
    };
  }, []);
  const classrooms = localClassrooms;

  const { data: pastQuestions = [], refetch: refetchPastPapers } = useQuery({
    queryKey: ["past-papers", subjectId],
    queryFn: async () => {
      if (!subjectId || subjectId === "none") return [];
      const { data, error } = await apiClient.get(`/subjects/${subjectId}/past-papers`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: subjectId !== "none",
  });

  const subjectsWithOutcomes = subjects;

  const filteredCOs = subjectId === "none" ? courseOutcomes : courseOutcomes.filter(co => co.subject_id === subjectId);
  const filteredLOs = subjectId === "none" ? learningOutcomes : learningOutcomes.filter(lo => lo.subject_id === subjectId);

  const losByCO = filteredCOs.map(co => ({
    co,
    los: filteredLOs.filter(lo => lo.course_outcome_id === co.id),
  })).filter(g => g.los.length > 0);
  const ungroupedLOs = filteredLOs.filter(lo => !lo.course_outcome_id && (!subjectId || subjectId === "none" || lo.subject_id === subjectId));

  // ─── Generate from COs ───
  const genCOMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.post("/generate-questions/co-based", {
        co_ids: selectedCOs,
        num_questions: numQuestions,
        difficulty,
        marks_per_question: marksPerQ,
      });
      if (error) throw error;
      return data as { questions: GeneratedQuestion[]; total_marks: number };
    },
    onSuccess: (data) => {
      setQuestions(data.questions.map((q: GeneratedQuestion) => ({ ...q, solution_text: q.solution_text || "", rubric: q.rubric || "" })));
      setGenerationMethod("co_based");
      setShowPreview(false);
      toast({ title: t("assignmentCreator:toasts.questionsGenerated", { count: data.questions.length }), description: "Review them below, then approve to send to students." });
    },
    onError: (e: Error) => toast({ title: t("assignmentCreator:toasts.generationFailed"), description: e.message, variant: "destructive" }),
  });

  // ─── Generate from syllabus ───
  const genSyllabusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.post("/generate-questions/syllabus-based", {
        syllabus_text: syllabusText,
        num_questions: numQuestions,
        difficulty,
        marks_per_question: marksPerQ,
      });
      if (error) throw error;
      return data as { questions: GeneratedQuestion[]; total_marks: number };
    },
    onSuccess: (data) => {
      setQuestions(data.questions.map((q: GeneratedQuestion) => ({ ...q, solution_text: q.solution_text || "", rubric: q.rubric || "" })));
      setGenerationMethod("syllabus_based");
      setShowPreview(false);
      toast({ title: t("assignmentCreator:toasts.questionsGenerated", { count: data.questions.length }), description: "Review and approve to send to students." });
    },
    onError: (e: Error) => toast({ title: t("assignmentCreator:toasts.generationFailed"), description: e.message, variant: "destructive" }),
  });

  // ─── Past Paper Mutations ───
  const uploadPastPaperMutation = useMutation({
    mutationFn: async (file: File) => {
      if (subjectId === "none") throw new Error("Select a subject first");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`http://localhost:8000/api/subjects/${subjectId}/past-papers/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("assignmentCreator:toasts.pastPaperUploaded"), description: data.message });
      refetchPastPapers();
    },
    onError: (err: any) => toast({ title: t("assignmentCreator:toasts.uploadFailed"), description: err.message, variant: "destructive" }),
    onSettled: () => {
      setPastPaperUploading(false);
      if (pastPaperFileRef.current) pastPaperFileRef.current.value = "";
    }
  });

  const clearPastPapersMutation = useMutation({
    mutationFn: async () => {
      if (subjectId === "none") throw new Error("Select a subject first");
      const { error } = await apiClient.delete(`/subjects/${subjectId}/past-papers`);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Past Papers Cleared", description: "All past questions for this subject have been removed." });
      refetchPastPapers();
    },
    onError: (err: any) => toast({ title: "Clear Failed", description: err.message, variant: "destructive" })
  });

  // ─── File extraction ───
  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.type === "application/pdf" ? "/extract-text/pdf" : "/extract-text/image";
      const { data, error } = await apiClient.postFormData(endpoint, formData);
      if (error) throw error;
      setSyllabusText(data.text || "");
      toast({ title: "Text extracted!" });
    } catch (e: unknown) {
      toast({ title: "Extraction failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally { setExtracting(false); }
  };

  // ─── Bulk solution upload ───
  const handleSolutionPdfUpload = async (file: File) => {
    setBulkSolutionUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = file.type === "application/pdf" ? "/extract-text/pdf" : "/extract-text/image";
      const { data, error } = await apiClient.postFormData(endpoint, formData);
      if (error) throw error;
      const text = data.text || "";
      if (questions.length > 0) {
        const parts = text.split(/(?=(?:Q|Question)\s*\d)/i).filter((p: string) => p.trim());
        if (parts.length >= questions.length) {
          setQuestions((prev) => prev.map((q, i) => ({ ...q, solution_text: (parts[i] || "").trim() })));
        } else {
          setQuestions((prev) => prev.map((q, i) => i === 0 ? { ...q, solution_text: text.trim() } : q));
        }
        toast({ title: "Solution PDF extracted!", description: "Distributed across questions." });
      } else {
        toast({ title: "Add questions first", variant: "destructive" });
      }
    } catch (e: unknown) {
      toast({ title: "Extraction failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally { setBulkSolutionUploading(false); }
  };

  // ─── Create assignment (with classroom_id) ───
  const createMutation = useMutation({
    mutationFn: async (status: AssignmentStatus) => {
      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const { data, error } = await apiClient.post("/assignments", {
        title,
        description,
        due_date: dueDate || null,
        subject_id: subjectId === "none" ? null : subjectId,
        // ── KEY FIX: send classroom_id so assignment is visible in portals ──
        classroom_id: classroomId === "none" ? null : classroomId,
        total_marks: totalMarks || null,
        generation_method: generationMethod,
        learning_outcome_ids: selectedLOs,
        status, // "draft" = hidden from students, "published" = visible in student portal
        questions: questions.map((q) => ({
          question_text: q.question_text,
          marks: q.marks,
          co_id: q.co_id,
          difficulty: q.difficulty,
        })),
      });
      if (error) throw error;

      const assignmentId = data.id;
      const hasSolutions = questions.some((q) => q.solution_text?.trim() || q.rubric?.trim());
      if (hasSolutions && assignmentId) {
        const { data: createdQuestions } = await apiClient.get(`/assignments/${assignmentId}/questions`);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (q.solution_text?.trim() || q.rubric?.trim()) {
            const matchedQ = createdQuestions?.[i];
            await apiClient.post("/model-solutions", {
              assignment_id: assignmentId,
              question_id: matchedQ?.id || null,
              solution_text: q.solution_text || "",
              rubric: q.rubric || "",
            });
          }
        }
      }
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      resetForm();
      if (status === "published") {
        toast({ title: "✅ Assignment sent to classroom!", description: "Students can now see and submit this assignment." });
      } else {
        toast({ title: "Draft saved", description: "Assignment saved as draft. Approve it later to send to students." });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setTitle(""); setDescription(""); setDueDate("");
    setSubjectId("none"); setClassroomId("none");
    setSelectedLOs([]); setQuestions([]); setGenerationMethod("manual");
    setSelectedCOs([]); setSyllabusText(""); setExpandedSolutions({});
    setShowPreview(false);
  };

  const toggleSolutionExpand = (idx: number) => setExpandedSolutions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const toggleCO = (id: string) => setSelectedCOs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleLO = (id: string) => setSelectedLOs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const removeQuestion = (idx: number) => setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, question_number: i + 1 })));
  const updateQuestion = (idx: number, field: string, value: string | number) => setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  const addManualQuestion = () => setQuestions((prev) => [...prev, { question_number: prev.length + 1, question_text: "", marks: 10, co_id: null, co_code: null, difficulty: "medium", solution_text: "", rubric: "" }]);

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const canCreate = title.trim() && questions.length > 0 && !createMutation.isPending;
  const selectedSubject = subjects.find(s => s.id === subjectId);
  const selectedClassroom = classrooms.find(c => c.id === classroomId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("assignmentCreator:title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("assignmentCreator:description")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ── Left: Details ── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> {t("assignmentCreator:details.cardTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("assignmentCreator:details.titleLabel")} <span className="text-destructive">*</span></Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("assignmentCreator:details.titlePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("assignmentCreator:details.descriptionLabel")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("assignmentCreator:details.descriptionPlaceholder")} rows={2} />
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("assignmentCreator:details.dueDateLabel")}</Label>
                    <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("assignmentCreator:details.subjectLabel")}</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {subjectsWithOutcomes.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── NEW: Classroom selector (required for student visibility) ── */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    {t("assignmentCreator:classroom.label")}
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">({t("assignmentCreator:classroom.hint")})</span>
                  </Label>
                  <Select value={classroomId} onValueChange={setClassroomId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("assignmentCreator:classroom.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("assignmentCreator:classroom.none")}</SelectItem>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.student_count !== undefined && ` · ${c.student_count} students`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {classroomId !== "none" && selectedClassroom && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("assignmentCreator:classroom.willBeVisible")} <strong>{selectedClassroom.name}</strong>
                    </p>
                  )}
                  {classroomId === "none" && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("assignmentCreator:classroom.emptyHint")}
                    </p>
                  )}
                </div>

                {subjectId !== "none" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {t("assignmentCreator:pastPapers.title")}</Label>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{t("assignmentCreator:pastPapers.available", { count: pastQuestions.length })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input ref={pastPaperFileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPastPaperUploading(true); uploadPastPaperMutation.mutate(f); } }} />
                      <Button size="sm" variant="outline" className="h-7 text-xs bg-white" onClick={() => pastPaperFileRef.current?.click()} disabled={pastPaperUploading}>
                        {pastPaperUploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t("assignmentCreator:pastPapers.uploading")}</> : <><Upload className="h-3 w-3 mr-1" />{t("assignmentCreator:pastPapers.upload")}</>}
                      </Button>
                      {pastQuestions.length > 0 && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive/90 hover:bg-destructive/10" onClick={() => clearPastPapersMutation.mutate()} disabled={clearPastPapersMutation.isPending}>
                          <Trash2 className="h-3 w-3 mr-1" />{t("assignmentCreator:pastPapers.clear")}
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t("assignmentCreator:pastPapers.blendHint")}</p>
                  </div>
                )}

                {/* ─── CO Selector ─── */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <GraduationCap className="h-4 w-4 text-violet-500" /> {t("assignmentCreator:courseOutcomes.label")}
                  </Label>
                  {filteredCOs.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">{t("assignmentCreator:courseOutcomes.noCos")}</div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {filteredCOs.map(co => (
                        <button
                          key={co.id}
                          type="button"
                          onClick={() => toggleCO(co.id)}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all border ${selectedCOs.includes(co.id)
                              ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20 text-violet-800 dark:text-violet-300"
                              : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          <span className="font-bold mr-1.5">{co.code}</span>
                          {co.description}
                          {selectedCOs.includes(co.id) && (
                            <CheckCircle2 className="h-3 w-3 inline ml-1.5 text-violet-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCOs.length > 0 && (
                    <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{t("assignmentCreator:courseOutcomes.selected", { count: selectedCOs.length })}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary card */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("assignmentCreator:summary.questions")}</span>
                  <span className="font-bold text-primary">{questions.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("assignmentCreator:summary.totalMarks")}</span>
                  <span className="font-bold text-primary">{totalMarks}</span>
                </div>
                {selectedLOs.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("assignmentCreator:summary.losLinked")}</span>
                    <span className="font-bold text-primary">{selectedLOs.length}</span>
                  </div>
                )}
                {classroomId !== "none" && selectedClassroom && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("assignmentCreator:summary.classroom")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{selectedClassroom.name}</span>
                  </div>
                )}
                <Separator />

                {questions.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowPreview(v => !v)}
                  >
                    <Eye className="h-4 w-4" />
                    {showPreview ? t("assignmentCreator:actions.hidePreview") : t("assignmentCreator:actions.preview")}
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={!canCreate}
                    onClick={() => createMutation.mutate("draft")}
                    className="gap-1.5 text-sm"
                  >
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    {t("assignmentCreator:actions.saveDraft")}
                  </Button>
                  <Button
                    disabled={!canCreate}
                    onClick={() => createMutation.mutate("published")}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {t("assignmentCreator:actions.sendToStudents")}
                  </Button>
                </div>
                {!title.trim() && <p className="text-[11px] text-muted-foreground text-center">{t("assignmentCreator:hints.needTitle")}</p>}
                {questions.length === 0 && <p className="text-[11px] text-muted-foreground text-center">{t("assignmentCreator:hints.needQuestions")}</p>}
                {classroomId === "none" && canCreate && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {t("assignmentCreator:hints.noClassroom")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Generation + Questions ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Generation card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> {t("assignmentCreator:generation.title")}</CardTitle>
                <CardDescription>{t("assignmentCreator:generation.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="co" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="co"><GraduationCap className="h-3.5 w-3.5 mr-1.5" />{t("assignmentCreator:generation.tabs.co")}</TabsTrigger>
                    <TabsTrigger value="syllabus"><BookOpen className="h-3.5 w-3.5 mr-1.5" />{t("assignmentCreator:generation.tabs.syllabus")}</TabsTrigger>
                    <TabsTrigger value="manual"><FileText className="h-3.5 w-3.5 mr-1.5" />{t("assignmentCreator:generation.tabs.manual")}</TabsTrigger>
                  </TabsList>

                  {/* CO-Based */}
                  <TabsContent value="co" className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("assignmentCreator:generation.coTab.selectLabel")}</Label>
                      {courseOutcomes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t("assignmentCreator:generation.coTab.noCosHint")}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {courseOutcomes.map((co) => (
                            <button key={co.id} type="button" onClick={() => toggleCO(co.id)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${selectedCOs.includes(co.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"
                                }`}
                            >
                              {co.code}
                              <span className="ml-1 opacity-60 max-w-[100px] truncate inline-block align-bottom text-[10px]">{co.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">{t("assignmentCreator:generation.coTab.numQuestions")}</Label><Input type="number" min={1} max={30} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t("assignmentCreator:generation.coTab.marksPerQuestion")}</Label><Input type="number" min={1} value={marksPerQ} onChange={(e) => setMarksPerQ(Number(e.target.value))} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("assignmentCreator:generation.coTab.difficulty")}</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">{t("assignmentCreator:generation.coTab.difficulty_easy")}</SelectItem>
                            <SelectItem value="medium">{t("assignmentCreator:generation.coTab.difficulty_medium")}</SelectItem>
                            <SelectItem value="hard">{t("assignmentCreator:generation.coTab.difficulty_hard")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => genCOMutation.mutate()} disabled={selectedCOs.length === 0 || genCOMutation.isPending} className="w-full">
                      {genCOMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("assignmentCreator:generation.coTab.generating")}</> : <><Sparkles className="h-4 w-4 mr-2" />{t("assignmentCreator:generation.coTab.generate")}</>}
                    </Button>
                  </TabsContent>

                  {/* Syllabus-Based */}
                  <TabsContent value="syllabus" className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("assignmentCreator:generation.syllabusTab.textLabel")}</Label>
                      <Textarea value={syllabusText} onChange={(e) => setSyllabusText(e.target.value)} rows={4} placeholder={t("assignmentCreator:generation.syllabusTab.placeholder")} />
                    </div>
                    <div className="grid gap-3 grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">{t("assignmentCreator:generation.syllabusTab.numQuestions")}</Label><Input type="number" min={1} max={30} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t("assignmentCreator:generation.syllabusTab.marksPerQuestion")}</Label><Input type="number" min={1} value={marksPerQ} onChange={(e) => setMarksPerQ(Number(e.target.value))} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("assignmentCreator:generation.syllabusTab.difficulty")}</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">{t("assignmentCreator:generation.syllabusTab.difficulty_easy")}</SelectItem>
                            <SelectItem value="medium">{t("assignmentCreator:generation.syllabusTab.difficulty_medium")}</SelectItem>
                            <SelectItem value="hard">{t("assignmentCreator:generation.syllabusTab.difficulty_hard")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => genSyllabusMutation.mutate()} disabled={!syllabusText.trim() || genSyllabusMutation.isPending} className="w-full">
                      {genSyllabusMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("assignmentCreator:generation.syllabusTab.generating")}</> : <><Sparkles className="h-4 w-4 mr-2" />{t("assignmentCreator:generation.syllabusTab.generate")}</>}
                    </Button>
                  </TabsContent>

                  {/* Manual */}
                  <TabsContent value="manual" className="space-y-3">
                    <p className="text-sm text-muted-foreground">{t("assignmentCreator:generation.manualTab.description")}</p>
                    <Button variant="outline" onClick={addManualQuestion}><Plus className="h-4 w-4 mr-2" />{t("assignmentCreator:generation.manualTab.addQuestion")}</Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* ─── Assignment Preview ─── */}
            {showPreview && questions.length > 0 && (
              <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 animate-in fade-in slide-in-from-top-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-emerald-600" />
                      {t("assignmentCreator:preview.cardTitle")}
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300">{t("assignmentCreator:preview.pendingApproval")}</Badge>
                  </div>
                  <CardDescription>This is what students will see after you approve and send.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-background p-4 space-y-2">
                    <h3 className="font-bold text-lg">{title || t("assignmentCreator:preview.untitled")}</h3>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSubject && <Badge variant="outline">{selectedSubject.code} — {selectedSubject.name}</Badge>}
                      {selectedClassroom && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"><Users className="h-3 w-3 mr-1" />{selectedClassroom.name}</Badge>}
                      {dueDate && <Badge variant="outline">Due: {new Date(dueDate).toLocaleString()}</Badge>}
                      <Badge variant="secondary">{questions.length} Questions • {totalMarks} Marks</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={i} className="rounded-lg border bg-background p-3 flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">Q{q.question_number}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{q.marks} marks</Badge>
                            {q.co_code && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{q.co_code}</Badge>}
                            <Badge variant="outline" className="text-[10px] capitalize">{q.difficulty}</Badge>
                          </div>
                          <p className="text-sm">{q.question_text || <span className="text-muted-foreground italic">{t("assignmentCreator:questions.noText")}</span>}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowPreview(false)}>
                      {t("assignmentCreator:preview.editQuestions")}
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      disabled={!canCreate}
                      onClick={() => createMutation.mutate("published")}
                    >
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t("assignmentCreator:preview.approveAndSend")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Questions Editor ─── */}
            {questions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Questions ({questions.length}) — {totalMarks} marks</CardTitle>
                    <div className="flex items-center gap-2">
                      <input
                        ref={solutionFileRef}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSolutionPdfUpload(f); }}
                      />
                      <Button variant="outline" size="sm" onClick={() => solutionFileRef.current?.click()} disabled={bulkSolutionUploading}>
                        {bulkSolutionUploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Extracting...</> : <><FileCheck className="h-3.5 w-3.5 mr-1.5" />Upload Solution PDF</>}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {questions.map((q, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">Q{q.question_number}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{q.marks} marks</Badge>
                          {q.co_code && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{q.co_code}</Badge>}
                          <Badge variant="outline" className="text-[10px] capitalize">{q.difficulty}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <Textarea value={q.question_text} onChange={(e) => updateQuestion(idx, "question_text", e.target.value)} rows={2} className="text-sm" placeholder="Enter question text..." />
                      <div className="flex gap-2">
                        <Input type="number" min={1} className="w-20" value={q.marks} onChange={(e) => updateQuestion(idx, "marks", Number(e.target.value))} />
                        <Select value={q.difficulty} onValueChange={(v) => updateQuestion(idx, "difficulty", v)}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <button type="button" onClick={() => toggleSolutionExpand(idx)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-1">
                        {expandedSolutions[idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <FileCheck className="h-3 w-3" />
                        Model Answer &amp; Rubric
                        {(q.solution_text || q.rubric) && <Badge variant="secondary" className="text-[9px] ml-1 py-0">filled</Badge>}
                      </button>
                      {expandedSolutions[idx] && (
                        <div className="space-y-2 rounded-md bg-muted/30 border p-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Model Answer</Label>
                            <Textarea value={q.solution_text || ""} onChange={(e) => updateQuestion(idx, "solution_text", e.target.value)} rows={3} className="text-sm" placeholder="Expected correct answer..." />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rubric / Marking Criteria</Label>
                            <Textarea value={q.rubric || ""} onChange={(e) => updateQuestion(idx, "rubric", e.target.value)} rows={2} className="text-sm" placeholder="e.g. 2 marks for definition, 3 for example..." />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}