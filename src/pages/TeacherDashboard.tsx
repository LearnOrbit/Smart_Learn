import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, FileText, Users, Lightbulb } from "lucide-react";
import { format } from "date-fns";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  // Fetch learning outcomes for the dropdown
  const { data: learningOutcomes = [] } = useQuery({
    queryKey: ["learning_outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_outcomes").select("*, course_outcomes(code)").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch LO mappings for all assignments
  const { data: loMappings = [] } = useQuery({
    queryKey: ["assignment_lo_mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_lo_mapping")
        .select("*, learning_outcomes(code, description)");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", selectedAssignment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", selectedAssignment!);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAssignment,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create assignment
      const { data: assignment, error } = await supabase
        .from("assignments")
        .insert({ teacher_id: user!.id, title, description, due_date: dueDate || null })
        .select()
        .single();
      if (error) throw error;

      // Create LO mappings
      if (selectedLOs.length > 0) {
        const mappings = selectedLOs.map((loId) => ({
          assignment_id: assignment.id,
          learning_outcome_id: loId,
        }));
        const { error: mapError } = await supabase.from("assignment_lo_mapping").insert(mappings);
        if (mapError) throw mapError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment_lo_mapping"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedLOs([]);
      toast({ title: "Assignment created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, grade, feedback }: { id: string; marks: number | null; grade: string; feedback: string }) => {
      const { error } = await supabase.from("submissions").update({ marks, grade, feedback }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      toast({ title: "Graded!" });
    },
  });

  const toggleLO = (loId: string) => {
    setSelectedLOs((prev) =>
      prev.includes(loId) ? prev.filter((id) => id !== loId) : [...prev, loId]
    );
  };

  const getAssignmentLOs = (assignmentId: string) =>
    loMappings.filter((m: any) => m.assignment_id === assignmentId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Assignments</h2>
            <p className="text-muted-foreground">Create and manage your assignments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Assignment</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Assignment title" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for students..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" />
                    Learning Outcomes
                  </Label>
                  {learningOutcomes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No LOs defined yet. Go to Outcomes to create some.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {learningOutcomes.map((lo: any) => (
                        <button
                          key={lo.id}
                          type="button"
                          onClick={() => toggleLO(lo.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            selectedLOs.includes(lo.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/50"
                          }`}
                        >
                          {lo.code}
                          {lo.course_outcomes?.code && <span className="opacity-60">({lo.course_outcomes.code})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Assignment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No assignments yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignments.map((a) => {
              const assignmentLOs = getAssignmentLOs(a.id);
              return (
                <Card
                  key={a.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedAssignment === a.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{a.title}</CardTitle>
                        <CardDescription>{a.description}</CardDescription>
                        {assignmentLOs.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {assignmentLOs.map((m: any) => (
                              <Badge key={m.id} variant="secondary" className="text-xs">
                                <Lightbulb className="h-3 w-3 mr-1" />
                                {m.learning_outcomes?.code}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {a.due_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(a.due_date), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {selectedAssignment && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Submissions</h3>
            </div>
            {submissions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No submissions yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {submissions.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.student_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.submitted_at), "MMM d, yyyy h:mm a")}</p>
                      </div>
                      <p className="text-sm bg-muted p-3 rounded-md">{s.content}</p>
                      {s.image_path && (
                        <img
                          src={supabase.storage.from("submission-images").getPublicUrl(s.image_path).data.publicUrl}
                          alt="Submission image"
                          className="rounded-md max-h-48 object-contain border"
                        />
                      )}
                      {s.extracted_text && (
                        <div className="rounded-md bg-accent/30 border border-accent p-3 text-sm space-y-1">
                          <p className="font-medium text-xs text-muted-foreground">OCR Extracted Text</p>
                          <p className="whitespace-pre-wrap text-foreground">{s.extracted_text}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Marks"
                          defaultValue={s.marks ?? ""}
                          className="w-24"
                          onBlur={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            gradeMutation.mutate({ id: s.id, marks: val, grade: s.grade || "", feedback: s.feedback || "" });
                          }}
                        />
                        <Input
                          placeholder="Grade (e.g. A+)"
                          defaultValue={s.grade || ""}
                          className="w-24"
                          onBlur={(e) => {
                            if (e.target.value !== (s.grade || "")) {
                              gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: e.target.value, feedback: s.feedback || "" });
                            }
                          }}
                        />
                        <Input
                          placeholder="Feedback"
                          defaultValue={s.feedback || ""}
                          className="flex-1"
                          onBlur={(e) => {
                            if (e.target.value !== (s.feedback || "")) {
                              gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: s.grade || "", feedback: e.target.value });
                            }
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
