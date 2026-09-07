/**
 * AIQuizPage.tsx
 * ──────────────
 * Student + teacher "Quick AI Quiz" page at /ai-quiz.
 *
 * Two phases:
 *   1. Configure:  pick a topic, difficulty, and count → click Generate.
 *   2. Play:       answer the MCQs, submit, see score + per-question feedback.
 *
 * The OpenAI key is server-side only — the browser talks to the
 * FastAPI backend via `aiService.quickQuiz`. Nothing is persisted:
 *   - No DB write on the backend.
 *   - No localStorage, no cookies, no session storage of answers.
 *   - Closing the tab or clicking "New quiz" discards everything.
 *
 * Why no persistence? Students shouldn't accidentally share MCQs
 * across users, the question bank is teacher-owned, and we keep the
 * cost model simple (one OpenAI call per attempt).
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import {
  Bot, Sparkles, Loader2, Check, X, ArrowRight, RefreshCw,
  Trophy, Target, Lightbulb, ListChecks, AlertTriangle, Wand2,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/integrations/api/client";
import { aiService, GeneratedMCQ } from "@/services/aiService";

// ─── shared types ──────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";

interface ConfigState {
  topic: string;
  difficulty: Difficulty;
  count: number;
}

interface QuizSession {
  topic: string;
  difficulty: Difficulty;
  questions: GeneratedMCQ[];
  // index in the array is the question number; value is the user's chosen letter or null
  answers: Array<"A" | "B" | "C" | "D" | null>;
  submitted: boolean;
}

// ─── Configure phase ───────────────────────────────────────────────────────

function ConfigurePhase({
  onGenerate, generating,
}: { onGenerate: (cfg: ConfigState) => void; generating: boolean }) {
  const { t } = useTranslation("pages");
  const [state, setState] = useState<ConfigState>({
    topic: "", difficulty: "medium", count: 5,
  });

  const submit = () => {
    if (!state.topic.trim()) return;
    onGenerate(state);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label htmlFor="topic" className="text-sm font-medium">
              {t("aiQuiz:configure.topicLabel")}
            </Label>
            <Input
              id="topic"
              value={state.topic}
              onChange={(e) => setState({ ...state, topic: e.target.value })}
              placeholder={t("aiQuiz:configure.topicPlaceholder")}
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("aiQuiz:configure.topicHint")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">{t("aiQuiz:configure.difficultyLabel")}</Label>
              <Select
                value={state.difficulty}
                onValueChange={(v) => setState({ ...state, difficulty: v as Difficulty })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t("aiQuiz:configure.difficultyEasy")}</SelectItem>
                  <SelectItem value="medium">{t("aiQuiz:configure.difficultyMedium")}</SelectItem>
                  <SelectItem value="hard">{t("aiQuiz:configure.difficultyHard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">{t("aiQuiz:configure.countLabel")}</Label>
              <Input
                type="number" min={1} max={15}
                value={state.count}
                onChange={(e) =>
                  setState({ ...state, count: Math.max(1, Math.min(15, Number(e.target.value) || 1)) })
                }
                className="mt-1.5"
              />
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={generating || !state.topic.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("aiQuiz:configure.generating")}</>
            ) : (
              <><Wand2 className="h-4 w-4" /> {t("aiQuiz:configure.generate")}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {generating && (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-muted-foreground text-center">{t("aiQuiz:configure.loading")}</p>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Play phase (a single question card) ──────────────────────────────────

function QuestionCard({
  q, index, userAnswer, onChange, submitted,
}: {
  q: GeneratedMCQ;
  index: number;
  userAnswer: "A" | "B" | "C" | "D" | null;
  onChange: (v: "A" | "B" | "C" | "D") => void;
  submitted: boolean;
}) {
  const { t } = useTranslation("pages");
  const isCorrect = userAnswer === q.correct_answer;
  const showFeedback = submitted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={
        showFeedback
          ? isCorrect
            ? "border-emerald-500/40"
            : "border-rose-500/40"
          : ""
      }>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-mono">Q{index + 1}</Badge>
            <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>
            {q.bloom_level && <Badge variant="outline">{q.bloom_level}</Badge>}
            {showFeedback && (
              <Badge variant={isCorrect ? "default" : "destructive"} className="ml-auto">
                {isCorrect ? (
                  <><Check className="h-3 w-3 mr-1" /> {t("aiQuiz:card.correct")}</>
                ) : (
                  <><X className="h-3 w-3 mr-1" /> {t("aiQuiz:card.incorrect")}</>
                )}
              </Badge>
            )}
          </div>

          <p className="text-sm font-medium leading-relaxed">{q.question}</p>

          <RadioGroup
            value={userAnswer || ""}
            onValueChange={(v) => onChange(v as "A" | "B" | "C" | "D")}
            disabled={submitted}
            className="space-y-2"
          >
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const text = q[`option_${letter.toLowerCase()}` as keyof GeneratedMCQ] as string;
              const isCorrectOption = q.correct_answer === letter;
              const isUserPick = userAnswer === letter;

              let stateClasses = "border-border hover:bg-muted/30";
              if (showFeedback) {
                if (isCorrectOption) {
                  stateClasses = "border-emerald-500/60 bg-emerald-500/10";
                } else if (isUserPick && !isCorrectOption) {
                  stateClasses = "border-rose-500/60 bg-rose-500/10";
                } else {
                  stateClasses = "border-border opacity-60";
                }
              } else if (isUserPick) {
                stateClasses = "border-primary bg-primary/5";
              }

              return (
                <label
                  key={letter}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${stateClasses}`}
                >
                  <RadioGroupItem value={letter} id={`q${index}-${letter}`} className="mt-0.5" />
                  <span className="font-mono font-semibold w-5 shrink-0">{letter}.</span>
                  <span className="flex-1 text-sm">{text}</span>
                  {showFeedback && isCorrectOption && (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {showFeedback && isUserPick && !isCorrectOption && (
                    <X className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                </label>
              );
            })}
          </RadioGroup>

          {showFeedback && q.explanation && (
            <div className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {t("aiQuiz:explanation")}
              </p>
              <p className="text-muted-foreground whitespace-pre-wrap">{q.explanation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Score summary (shown after submit) ───────────────────────────────────

function ScoreSummary({
  session, onNew, onRetake,
}: {
  session: QuizSession;
  onNew: () => void;
  onRetake: () => void;
}) {
  const { t } = useTranslation("pages");
  const total = session.questions.length;
  const correct = session.answers.filter((a, i) => a === session.questions[i].correct_answer).length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color =
    percent >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    percent >= 50 ? "text-amber-600 dark:text-amber-400" :
    "text-rose-600 dark:text-rose-400";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
    >
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t("aiQuiz:score.title")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("aiQuiz:score.breakdown", { correct, total, topic: session.topic })}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className={`text-3xl font-bold ${color}`}>{percent}%</p>
            </div>
          </div>
          <Progress value={percent} className="h-2" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onRetake} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> {t("aiQuiz:score.retake")}
            </Button>
            <Button onClick={onNew} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> {t("aiQuiz:score.newTopic")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Play phase ────────────────────────────────────────────────────────────

function PlayPhase({
  session, onSubmit, onAnswer, onNew, onRetake, generating,
}: {
  session: QuizSession;
  onSubmit: () => void;
  onAnswer: (qi: number, letter: "A" | "B" | "C" | "D") => void;
  onNew: () => void;
  onRetake: () => void;
  generating: boolean;
}) {
  const { t } = useTranslation("pages");
  const answeredCount = session.answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === session.questions.length;
  const correct = useMemo(
    () => session.answers.filter((a, i) => a === session.questions[i].correct_answer).length,
    [session]
  );

  return (
    <div className="space-y-6">
      {/* Header card with progress */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm flex-1">{session.topic}</h2>
            <Badge variant="secondary" className="capitalize">{session.difficulty}</Badge>
            <Badge variant="outline">{t("aiQuiz:play.questionsBadge", { count: session.questions.length })}</Badge>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("aiQuiz:play.answeredOf", { answered: answeredCount, total: session.questions.length })}</span>
              {session.submitted && <span>{t("aiQuiz:play.correctCount", { count: correct })}</span>}
            </div>
            <Progress
              value={session.submitted
                ? (correct / session.questions.length) * 100
                : (answeredCount / session.questions.length) * 100}
              className="h-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question list */}
      <AnimatePresence>
        {session.questions.map((q, i) => (
          <QuestionCard
            key={i}
            q={q}
            index={i}
            userAnswer={session.answers[i]}
            onChange={(v) => onAnswer(i, v)}
            submitted={session.submitted}
          />
        ))}
      </AnimatePresence>

      {/* Footer actions */}
      {!session.submitted ? (
        <div className="flex justify-end sticky bottom-4 z-10">
          <Button
            onClick={onSubmit}
            disabled={!allAnswered}
            size="lg"
            className="gap-2 shadow-lg"
          >
            {allAnswered
              ? <><ArrowRight className="h-4 w-4" /> {t("aiQuiz:play.submit")}</>
              : <>{t("aiQuiz:play.answerAllFirst", { count: session.questions.length })}</>}
          </Button>
        </div>
      ) : (
        <ScoreSummary session={session} onNew={onNew} onRetake={onRetake} />
      )}
    </div>
  );
}

// ─── root page ────────────────────────────────────────────────────────────

type Phase = "configure" | "play" | "loading";

export default function AIQuizPage() {
  const { t } = useTranslation("pages");
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("configure");
  const [session, setSession] = useState<QuizSession | null>(null);

  useEffect(() => {
    void loadPageNamespace("aiQuiz");
  }, []);

  const generate = async (cfg: ConfigState) => {
    setPhase("loading");
    try {
      const { data, error } = await aiService.quickQuiz({
        topic: cfg.topic,
        count: cfg.count,
        difficulty: cfg.difficulty,
      });
      if (error) throw error;
      const mcqs = (data?.mcqs || []) as GeneratedMCQ[];
      if (mcqs.length === 0) {
        toast({ title: t("aiQuiz:toasts.noQuestions"), variant: "destructive" });
        setPhase("configure");
        return;
      }
      setSession({
        topic: cfg.topic,
        difficulty: cfg.difficulty,
        questions: mcqs,
        answers: mcqs.map(() => null),
        submitted: false,
      });
      setPhase("play");
    } catch (e: any) {
      toast({
        title: t("aiQuiz:toasts.generateFailed"),
        description: e?.message || t("aiQuiz:toasts.tryDifferent"),
        variant: "destructive",
      });
      setPhase("configure");
    }
  };

  const onAnswer = (qi: number, letter: "A" | "B" | "C" | "D") => {
    setSession((s) => {
      if (!s) return s;
      const next = [...s.answers];
      next[qi] = letter;
      return { ...s, answers: next };
    });
  };

  const onSubmit = () => {
    setSession((s) => (s ? { ...s, submitted: true } : s));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onNew = () => {
    setSession(null);
    setPhase("configure");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onRetake = () => {
    setSession((s) =>
      s ? { ...s, answers: s.questions.map(() => null), submitted: false } : s
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title={t("aiQuiz:header.title")}
          description={t("aiQuiz:header.description")}
        />

        {phase === "configure" && (
          <ConfigurePhase
            generating={false}
            onGenerate={generate}
          />
        )}

        {phase === "loading" && (
          <ConfigurePhase generating={true} onGenerate={() => { /* ignored while loading */ }} />
        )}

        {phase === "play" && session && (
          <PlayPhase
            session={session}
            onSubmit={onSubmit}
            onAnswer={onAnswer}
            onNew={onNew}
            onRetake={onRetake}
            generating={false}
          />
        )}

        {/* Quick "did you know" footer for student context */}
        {phase === "configure" && (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ListChecks className="h-4 w-4" />
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">{t("aiQuiz:tip.title")}</p>
                <p>{t("aiQuiz:tip.body")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
