import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Download, Printer, Plus, Trash2, ClipboardList,
  BookMarked, Target, AlertCircle, Loader2, GraduationCap, FileText,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface CO { id: string; code: string; description: string }
interface Subject { id: string; code: string; name: string }
interface GeneratedQuestion {
  question_number: number;
  question_text: string;
  marks: number;
  co_code: string | null;
  difficulty: string;
}
interface Section {
  co_id: string;
  count: number;
  marks_per_q: number;
  difficulty: "easy" | "medium" | "hard";
}

const DIFF_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800 border-emerald-300",
  medium: "bg-blue-100 text-blue-800 border-blue-300",
  hard: "bg-red-100 text-red-800 border-red-300",
};

/* ─── Component ─────────────────────────────────────────────── */
export default function QuestionPaperGenerator() {
  const { toast } = useToast();

  const [subjectId, setSubjectId] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [duration, setDuration] = useState("3");
  const [sections, setSections] = useState<Section[]>([
    { co_id: "", count: 5, marks_per_q: 2, difficulty: "easy" },
    { co_id: "", count: 3, marks_per_q: 5, difficulty: "medium" },
    { co_id: "", count: 2, marks_per_q: 10, difficulty: "hard" },
  ]);
  const [paper, setPaper] = useState<GeneratedQuestion[] | null>(null);
  const [generating, setGenerating] = useState(false);

  /* ─── Queries ── */
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => { const { data, error } = await apiClient.get("/subjects"); if (error) throw error; return data; },
  });
  const { data: cos = [] } = useQuery<CO[]>({
    queryKey: ["course-outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/course-outcomes"); if (error) throw error; return data; },
  });

  /* ─── Helpers ── */
  const updateSection = (idx: number, field: keyof Section, value: string | number) =>
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  const addSection = () =>
    setSections(prev => [...prev, { co_id: "", count: 2, marks_per_q: 5, difficulty: "medium" }]);

  const removeSection = (idx: number) =>
    setSections(prev => prev.filter((_, i) => i !== idx));

  const totalMarks = sections.reduce((sum, s) => sum + s.count * s.marks_per_q, 0);
  const totalQuestions = sections.reduce((sum, s) => sum + s.count, 0);

  /* ─── Generate ── */
  const handleGenerate = async () => {
    const validSections = sections.filter(s => s.co_id && s.count > 0);
    if (validSections.length === 0) {
      toast({ title: "Select at least one CO for each section", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setPaper(null);
    try {
      // Try the dedicated question-paper endpoint first, fall back to co-based
      const payload = {
        co_ids: validSections.map(s => s.co_id),
        num_questions: validSections.reduce((s, sec) => s + sec.count, 0),
        difficulty: "mixed",
        marks_per_question: Math.round(totalMarks / totalQuestions),
        sections: validSections.map(s => ({
          co_id: s.co_id,
          count: s.count,
          marks_per_question: s.marks_per_q,
          difficulty: s.difficulty,
        })),
      };
      const { data, error } = await apiClient.post("/generate-questions/co-based", payload);
      if (error) throw error;
      // Enrich each question with section difficulty
      const questions: GeneratedQuestion[] = (data.questions || []).map((q: GeneratedQuestion, idx: number) => {
        let cumCount = 0;
        for (const sec of validSections) {
          cumCount += sec.count;
          if (idx < cumCount) {
            return { ...q, marks: sec.marks_per_q, difficulty: sec.difficulty };
          }
        }
        return q;
      });
      setPaper(questions);
      toast({ title: `Paper generated — ${questions.length} questions, ${totalMarks} marks` });
    } catch (e: unknown) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Print / Download ── */
  const handlePrint = () => window.print();

  const subject = subjects.find(s => s.id === subjectId);

  return (
    <DashboardLayout>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-paper { background: white !important; color: black !important; padding: 0 !important; }
          body { background: white; }
        }
      `}</style>

      <div className="space-y-6 max-w-5xl">
        {/* ── Header ── */}
        <div className="no-print">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Question Paper Generator
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Define sections by CO and difficulty — AI generates a balanced, printable question paper.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5 no-print">
          {/* ══ LEFT — Configuration ══ */}
          <div className="lg:col-span-2 space-y-4">
            {/* Paper meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Paper Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Exam Title</Label>
                  <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    placeholder="e.g. Mid-Semester Examination"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (hours)</Label>
                  <Input type="number" min={1} max={6} value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-background border p-3">
                    <p className="text-xl font-bold text-primary">{totalQuestions}</p>
                    <p className="text-xs text-muted-foreground">Total Questions</p>
                  </div>
                  <div className="rounded-lg bg-background border p-3">
                    <p className="text-xl font-bold text-primary">{totalMarks}</p>
                    <p className="text-xs text-muted-foreground">Total Marks</p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4 gap-2"
                  onClick={handleGenerate}
                  disabled={generating || sections.every(s => !s.co_id)}
                >
                  {generating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    : <><Sparkles className="h-4 w-4" /> Generate Paper</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ══ RIGHT — Sections ══ */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookMarked className="h-4 w-4" /> Sections
              </h2>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="h-4 w-4 mr-1" /> Add Section
              </Button>
            </div>

            {sections.map((sec, idx) => (
              <Card key={idx}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-semibold">Section {idx + 1}</Badge>
                    <div className="flex items-center gap-2">
                      <Badge className={`${DIFF_COLOR[sec.difficulty]} text-xs border capitalize`}>{sec.difficulty}</Badge>
                      <span className="text-xs text-muted-foreground">{sec.count} × {sec.marks_per_q}m = {sec.count * sec.marks_per_q}m</span>
                      {sections.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSection(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* CO Select */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Course Outcome</Label>
                      <Select value={sec.co_id} onValueChange={v => updateSection(idx, "co_id", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select CO..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cos.map(co => (
                            <SelectItem key={co.id} value={co.id}>
                              <span className="font-semibold">{co.code}</span>
                              <span className="ml-2 text-muted-foreground text-xs truncate">{co.description?.slice(0, 50)}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs"># Questions</Label>
                      <Input
                        type="number" min={1} max={20} className="h-8 text-sm"
                        value={sec.count}
                        onChange={e => updateSection(idx, "count", Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Marks / Question</Label>
                      <Input
                        type="number" min={1} className="h-8 text-sm"
                        value={sec.marks_per_q}
                        onChange={e => updateSection(idx, "marks_per_q", Number(e.target.value))}
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Difficulty</Label>
                      <Select value={sec.difficulty} onValueChange={v => updateSection(idx, "difficulty", v as Section["difficulty"])}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy — Bloom's L1/L2 (Recall & Understand)</SelectItem>
                          <SelectItem value="medium">Medium — Bloom's L3/L4 (Apply & Analyze)</SelectItem>
                          <SelectItem value="hard">Hard — Bloom's L5/L6 (Evaluate & Create)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {cos.length === 0 && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-4 flex gap-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-amber-800 dark:text-amber-200">
                    No Course Outcomes found. Create COs in <strong>Outcomes Manager</strong> first.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            GENERATED PAPER (printable)
        ════════════════════════════════════════════ */}
        {paper && (
          <div id="question-paper" className="print-paper">
            {/* Print actions */}
            <div className="flex gap-3 mb-6 no-print">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Print / Save PDF
              </Button>
              <Button variant="ghost" onClick={() => setPaper(null)} className="gap-2">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-primary text-primary-foreground p-6 text-center space-y-1">
                <p className="text-xs uppercase tracking-widest opacity-80">Question Paper</p>
                <h2 className="text-2xl font-bold">{examTitle || "Examination"}</h2>
                {subject && <p className="text-sm opacity-90">{subject.code} — {subject.name}</p>}
                <div className="flex items-center justify-center gap-6 mt-3 text-sm">
                  <span>Duration: <strong>{duration} hr{Number(duration) > 1 ? "s" : ""}</strong></span>
                  <span>Total Marks: <strong>{totalMarks}</strong></span>
                  <span>Questions: <strong>{paper.length}</strong></span>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-muted/40 border-b px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Instructions:</strong> Attempt all questions. Write clearly. Marks for each question are indicated in brackets.
                  CO coverage is noted alongside each question.
                </p>
              </div>

              {/* Questions grouped by section */}
              <div className="p-6 space-y-6 bg-background">
                {sections.filter(s => s.co_id).map((sec, sIdx) => {
                  const secCO = cos.find(c => c.id === sec.co_id);
                  const start = sections.slice(0, sIdx).reduce((sum, s) => sum + (s.co_id ? s.count : 0), 0);
                  const sectionQs = paper.slice(start, start + sec.count);

                  return (
                    <div key={sIdx}>
                      {/* Section heading */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b">
                        <h3 className="font-bold text-base">
                          Section {String.fromCharCode(65 + sIdx)}
                          <span className="font-normal text-sm text-muted-foreground ml-2">
                            ({sec.count} questions × {sec.marks_per_q} marks)
                          </span>
                        </h3>
                        <div className="flex gap-2">
                          <Badge variant="outline" className={`${DIFF_COLOR[sec.difficulty]} text-xs capitalize`}>{sec.difficulty}</Badge>
                          {secCO && <Badge variant="secondary" className="text-xs">{secCO.code}</Badge>}
                        </div>
                      </div>

                      {/* Questions in section */}
                      <div className="space-y-4">
                        {sectionQs.map((q, qIdx) => (
                          <div key={q.question_number} className="flex gap-3">
                            <span className="font-bold text-sm shrink-0 w-6">{start + qIdx + 1}.</span>
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed">{q.question_text}</p>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-xs text-muted-foreground">[{q.marks} marks]</span>
                                {q.co_code && (
                                  <span className="text-xs text-muted-foreground/60">[{q.co_code}]</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t px-6 py-3 bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">
                  — End of Question Paper — &nbsp;|&nbsp; CO Distribution: {sections.filter(s => s.co_id).map((s, i) => {
                    const co = cos.find(c => c.id === s.co_id);
                    return co ? `${co.code} (${s.count * s.marks_per_q}m)` : "";
                  }).join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
