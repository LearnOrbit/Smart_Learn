/**
 * AIAssessmentGenerator.tsx
 * ─────────────────────────
 * The /ai-generator route. Teacher-only. Three tabs:
 *   1. Question & Answer
 *   2. MCQ
 *   3. Quiz
 *
 * All generation goes through `aiService`, which talks to the
 * FastAPI backend. The OpenAI key is server-side only — the
 * browser never sees it.
 *
 * The page is built on the existing design system:
 *   - `PageHeader` / `Card` / `Button` / `Input` / `Textarea` / `Select`
 *   - Radix `Tabs` (already used elsewhere)
 *   - Radix `Dialog` for the regenerate prompt
 *   - Framer Motion `motion.div` for the card stagger
 *   - `EmptyState` / `LoadingSkeleton` for the standard no-data states
 *   - `useToast` for friendly error/success notifications
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Sparkles, FileQuestion, ListChecks, Wand2, Save, Trash2,
  Pencil, RefreshCw, Check, X, FileUp, Lightbulb, Plus, BookOpen,
  ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/integrations/api/client";
import {
  aiService,
  GeneratedMCQ, GeneratedQA, AIMCQRow, AIQuestionRow, QuizRow,
  DifficultyLevel, SourceType,
} from "@/services/aiService";

// ─── small constants ───────────────────────────────────────────────────────

const DIFFICULTIES: DifficultyLevel[] = ["easy", "medium", "hard"];
const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
// Source options — labels/descriptions come from i18n (see SourcePicker).
const SOURCES: { value: SourceType; labelKey: string; descKey: string }[] = [
  { value: "topic", labelKey: "aiGenerator:source.topicLabel", descKey: "aiGenerator:source.topicDesc" },
  { value: "syllabus", labelKey: "aiGenerator:source.syllabusLabel", descKey: "aiGenerator:source.syllabusDesc" },
  { value: "document", labelKey: "aiGenerator:source.documentLabel", descKey: "aiGenerator:source.documentDesc" },
];

// ─── shared form controls ──────────────────────────────────────────────────

interface Subject { id: string; name: string; code?: string }
interface CourseOutcome { id: string; code: string; description: string; subject_id?: string }

function useSubjects() {
  return useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await apiClient.get<any>("/subjects");
      if (error) throw error;
      // Backend may return {subjects: [...]} or [...] — handle both
      if (Array.isArray(data)) return data;
      if (data && Array.isArray((data as any).subjects)) return (data as any).subjects;
      return [];
    },
    staleTime: 60_000,
  });
}

function useCourseOutcomes() {
  return useQuery<CourseOutcome[]>({
    queryKey: ["course-outcomes"],
    queryFn: async () => {
      const { data, error } = await apiClient.get<any>("/course-outcomes");
      if (error) throw error;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray((data as any).outcomes)) return (data as any).outcomes;
      return [];
    },
    staleTime: 60_000,
  });
}

function useAuthReady() {
  const { user, role, loading } = useAuth();
  return { user, role, loading, isTeacher: role === "teacher" };
}

// ─── SourcePicker (shared by Q&A and MCQ tabs) ────────────────────────────

function SourcePicker({
  value, onChange,
}: { value: SourceType; onChange: (v: SourceType) => void }) {
  const { t } = useTranslation("pages");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {SOURCES.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`text-left p-4 rounded-xl border transition-all ${
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <span className="font-semibold text-sm">{t(s.labelKey)}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t(s.descKey)}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── GenerationForm (shared by Q&A and MCQ tabs) ──────────────────────────

interface GenFormState {
  topic: string;
  subjectId: string;
  coId: string;
  difficulty: DifficultyLevel;
  marks: number;
  count: number;
  sourceType: SourceType;
  sourceText: string;
  file: File | null;
}

function GenerationForm({
  state, setState, submitting, onSubmit, kind,
}: {
  state: GenFormState;
  setState: (s: GenFormState) => void;
  submitting: boolean;
  onSubmit: () => void;
  kind: "qa" | "mcq";
}) {
  const { data: subjects = [] } = useSubjects();
  const { data: cos = [] } = useCourseOutcomes();

  const filteredCOs = useMemo(
    () => (state.subjectId ? cos.filter((c) => c.subject_id === state.subjectId) : cos),
    [cos, state.subjectId]
  );

  const { t } = useTranslation("pages");
  const update = <K extends keyof GenFormState>(k: K, v: GenFormState[K]) =>
    setState({ ...state, [k]: v });

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        {/* Source */}
        <div>
          <Label className="text-sm font-medium mb-2 block">{t("aiGenerator:form.generationSource")}</Label>
          <SourcePicker value={state.sourceType} onChange={(v) => update("sourceType", v)} />
        </div>

        {/* Topic */}
        <div>
          <Label htmlFor="topic" className="text-sm font-medium">{t("aiGenerator:form.topic")}</Label>
          <Input
            id="topic"
            value={state.topic}
            onChange={(e) => update("topic", e.target.value)}
            placeholder={t("aiGenerator:form.topicPlaceholder")}
            className="mt-1.5"
          />
        </div>

        {/* Subject + CO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.subjectLabel")}</Label>
            <Select value={state.subjectId} onValueChange={(v) => update("subjectId", v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("aiGenerator:form.subjectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.coLabel")}</Label>
            <Select value={state.coId} onValueChange={(v) => update("coId", v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("aiGenerator:form.coPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {filteredCOs.map((co) => (
                  <SelectItem key={co.id} value={co.id}>
                    {co.code} — {co.description?.slice(0, 50)}{co.description && co.description.length > 50 ? "…" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Difficulty / marks / count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.difficulty")}</Label>
            <Select value={state.difficulty} onValueChange={(v) => update("difficulty", v as DifficultyLevel)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{t(`aiGenerator:difficulty.${d}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.marksPerQ")}</Label>
            <Input
              type="number" min={1} max={100}
              value={state.marks}
              onChange={(e) => update("marks", Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.countLabel")}</Label>
            <Input
              type="number" min={1} max={20}
              value={state.count}
              onChange={(e) => update("count", Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Source text or file */}
        {state.sourceType === "syllabus" && (
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.studyMaterial")}</Label>
            <Textarea
              value={state.sourceText}
              onChange={(e) => update("sourceText", e.target.value)}
              placeholder={t("aiGenerator:form.studyMaterialPlaceholder")}
              className="mt-1.5 min-h-[140px]"
            />
          </div>
        )}
        {state.sourceType === "document" && (
          <div>
            <Label className="text-sm font-medium">{t("aiGenerator:form.documentLabel")}</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer hover:bg-muted/30 transition-colors">
                <FileUp className="h-4 w-4" />
                <span className="text-sm">
                  {state.file ? state.file.name : t("aiGenerator:form.chooseFile")}
                </span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.txt"
                  className="hidden"
                  onChange={(e) => update("file", e.target.files?.[0] || null)}
                />
              </label>
              {state.file && (
                <Button variant="ghost" size="sm" onClick={() => update("file", null)}>
                  <X className="h-3 w-3 mr-1" /> {t("aiGenerator:regenDialog.cancel")}
                </Button>
              )}
            </div>
            {state.sourceText && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("aiGenerator:form.extractedHint", { count: state.sourceText.length.toLocaleString() })}
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={onSubmit}
            disabled={submitting || !state.topic.trim()}
            className="gap-2 min-w-[160px]"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("aiGenerator:form.generating")}</>
            ) : (
              <><Wand2 className="h-4 w-4" /> {kind === "qa" ? t("aiGenerator:form.generateQA") : t("aiGenerator:form.generateMCQ")}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Regenerate dialog ────────────────────────────────────────────────────

function RegenerateDialog({
  open, onOpenChange, onSubmit, kind, previous, regenerating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (instruction: string) => void;
  kind: "qa" | "mcq";
  previous?: { question: string; [k: string]: any };
  regenerating: boolean;
}) {
  const { t } = useTranslation("pages");
  const [instruction, setInstruction] = useState("Make this harder.");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("aiGenerator:regenDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("aiGenerator:regenDialog.description")}
          </DialogDescription>
        </DialogHeader>
        {previous && (
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground line-clamp-3">
            <span className="font-semibold text-foreground">{t("aiGenerator:regenDialog.original")} </span>
            {previous.question}
          </div>
        )}
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={t("aiGenerator:regenDialog.placeholder")}
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("aiGenerator:regenDialog.cancel")}</Button>
          <Button onClick={() => onSubmit(instruction)} disabled={regenerating || !instruction.trim()}>
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t("aiGenerator:regenDialog.regenerate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Q&A result card ─────────────────────────────────────────────────────

function QACard({
  q, index, onSave, onDelete, onRegenerate, onEdit, saving, deleting,
}: {
  q: GeneratedQA;
  index: number;
  onSave: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const { t } = useTranslation("pages");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GeneratedQA>(q);
  useEffect(() => setDraft(q), [q]);
  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/30 bg-card p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <Badge variant="outline">{t("aiGenerator:qaCard.editingBadge", { index: index + 1 })}</Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              <X className="h-3 w-3 mr-1" /> {t("aiGenerator:qaCard.cancel")}
            </Button>
            <Button size="sm" onClick={() => { onEdit(); /* parent just calls setDraft */ }}>
              <Check className="h-3 w-3 mr-1" /> {t("aiGenerator:qaCard.done")}
            </Button>
          </div>
        </div>
        <Label className="text-xs">{t("aiGenerator:qaCard.questionLabel")}</Label>
        <Textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
        <Label className="text-xs">{t("aiGenerator:qaCard.answerLabel")}</Label>
        <Textarea value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">{t("aiGenerator:qaCard.difficultyLabel")}</Label>
            <Select value={draft.difficulty} onValueChange={(v) => setDraft({ ...draft, difficulty: v as DifficultyLevel })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{t(`aiGenerator:difficulty.${d}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("aiGenerator:qaCard.bloomLabel")}</Label>
            <Select value={draft.bloom_level || ""} onValueChange={(v) => setDraft({ ...draft, bloom_level: v as any })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t("aiGenerator:qaCard.bloomPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {BLOOM_LEVELS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("aiGenerator:qaCard.marksLabel")}</Label>
            <Input
              type="number" min={1} max={100}
              value={draft.marks}
              onChange={(e) => setDraft({ ...draft, marks: Number(e.target.value) || 1 })}
              className="mt-1"
            />
          </div>
        </div>
        <Button
          size="sm" onClick={() => onEdit()}
          className="w-full"
          variant="secondary"
        >
          {t("aiGenerator:qaCard.saveEdits")}
        </Button>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">Q{index + 1}</Badge>
          <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
          {q.bloom_level && <Badge variant="outline">{q.bloom_level}</Badge>}
          <Badge variant="outline">{q.marks} {q.marks === 1 ? "mark" : "marks"}</Badge>
          {q.course_outcome_code && <Badge variant="outline">{q.course_outcome_code}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title={t("aiGenerator:qaCard.editTitle")}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRegenerate} title={t("aiGenerator:qaCard.regenTitle")}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onSave} disabled={saving} title={t("aiGenerator:qaCard.saveTitle")}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting} title={t("aiGenerator:qaCard.deleteTitle")} className="text-rose-600 hover:text-rose-700">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <p className="text-sm leading-relaxed">{q.question}</p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">{t("aiGenerator:qaCard.showAnswer")}</summary>
        <p className="mt-2 pl-3 border-l-2 border-primary/30 whitespace-pre-wrap">{q.answer}</p>
      </details>
    </motion.div>
  );
}

// ─── MCQ result card ─────────────────────────────────────────────────────

function MCQCard({
  m, index, onSave, onDelete, onRegenerate, onEdit, saving, deleting, onAddToQuiz,
}: {
  m: GeneratedMCQ;
  index: number;
  onSave: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  saving: boolean;
  deleting: boolean;
  onAddToQuiz?: () => void;
}) {
  const { t } = useTranslation("pages");
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="font-mono">M{index + 1}</Badge>
          <Badge variant="outline" className="capitalize">{t(`aiGenerator:difficulty.${m.difficulty}`)}</Badge>
          {m.bloom_level && <Badge variant="outline">{m.bloom_level}</Badge>}
          <Badge variant="outline">{m.marks} {m.marks === 1 ? t("aiGenerator:mcqCard.mark_one") : t("aiGenerator:mcqCard.mark_other")}</Badge>
          {m.course_outcome_code && <Badge variant="outline">{m.course_outcome_code}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} title={t("aiGenerator:qaCard.editTitle")}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={onRegenerate} title={t("aiGenerator:qaCard.regenTitle")}><RefreshCw className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={onSave} disabled={saving} title={t("aiGenerator:qaCard.saveTitle")}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          {onAddToQuiz && (
            <Button size="sm" variant="ghost" onClick={onAddToQuiz} title={t("aiGenerator:mcqCard.addToQuizTitle")}>
              <ListChecks className="h-3 w-3" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting} title={t("aiGenerator:qaCard.deleteTitle")} className="text-rose-600 hover:text-rose-700">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <p className="text-sm font-medium leading-relaxed">{m.question}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {(["A", "B", "C", "D"] as const).map((letter) => {
          const text = m[`option_${letter.toLowerCase()}` as keyof GeneratedMCQ] as string;
          const isCorrect = m.correct_answer === letter;
          return (
            <div
              key={letter}
              className={`flex items-start gap-2 rounded-md p-2 ${
                isCorrect ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-muted/30"
              }`}
            >
              <span className="font-mono font-bold w-5 shrink-0">{letter}.</span>
              <span className="flex-1">{text}</span>
              {isCorrect && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
            </div>
          );
        })}
      </div>
      {m.explanation && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium hover:text-foreground">{t("aiGenerator:mcqCard.showExplanation")}</summary>
          <p className="mt-2 pl-3 border-l-2 border-primary/30 whitespace-pre-wrap">{m.explanation}</p>
        </details>
      )}
    </motion.div>
  );
}

// ─── Q&A tab ─────────────────────────────────────────────────────────────

function QATab() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const qc = useQueryClient();
  const [state, setState] = useState<GenFormState>({
    topic: "", subjectId: "", coId: "", difficulty: "medium", marks: 5, count: 5,
    sourceType: "topic", sourceText: "", file: null,
  });
  const [results, setResults] = useState<GeneratedQA[]>([]);
  const [regenFor, setRegenFor] = useState<{ index: number; previous: GeneratedQA } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const submit = async () => {
    if (!state.topic.trim()) {
      toast({ title: t("aiGenerator:toasts.pleaseEnterTopic"), variant: "destructive" });
      return;
    }
    let sourceText = state.sourceType === "syllabus" ? state.sourceText : undefined;
    if (state.sourceType === "document" && state.file) {
      const { data, error } = await aiService.extractSource(state.file);
      if (error) {
        toast({ title: t("aiGenerator:toasts.couldntReadFile"), description: error.message, variant: "destructive" });
        return;
      }
      sourceText = data?.text || "";
    }
    try {
      const { data, error } = await aiService.generateQA({
        topic: state.topic,
        co_id: state.coId || undefined,
        difficulty: state.difficulty,
        marks: state.marks,
        count: state.count,
        source_type: state.sourceType,
        source_text: sourceText,
        subject_id: state.subjectId || undefined,
      });
      if (error) throw error;
      setResults(data?.questions || []);
      toast({ title: t("aiGenerator:toasts.generatedQuestions", { count: data?.questions?.length || 0 }) });
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.generationFailed"), description: e?.message || t("aiGenerator:toasts.tryAgain"), variant: "destructive" });
    }
  };

  const save = async (q: GeneratedQA) => {
    setSavingIndex(results.indexOf(q));
    try {
      const { error } = await aiService.saveAIQuestion({
        question_text: q.question, answer: q.answer, marks: q.marks,
        difficulty: q.difficulty, bloom_level: q.bloom_level || null,
        course_outcome_code: q.course_outcome_code || null,
        source_type: (q.source_type || "topic") as SourceType,
        subject_id: state.subjectId || null, co_id: state.coId || null, topic: state.topic,
      });
      if (error) throw error;
      toast({ title: t("aiGenerator:toasts.savedToBank") });
      qc.invalidateQueries({ queryKey: ["ai-questions"] });
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.couldntSave"), description: e?.message, variant: "destructive" });
    } finally {
      setSavingIndex(null);
    }
  };

  const del = async (index: number) => {
    setDeletingIndex(index);
    setResults((r) => r.filter((_, i) => i !== index));
    setDeletingIndex(null);
  };

  const regen = async (instruction: string) => {
    if (!regenFor) return;
    setRegenerating(true);
    try {
      const { data, error } = await aiService.regenerate({
        kind: "qa",
        previous: regenFor.previous as any,
        instruction,
      });
      if (error) throw error;
      if (data?.question) {
        setResults((r) => r.map((q, i) => (i === regenFor.index ? data.question! : q)));
        toast({ title: t("aiGenerator:toasts.questionRegenerated") });
        setRegenFor(null);
      }
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.couldntRegenerate"), description: e?.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <GenerationForm
        state={state} setState={setState}
        submitting={false} onSubmit={submit} kind="qa"
      />

      {results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("aiGenerator:qaTab.resultsHeader", { count: results.length })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setResults([])}>
              {t("aiGenerator:qaTab.clear")}
            </Button>
          </div>
          <AnimatePresence>
            {results.map((q, i) => (
              <QACard
                key={i} q={q} index={i}
                onSave={() => save(q)}
                onDelete={() => del(i)}
                onRegenerate={() => setRegenFor({ index: i, previous: q })}
                onEdit={() => setResults((r) => r.map((x, idx) => (idx === i ? q : x)))}
                saving={savingIndex === i}
                deleting={deletingIndex === i}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-2">
            <EmptyState
              title={t("aiGenerator:qaTab.emptyTitle")}
              description={t("aiGenerator:qaTab.emptyDesc")}
              icon={<FileQuestion className="h-8 w-8" />}
            />
          </CardContent>
        </Card>
      )}

      {regenFor && (
        <RegenerateDialog
          open={!!regenFor}
          onOpenChange={(v) => !v && setRegenFor(null)}
          onSubmit={regen}
          kind="qa"
          previous={regenFor.previous as any}
          regenerating={regenerating}
        />
      )}
    </div>
  );
}

// ─── MCQ tab ─────────────────────────────────────────────────────────────

function MCQTab() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const qc = useQueryClient();
  const [state, setState] = useState<GenFormState>({
    topic: "", subjectId: "", coId: "", difficulty: "medium", marks: 1, count: 5,
    sourceType: "topic", sourceText: "", file: null,
  });
  const [results, setResults] = useState<GeneratedMCQ[]>([]);
  const [regenFor, setRegenFor] = useState<{ index: number; previous: GeneratedMCQ } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [addingToQuizId, setAddingToQuizId] = useState<string | null>(null);

  const submit = async () => {
    if (!state.topic.trim()) {
      toast({ title: t("aiGenerator:toasts.pleaseEnterTopic"), variant: "destructive" });
      return;
    }
    let sourceText = state.sourceType === "syllabus" ? state.sourceText : undefined;
    if (state.sourceType === "document" && state.file) {
      const { data, error } = await aiService.extractSource(state.file);
      if (error) {
        toast({ title: t("aiGenerator:toasts.couldntReadFile"), description: error.message, variant: "destructive" });
        return;
      }
      sourceText = data?.text || "";
    }
    try {
      const { data, error } = await aiService.generateMCQ({
        topic: state.topic,
        co_id: state.coId || undefined,
        difficulty: state.difficulty,
        marks: state.marks,
        count: state.count,
        source_type: state.sourceType,
        source_text: sourceText,
        subject_id: state.subjectId || undefined,
      });
      if (error) throw error;
      setResults(data?.mcqs || []);
      toast({ title: t("aiGenerator:toasts.generatedMcqs", { count: data?.mcqs?.length || 0 }) });
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.generationFailed"), description: e?.message || t("aiGenerator:toasts.tryAgain"), variant: "destructive" });
    }
  };

  const save = async (m: GeneratedMCQ) => {
    setSavingIndex(results.indexOf(m));
    try {
      const { error } = await aiService.saveMCQ({
        question_text: m.question,
        option_a: m.option_a, option_b: m.option_b, option_c: m.option_c, option_d: m.option_d,
        correct_answer: m.correct_answer, explanation: m.explanation || "",
        marks: m.marks, difficulty: m.difficulty, bloom_level: m.bloom_level || null,
        course_outcome_code: m.course_outcome_code || null,
        subject_id: state.subjectId || null, co_id: state.coId || null, topic: state.topic,
      });
      if (error) throw error;
      toast({ title: t("aiGenerator:toasts.savedToMcqBank") });
      qc.invalidateQueries({ queryKey: ["ai-mcqs"] });
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.couldntSave"), description: e?.message, variant: "destructive" });
    } finally {
      setSavingIndex(null);
    }
  };

  const addToQuiz = async (m: GeneratedMCQ) => {
    setAddingToQuizId("draft");
    try {
      const { data, error } = await aiService.saveMCQ({
        question_text: m.question,
        option_a: m.option_a, option_b: m.option_b, option_c: m.option_c, option_d: m.option_d,
        correct_answer: m.correct_answer, explanation: m.explanation || "",
        marks: m.marks, difficulty: m.difficulty, bloom_level: m.bloom_level || null,
        course_outcome_code: m.course_outcome_code || null,
        subject_id: state.subjectId || null, co_id: state.coId || null, topic: state.topic,
      });
      if (error) throw error;
      toast({
        title: t("aiGenerator:toasts.addedToMcqBank"),
        description: t("aiGenerator:toasts.openQuizHint"),
      });
      qc.invalidateQueries({ queryKey: ["ai-mcqs"] });
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.couldntSave"), description: e?.message, variant: "destructive" });
    } finally {
      setAddingToQuizId(null);
    }
  };

  const del = async (index: number) => {
    setDeletingIndex(index);
    setResults((r) => r.filter((_, i) => i !== index));
    setDeletingIndex(null);
  };

  const regen = async (instruction: string) => {
    if (!regenFor) return;
    setRegenerating(true);
    try {
      const { data, error } = await aiService.regenerate({
        kind: "mcq",
        previous: regenFor.previous as any,
        instruction,
      });
      if (error) throw error;
      if (data?.mcq) {
        setResults((r) => r.map((m, i) => (i === regenFor.index ? data.mcq! : m)));
        toast({ title: t("aiGenerator:toasts.mcqRegenerated") });
        setRegenFor(null);
      }
    } catch (e: any) {
      toast({ title: t("aiGenerator:toasts.couldntRegenerate"), description: e?.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <GenerationForm
        state={state} setState={setState}
        submitting={false} onSubmit={submit} kind="mcq"
      />

      {results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("aiGenerator:mcqTab.resultsHeader", { count: results.length })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setResults([])}>{t("aiGenerator:mcqTab.clear")}</Button>
          </div>
          <AnimatePresence>
            {results.map((m, i) => (
              <MCQCard
                key={i} m={m} index={i}
                onSave={() => save(m)}
                onDelete={() => del(i)}
                onRegenerate={() => setRegenFor({ index: i, previous: m })}
                onEdit={() => {/* inline edit not implemented for MCQ; use save with edits */}}
                onAddToQuiz={() => addToQuiz(m)}
                saving={savingIndex === i}
                deleting={deletingIndex === i}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-2">
            <EmptyState
              title={t("aiGenerator:mcqTab.emptyTitle")}
              description={t("aiGenerator:mcqTab.emptyDesc")}
              icon={<ListChecks className="h-8 w-8" />}
            />
          </CardContent>
        </Card>
      )}

      {regenFor && (
        <RegenerateDialog
          open={!!regenFor}
          onOpenChange={(v) => !v && setRegenFor(null)}
          onSubmit={regen}
          kind="mcq"
          previous={regenFor.previous as any}
          regenerating={regenerating}
        />
      )}
    </div>
  );
}

// ─── Quiz tab (no AI) ────────────────────────────────────────────────────

function QuizTab() {
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<QuizRow | null>(null);

  const { data: bank, isLoading: bankLoading } = useQuery({
    queryKey: ["ai-mcqs"],
    queryFn: async () => {
      const { data, error } = await aiService.listMCQs();
      if (error) throw error;
      return (data?.mcqs || []) as AIMCQRow[];
    },
  });

  const { data: quizList, isLoading: quizzesLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await aiService.listQuizzes();
      if (error) throw error;
      return (data?.quizzes || []) as QuizRow[];
    },
  });

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error(t("aiGenerator:toasts.quizTitleRequired"));
      if (selected.size === 0) throw new Error(t("aiGenerator:toasts.pickAtLeastOne"));
      const { data, error } = await aiService.createQuiz({
        title: title.trim(),
        description: description.trim(),
        mcq_ids: Array.from(selected),
      });
      if (error) throw error;
      return data as QuizRow;
    },
    onSuccess: (q) => {
      toast({ title: t("aiGenerator:toasts.quizCreated"), description: t("aiGenerator:toasts.quizCreatedDesc", { title: q.title }) });
      setPreview(q);
      setTitle(""); setDescription(""); setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (e: any) => {
      toast({ title: t("aiGenerator:toasts.couldntCreateQuiz"), description: e?.message, variant: "destructive" });
    },
  });

  const openQuiz = async (id: string) => {
    const { data, error } = await aiService.getQuiz(id);
    if (error) { toast({ title: t("aiGenerator:toasts.couldntOpenQuiz"), description: error.message, variant: "destructive" }); return; }
    setPreview(data || null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {t("aiGenerator:quizTab.newQuiz")}
            </h3>
            <div>
              <Label className="text-sm font-medium">{t("aiGenerator:quizTab.titleLabel")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("aiGenerator:quizTab.titlePlaceholder")} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">{t("aiGenerator:quizTab.descriptionLabel")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                {t("aiGenerator:quizTab.pickHeader")}
              </h3>
              <Badge variant="secondary">{t("aiGenerator:quizTab.selectedBadge", { count: selected.size })}</Badge>
            </div>
            {bankLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (bank?.length || 0) === 0 ? (
              <EmptyState
                title={t("aiGenerator:quizTab.emptyBankTitle")}
                description={t("aiGenerator:quizTab.emptyBankDesc")}
                icon={<BookOpen className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {bank!.map((m, i) => {
                  const isSel = selected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSel ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {isSel && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.question_text}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] capitalize">{t(`aiGenerator:difficulty.${m.difficulty}`)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{m.marks}m</Badge>
                            {m.course_outcome_code && <Badge variant="outline" className="text-[10px]">{m.course_outcome_code}</Badge>}
                            {m.bloom_level && <Badge variant="outline" className="text-[10px]">{m.bloom_level}</Badge>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || selected.size === 0 || !title.trim()}
                className="gap-2"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {t("aiGenerator:quizTab.createQuiz")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t("aiGenerator:quizTab.yourQuizzes")}
            </h3>
            {quizzesLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (quizList?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("aiGenerator:quizTab.noQuizzes")}</p>
            ) : (
              <div className="space-y-2">
                {quizList!.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => openQuiz(q.id)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/30"
                  >
                    <p className="font-medium text-sm">{q.title}</p>
                    <p className="text-xs text-muted-foreground">{t("aiGenerator:quizTab.questionsCount", { count: q.questions.length })}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold">{preview.title}</h3>
              {preview.description && <p className="text-xs text-muted-foreground">{preview.description}</p>}
              <div className="space-y-2">
                {preview.questions.map((qq) => (
                  <div key={`${qq.position}-${qq.mcq.id}`} className="text-xs border-l-2 border-primary/30 pl-2">
                    <p className="font-medium">{qq.position}. {qq.mcq.question}</p>
                    <p className="text-muted-foreground">{t("aiGenerator:quizTab.answerLabel", { letter: qq.mcq.correct_answer, marks: qq.mcq.marks })}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Bank preview (saved questions / MCQs) ───────────────────────────────

function BankPreview() {
  const { t } = useTranslation("pages");
  const { data: qs } = useQuery({
    queryKey: ["ai-questions"],
    queryFn: async () => {
      const { data, error } = await aiService.listAIQuestions();
      if (error) throw error;
      return (data?.questions || []) as AIQuestionRow[];
    },
  });
  const { data: mcs } = useQuery({
    queryKey: ["ai-mcqs"],
    queryFn: async () => {
      const { data, error } = await aiService.listMCQs();
      if (error) throw error;
      return (data?.mcqs || []) as AIMCQRow[];
    },
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const delQ = async (id: string) => {
    const { error } = await aiService.deleteAIQuestion(id);
    if (error) { toast({ title: t("aiGenerator:toasts.couldntDelete"), description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["ai-questions"] });
  };
  const delM = async (id: string) => {
    const { error } = await aiService.deleteMCQ(id);
    if (error) { toast({ title: t("aiGenerator:toasts.couldntDelete"), description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["ai-mcqs"] });
  };

  const totalSaved = (qs?.length || 0) + (mcs?.length || 0);
  if (totalSaved === 0) return null;

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> {t("aiGenerator:bank.header")}
          </h3>
          <Badge variant="secondary">{t("aiGenerator:bank.savedBadge", { count: totalSaved })}</Badge>
        </div>
        {qs && qs.length > 0 && (
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">{t("aiGenerator:bank.qaLabel")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {qs.slice(0, 6).map((q) => (
                <div key={q.id} className="text-xs p-3 rounded-lg border border-border">
                  <p className="line-clamp-2">{q.question_text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px] capitalize">{t(`aiGenerator:difficulty.${q.difficulty}`)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.marks}m</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => delQ(q.id)} className="h-6 px-1.5 text-rose-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {mcs && mcs.length > 0 && (
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">{t("aiGenerator:bank.mcqLabel")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mcs.slice(0, 6).map((m) => (
                <div key={m.id} className="text-xs p-3 rounded-lg border border-border">
                  <p className="line-clamp-2">{m.question_text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px] capitalize">{t(`aiGenerator:difficulty.${m.difficulty}`)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t("aiGenerator:bank.answerBadge", { letter: m.correct_answer })}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => delM(m.id)} className="h-6 px-1.5 text-rose-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── root page ───────────────────────────────────────────────────────────

export default function AIAssessmentGenerator() {
  const { isTeacher, loading } = useAuthReady();
  const { t } = useTranslation("pages");

  useEffect(() => {
    void loadPageNamespace("aiGenerator");
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isTeacher) {
    return (
      <DashboardLayout>
        <PageHeader title={t("aiGenerator:header.teachersOnlyTitle")} description={t("aiGenerator:header.teachersOnlyDesc")} />
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title={t("aiGenerator:gate.title")}
              description={t("aiGenerator:gate.description")}
              icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
            />
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("aiGenerator:header.title")}
          description={t("aiGenerator:header.description")}
        />

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="pt-6 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold mb-1">{t("aiGenerator:intro.title")}</p>
              <p className="text-muted-foreground">
                {t("aiGenerator:intro.body")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="qa" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="qa" className="gap-1.5">
              <FileQuestion className="h-4 w-4" /> {t("aiGenerator:tabs.qa")}
            </TabsTrigger>
            <TabsTrigger value="mcq" className="gap-1.5">
              <ListChecks className="h-4 w-4" /> {t("aiGenerator:tabs.mcq")}
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> {t("aiGenerator:tabs.quiz")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="qa"><QATab /></TabsContent>
          <TabsContent value="mcq"><MCQTab /></TabsContent>
          <TabsContent value="quiz"><QuizTab /></TabsContent>
        </Tabs>

        <BankPreview />
      </div>
    </DashboardLayout>
  );
}
