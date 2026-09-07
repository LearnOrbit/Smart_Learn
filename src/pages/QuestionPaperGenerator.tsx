import { useState } from "react";
import { useEffect } from "react";
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
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import {
  Sparkles, Download, Printer, Plus, Trash2, ClipboardList,
  BookMarked, Target, AlertCircle, Loader2, GraduationCap, FileText, Database, PlusCircle,
} from "lucide-react";
import { aiService, AIQuestionRow, AIMCQRow } from "@/services/aiService";

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

/* ─── Question Bank picker (from AI Assessment Generator) ── */
function QuestionBankPicker({
  onAdd,
}: { onAdd: (q: GeneratedQuestion) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const [tab, setTab] = useState<"qa" | "mcq">("qa");

  useEffect(() => { void loadPageNamespace("questionPaper"); }, []);

  const { data: qaList, isLoading: qaLoading } = useQuery<AIQuestionRow[]>({
    queryKey: ["ai-questions"],
    queryFn: async () => {
      const { data, error } = await aiService.listAIQuestions();
      if (error) throw error;
      return (data?.questions || []) as AIQuestionRow[];
    },
  });
  const { data: mcqList, isLoading: mcqLoading } = useQuery<AIMCQRow[]>({
    queryKey: ["ai-mcqs"],
    queryFn: async () => {
      const { data, error } = await aiService.listMCQs();
      if (error) throw error;
      return (data?.mcqs || []) as AIMCQRow[];
    },
  });

  const isLoading = tab === "qa" ? qaLoading : mcqLoading;
  const list = tab === "qa" ? (qaList || []) : (mcqList || []);

  const addQA = (row: AIQuestionRow) => {
    onAdd({
      question_number: Date.now() + Math.floor(Math.random() * 1000),
      question_text: row.question_text,
      marks: row.marks,
      co_code: row.course_outcome_code || null,
      difficulty: row.difficulty,
    });
    toast({ title: t("questionPaper:bank.addedToPaper") });
  };
  const addMCQ = (row: AIMCQRow) => {
    const text = `${row.question_text}\n  A) ${row.option_a}\n  B) ${row.option_b}\n  C) ${row.option_c}\n  D) ${row.option_d}\n  (Answer: ${row.correct_answer})`;
    onAdd({
      question_number: Date.now() + Math.floor(Math.random() * 1000),
      question_text: text,
      marks: row.marks,
      co_code: row.course_outcome_code || null,
      difficulty: row.difficulty,
    });
    toast({ title: t("questionPaper:bank.addedToPaper") });
  };

  return (
    <Card className="no-print">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          {t("questionPaper:bank.title")}
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            {t("questionPaper:bank.subtitle")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={tab === "qa" ? "default" : "outline"}
            onClick={() => setTab("qa")}
          >
            Q&amp;A ({qaList?.length || 0})
          </Button>
          <Button
            size="sm"
            variant={tab === "mcq" ? "default" : "outline"}
            onClick={() => setTab("mcq")}
          >
            MCQ ({mcqList?.length || 0})
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("questionPaper:bank.loading")}</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            {tab === "qa" ? t("questionPaper:bank.noQa") : t("questionPaper:bank.noMcq")}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {list.map((row: any) => (
              <div
                key={row.id}
                className="flex items-start gap-2 p-2 rounded-md border border-border/60 hover:bg-muted/30 transition-colors"
              >
                <p className="text-xs flex-1 line-clamp-2 leading-relaxed">
                  {row.question_text}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={`text-[10px] capitalize ${DIFF_COLOR[row.difficulty] || ""}`}>
                    {row.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{row.marks}m</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => (tab === "qa" ? addQA(row) : addMCQ(row))}
                    title="Add to paper"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Component ─────────────────────────────────────────────── */
export default function QuestionPaperGenerator() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");

  useEffect(() => { void loadPageNamespace("questionPaper"); }, []);

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
      toast({ title: t("questionPaper:toasts.selectCo"), variant: "destructive" });
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
      toast({ title: t("questionPaper:toasts.paperGenerated", { count: questions.length, marks: totalMarks }) });
    } catch (e: unknown) {
      toast({ title: t("questionPaper:toasts.generationFailed"), description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Print / Download ── */
  const handlePrint = () => window.print();

  /* ─── Add a bank question to the current paper ── */
  const addToPaper = (q: GeneratedQuestion) => {
    setPaper(prev => {
      const base = prev || [];
      // renumber to keep them sequential
      const next: GeneratedQuestion = { ...q, question_number: base.length + 1 };
      return [...base, next];
    });
  };

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
              {t("questionPaper:title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("questionPaper:description")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5 no-print">
          {/* ══ LEFT — Configuration ══ */}
          <div className="lg:col-span-2 space-y-4">
            {/* Paper meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> {t("questionPaper:paperDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("questionPaper:examTitle")}</Label>
                  <Input
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    placeholder={t("questionPaper:examTitlePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("questionPaper:subject")}</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger><SelectValue placeholder={t("questionPaper:subjectPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("questionPaper:duration")}</Label>
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
                    <p className="text-xs text-muted-foreground">{t("questionPaper:totalQuestions")}</p>
                  </div>
                  <div className="rounded-lg bg-background border p-3">
                    <p className="text-xl font-bold text-primary">{totalMarks}</p>
                    <p className="text-xs text-muted-foreground">{t("questionPaper:totalMarks")}</p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4 gap-2"
                  onClick={handleGenerate}
                  disabled={generating || sections.every(s => !s.co_id)}
                >
                  {generating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("questionPaper:generating")}</>
                    : <><Sparkles className="h-4 w-4" /> {t("questionPaper:generatePaper")}</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ══ RIGHT — Sections ══ */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookMarked className="h-4 w-4" /> {t("questionPaper:sections")}
              </h2>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="h-4 w-4 mr-1" /> {t("questionPaper:addSection")}
              </Button>
            </div>

            {sections.map((sec, idx) => (
              <Card key={idx}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-semibold">{t("questionPaper:sectionLabel", { n: idx + 1 })}</Badge>
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
                      <Label className="text-xs">{t("questionPaper:courseOutcome")}</Label>
                      <Select value={sec.co_id} onValueChange={v => updateSection(idx, "co_id", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t("questionPaper:selectCoPlaceholder")} />
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
                      <Label className="text-xs">{t("questionPaper:numQuestions")}</Label>
                      <Input
                        type="number" min={1} max={20} className="h-8 text-sm"
                        value={sec.count}
                        onChange={e => updateSection(idx, "count", Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">{t("questionPaper:marksPerQuestion")}</Label>
                      <Input
                        type="number" min={1} className="h-8 text-sm"
                        value={sec.marks_per_q}
                        onChange={e => updateSection(idx, "marks_per_q", Number(e.target.value))}
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">{t("questionPaper:difficulty")}</Label>
                      <Select value={sec.difficulty} onValueChange={v => updateSection(idx, "difficulty", v as Section["difficulty"])}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">{t("questionPaper:difficulty_easy")}</SelectItem>
                          <SelectItem value="medium">{t("questionPaper:difficulty_medium")}</SelectItem>
                          <SelectItem value="hard">{t("questionPaper:difficulty_hard")}</SelectItem>
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
                    {t("questionPaper:noCoWarning")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ══ Question Bank (from AI Generator) ══ */}
        <div className="no-print">
          <QuestionBankPicker onAdd={addToPaper} />
        </div>

        {/* ════════════════════════════════════════════
            GENERATED PAPER (printable)
        ════════════════════════════════════════════ */}
        {paper && (
          <div id="question-paper" className="print-paper">
            {/* Print actions */}
            <div className="flex gap-3 mb-6 no-print">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> {t("questionPaper:print.printPdf")}
              </Button>
              <Button variant="ghost" onClick={() => setPaper(null)} className="gap-2">
                <Trash2 className="h-4 w-4" /> {t("questionPaper:print.clear")}
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-primary text-primary-foreground p-6 text-center space-y-1">
                <p className="text-xs uppercase tracking-widest opacity-80">{t("questionPaper:print.headerLabel")}</p>
                <h2 className="text-2xl font-bold">{examTitle || t("questionPaper:print.examTitleFallback")}</h2>
                {subject && <p className="text-sm opacity-90">{subject.code} — {subject.name}</p>}
                <div className="flex items-center justify-center gap-6 mt-3 text-sm">
                  <span>{Number(duration) > 1 ? t("questionPaper:print.durationPlural", { hours: duration }) : t("questionPaper:print.duration", { hours: duration })}</span>
                  <span>{t("questionPaper:print.totalMarksLabel", { marks: totalMarks })}</span>
                  <span>{t("questionPaper:print.questions", { count: paper.length })}</span>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-muted/40 border-b px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("questionPaper:print.instructions")}
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
                          {t("questionPaper:print.sectionHeading", { letter: String.fromCharCode(65 + sIdx) })}
                          <span className="font-normal text-sm text-muted-foreground ml-2">
                            {t("questionPaper:print.sectionMeta", { count: sec.count, marks: sec.marks_per_q })}
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
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-xs text-muted-foreground">{t("questionPaper:print.marksInline", { marks: q.marks })}</span>
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

                {/* Bank-added questions (anything not covered by the configured sections) */}
                {(() => {
                  const sectionedCount = sections
                    .filter(s => s.co_id)
                    .reduce((sum, s) => sum + s.count, 0);
                  const bankQs = paper.slice(sectionedCount);
                  if (bankQs.length === 0) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b">
                        <h3 className="font-bold text-base">
                          {t("questionPaper:print.fromBank")}
                          <span className="font-normal text-sm text-muted-foreground ml-2">
                            {t("questionPaper:print.fromBankMeta", { count: bankQs.length })}
                          </span>
                        </h3>
                        <Badge variant="secondary" className="text-xs">{t("questionPaper:print.savedViaAi")}</Badge>
                      </div>
                      <div className="space-y-4">
                        {bankQs.map((q, qIdx) => (
                          <div key={q.question_number} className="flex gap-3">
                            <span className="font-bold text-sm shrink-0 w-6">{sectionedCount + qIdx + 1}.</span>
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-xs text-muted-foreground">{t("questionPaper:print.marksInline", { marks: q.marks })}</span>
                                {q.co_code && (
                                  <span className="text-xs text-muted-foreground/60">[{q.co_code}]</span>
                                )}
                                {q.difficulty && (
                                  <Badge variant="outline" className={`text-[10px] capitalize ${DIFF_COLOR[q.difficulty] || ""}`}>{q.difficulty}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="border-t px-6 py-3 bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">
                  {t("questionPaper:print.footer")} &nbsp;|&nbsp; {t("questionPaper:print.coDistribution", { list: sections.filter(s => s.co_id).map((s, i) => {
                    const co = cos.find(c => c.id === s.co_id);
                    return co ? `${co.code} (${s.count * s.marks_per_q}m)` : "";
                  }).join(", ") })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
