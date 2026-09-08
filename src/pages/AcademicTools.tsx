import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, ClipboardList, Code2, FlaskConical, Mail, Network, Search, Send, Sparkles, UserRound, Wrench } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const tools = [
  { id: "coding-assessment", label: "Coding assessment", icon: Code2, fields: ["code", "tests"] },
  { id: "adaptive-test", label: "Adaptive test", icon: ClipboardList, fields: ["topic"] },
  { id: "career-guidance", label: "Career guidance", icon: UserRound, fields: ["interests", "skills", "goals"] },
  { id: "wellness-support", label: "Wellness support", icon: BrainCircuit, fields: ["message"] },
  { id: "timetable", label: "Timetable", icon: CalendarDays, fields: ["courses", "days"] },
  { id: "workload", label: "Faculty workload", icon: Network, fields: ["faculty", "courses"] },
  { id: "communication-draft", label: "Communication draft", icon: Mail, fields: ["purpose", "points"] },
  { id: "literature-review", label: "Literature review", icon: BookOpen, fields: ["topic", "text"] },
  { id: "research-gaps", label: "Research gaps", icon: Search, fields: ["text"] },
  { id: "proposal", label: "Proposal writer", icon: Sparkles, fields: ["title", "context", "objectives"] },
  { id: "citation", label: "Citation generator", icon: ClipboardList, fields: ["title", "authors", "doi"] },
  { id: "debugging", label: "Debugging assistant", icon: Wrench, fields: ["code", "error"] },
  { id: "experiment-guidance", label: "Experiment guidance", icon: FlaskConical, fields: ["question", "variables"] },
] as const;

type ToolId = (typeof tools)[number]["id"];
type FormState = Record<string, string>;

const initialForm: FormState = { code: "", tests: "", topic: "", interests: "", skills: "", goals: "", message: "", courses: "", days: "Monday, Tuesday, Wednesday, Thursday, Friday", faculty: "", purpose: "", points: "", text: "", title: "", context: "", objectives: "", authors: "", doi: "", error: "", question: "", variables: "" };

function split(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function AcademicTools() {
  const { role } = useAuth();
  const [selected, setSelected] = useState<ToolId>("coding-assessment");
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<unknown>(null);
  const { toast } = useToast();
  const visibleTools = role === "teacher" ? tools : tools.filter((item) => item.id !== "workload" && item.id !== "communication-draft");
  const tool = visibleTools.find((item) => item.id === selected) ?? visibleTools[0];

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { ...form };
      for (const key of ["interests", "skills", "courses", "days", "faculty", "points", "objectives", "authors", "variables"]) {
        body[key] = split(form[key] || "");
      }
      if (selected === "adaptive-test") body.question_count = 5;
      const response = await apiClient.post(`/tools/${selected}`, body);
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast({ title: "Tool request failed", description: error.message, variant: "destructive" }),
  });

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const is = (name: string) => tool.fields.includes(name as never);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <PageHeader title="Academic tools" description="Local, explainable assistants for study, teaching, research, and academic communication." variant="minimal" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4 text-primary" /> Tool library</CardTitle></CardHeader>
            <CardContent className="grid gap-1 p-3">
              {visibleTools.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => { setSelected(id); setResult(null); }} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${selected === id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 shrink-0" /> <span>{label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><tool.icon className="h-5 w-5 text-primary" /> {tool.label}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {is("topic") && <Field label="Topic" value={form.topic} onChange={(value) => update("topic", value)} placeholder="e.g. recursion" />}
                {is("title") && <Field label="Title" value={form.title} onChange={(value) => update("title", value)} placeholder="Working title" />}
                {is("purpose") && <Field label="Purpose" value={form.purpose} onChange={(value) => update("purpose", value)} placeholder="Announcement, reminder, request..." />}
                {is("question") && <Field label="Research question" value={form.question} onChange={(value) => update("question", value)} placeholder="What do you want to test?" />}
                {is("code") && <TextField label="Code" value={form.code} onChange={(value) => update("code", value)} placeholder="Paste code or the smallest failing example" />}
                {is("tests") && <TextField label="Tests" value={form.tests} onChange={(value) => update("tests", value)} placeholder="Paste test cases or expected behavior" />}
                {is("error") && <TextField label="Error" value={form.error} onChange={(value) => update("error", value)} placeholder="Paste the error message and relevant context" rows={4} />}
                {is("text") && <TextField label="Source text" value={form.text} onChange={(value) => update("text", value)} placeholder="Paste literature or research notes" rows={9} />}
                {is("context") && <TextField label="Context" value={form.context} onChange={(value) => update("context", value)} placeholder="Problem background and motivation" rows={6} />}
                {is("goals") && <TextField label="Goals" value={form.goals} onChange={(value) => update("goals", value)} placeholder="What would you like to explore?" rows={4} />}
                {is("message") && <TextField label="How are you feeling?" value={form.message} onChange={(value) => update("message", value)} placeholder="Share only what you feel comfortable sharing" rows={5} />}
                {is("interests") && <Field label="Interests (comma separated)" value={form.interests} onChange={(value) => update("interests", value)} placeholder="data, design, research" />}
                {is("skills") && <Field label="Skills (comma separated)" value={form.skills} onChange={(value) => update("skills", value)} placeholder="Python, writing, teamwork" />}
                {is("courses") && <Field label="Courses (comma separated)" value={form.courses} onChange={(value) => update("courses", value)} placeholder="Algorithms, Statistics" />}
                {is("days") && <Field label="Available days (comma separated)" value={form.days} onChange={(value) => update("days", value)} />}
                {is("faculty") && <Field label="Faculty (comma separated)" value={form.faculty} onChange={(value) => update("faculty", value)} placeholder="Dr. Rao, Dr. Khan" />}
                {is("points") && <TextField label="Key points (one per line or comma separated)" value={form.points} onChange={(value) => update("points", value)} placeholder="Deadline, location, action" rows={4} />}
                {is("objectives") && <TextField label="Objectives (comma separated)" value={form.objectives} onChange={(value) => update("objectives", value)} placeholder="Measure, compare, evaluate" rows={3} />}
                {is("authors") && <Field label="Authors (comma separated)" value={form.authors} onChange={(value) => update("authors", value)} placeholder="Surname, A." />}
                {is("doi") && <Field label="DOI or URL" value={form.doi} onChange={(value) => update("doi", value)} placeholder="10.xxxx/xxxxx" />}
                {is("variables") && <Field label="Variables (comma separated)" value={form.variables} onChange={(value) => update("variables", value)} placeholder="intervention, outcome" />}
                <Button className="w-full gap-2" onClick={() => mutation.mutate()} disabled={mutation.isPending}><Send className="h-4 w-4" /> {mutation.isPending ? "Working..." : "Generate result"}</Button>
              </CardContent>
            </Card>

            <Card className="min-h-[360px]">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRight className="h-4 w-4 text-primary" /> Result</CardTitle></CardHeader>
              <CardContent>
                {result ? <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-6">{JSON.stringify(result, null, 2)}</pre> : <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground"><CheckCircle2 className="h-8 w-8 text-primary/60" /><p>Choose a tool, provide context, and generate a local result.</p>{selected === "wellness-support" && <p className="flex max-w-sm items-start gap-2 text-xs"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />For immediate danger, contact local emergency services or a crisis hotline.</p>}</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function TextField({ label, value, onChange, placeholder, rows = 5 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} /></label>;
}
