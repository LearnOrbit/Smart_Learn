import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
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
  Eye, CheckCircle2, AlertCircle,
} from "lucide-react";

interface COItem { id: string; code: string; description: string }
interface LOItem { id: string; code: string; description: string; course_outcome_id: string | null }
interface SubjectItem { id: string; code: string; name: string }
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
  const queryClient = useQueryClient();

  // ─── Assignment details ───
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subjectId, setSubjectId] = useState("none");
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

  // ─── Group LOs by parent CO ───
  const losByCO = courseOutcomes.map(co => ({
    co,
    los: learningOutcomes.filter(lo => lo.course_outcome_id === co.id),
  })).filter(g => g.los.length > 0);
  const ungroupedLOs = learningOutcomes.filter(lo => !lo.course_outcome_id);

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
      toast({ title: `${data.questions.length} questions generated!`, description: "Review them below, then approve to send to students." });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
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
      toast({ title: `${data.questions.length} questions generated!`, description: "Review and approve to send to students." });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
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

  // ─── Create assignment (with status) ───
  const createMutation = useMutation({
    mutationFn: async (status: AssignmentStatus) => {
      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const { data, error } = await apiClient.post("/assignments", {
        title,
        description,
        due_date: dueDate || null,
        subject_id: subjectId === "none" ? null : subjectId,
        total_marks: totalMarks || null,
        generation_method: generationMethod,
        learning_outcome_ids: selectedLOs,
        // status field omitted — backend determines visibility; "published" = send now
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
    setTitle(""); setDescription(""); setDueDate(""); setSubjectId("none");
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Create Assignment</h2>
          <p className="text-muted-foreground text-sm mt-1">Generate questions from COs or syllabus, review, then send to students</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ── Left: Details ── */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Assignment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Structures Quiz 1" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for students..." rows={2} />
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ─── LO Selector — grouped by CO ─── */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> Learning Outcomes
                  </Label>
                  {learningOutcomes.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">No LOs defined yet. Add them on the Outcomes page first.</div>
                  ) : (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {losByCO.map(({ co, los }) => (
                        <div key={co.id}>
                          <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                            <BookMarked className="h-3 w-3" /> {co.code} — {co.description}
                          </p>
                          <div className="space-y-1 pl-2 border-l-2 border-violet-200 dark:border-violet-800">
                            {los.map(lo => (
                              <button
                                key={lo.id}
                                type="button"
                                onClick={() => toggleLO(lo.id)}
                                className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all border ${
                                  selectedLOs.includes(lo.id)
                                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300"
                                    : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className="font-bold mr-1.5">{lo.code}</span>
                                {lo.description}
                                {selectedLOs.includes(lo.id) && (
                                  <CheckCircle2 className="h-3 w-3 inline ml-1.5 text-amber-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {ungroupedLOs.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Unlinked LOs</p>
                          <div className="space-y-1">
                            {ungroupedLOs.map(lo => (
                              <button
                                key={lo.id}
                                type="button"
                                onClick={() => toggleLO(lo.id)}
                                className={`w-full text-left rounded-lg px-2.5 py-2 text-xs border transition-all ${
                                  selectedLOs.includes(lo.id)
                                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300"
                                    : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className="font-bold mr-1.5">{lo.code}</span>{lo.description}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedLOs.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{selectedLOs.length} LO{selectedLOs.length > 1 ? "s" : ""} selected</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary card */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-bold text-primary">{questions.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Marks</span>
                  <span className="font-bold text-primary">{totalMarks}</span>
                </div>
                {selectedLOs.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">LOs linked</span>
                    <span className="font-bold text-primary">{selectedLOs.length}</span>
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
                    {showPreview ? "Hide Preview" : "Preview Assignment"}
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
                    Save Draft
                  </Button>
                  <Button
                    disabled={!canCreate}
                    onClick={() => createMutation.mutate("published")}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send to Students
                  </Button>
                </div>
                {!title.trim() && <p className="text-[11px] text-muted-foreground text-center">Add a title to enable submission</p>}
                {questions.length === 0 && <p className="text-[11px] text-muted-foreground text-center">Generate or add questions first</p>}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Generation + Questions ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Generation card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Question Generation</CardTitle>
                <CardDescription>Choose how to generate questions</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="co" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="co"><GraduationCap className="h-3.5 w-3.5 mr-1.5" />CO-Based</TabsTrigger>
                    <TabsTrigger value="syllabus"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Syllabus</TabsTrigger>
                    <TabsTrigger value="manual"><FileText className="h-3.5 w-3.5 mr-1.5" />Manual</TabsTrigger>
                  </TabsList>

                  {/* CO-Based */}
                  <TabsContent value="co" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Course Outcomes</Label>
                      {courseOutcomes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No COs defined. Add them on the Outcomes page first.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {courseOutcomes.map((co) => (
                            <button key={co.id} type="button" onClick={() => toggleCO(co.id)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                                selectedCOs.includes(co.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"
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
                      <div className="space-y-1"><Label className="text-xs">Questions</Label><Input type="number" min={1} max={30} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Marks/Q</Label><Input type="number" min={1} value={marksPerQ} onChange={(e) => setMarksPerQ(Number(e.target.value))} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => genCOMutation.mutate()} disabled={selectedCOs.length === 0 || genCOMutation.isPending} className="w-full">
                      {genCOMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate from COs</>}
                    </Button>
                  </TabsContent>

                  {/* Syllabus-Based */}
                  <TabsContent value="syllabus" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload PDF / Image of Syllabus</Label>
                      <div className="flex gap-2">
                        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={extracting}>
                          {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</> : <><Upload className="h-4 w-4 mr-2" />Upload File</>}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Syllabus Text</Label>
                      <Textarea value={syllabusText} onChange={(e) => setSyllabusText(e.target.value)} rows={4} placeholder="Paste syllabus or upload file above..." />
                    </div>
                    <div className="grid gap-3 grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">Questions</Label><Input type="number" min={1} max={30} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Marks/Q</Label><Input type="number" min={1} value={marksPerQ} onChange={(e) => setMarksPerQ(Number(e.target.value))} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={() => genSyllabusMutation.mutate()} disabled={!syllabusText.trim() || genSyllabusMutation.isPending} className="w-full">
                      {genSyllabusMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate from Syllabus</>}
                    </Button>
                  </TabsContent>

                  {/* Manual */}
                  <TabsContent value="manual" className="space-y-3">
                    <p className="text-sm text-muted-foreground">Add questions one by one and fill in the details manually.</p>
                    <Button variant="outline" onClick={addManualQuestion}><Plus className="h-4 w-4 mr-2" />Add Question</Button>
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
                      Assignment Preview
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300">Pending Approval</Badge>
                  </div>
                  <CardDescription>This is what students will see after you approve and send.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-background p-4 space-y-2">
                    <h3 className="font-bold text-lg">{title || "Untitled Assignment"}</h3>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSubject && <Badge variant="outline">{selectedSubject.code} — {selectedSubject.name}</Badge>}
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
                          <p className="text-sm">{q.question_text || <span className="text-muted-foreground italic">No question text</span>}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowPreview(false)}>
                      Edit Questions
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      disabled={!canCreate}
                      onClick={() => createMutation.mutate("published")}
                    >
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Approve &amp; Send to Students
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
