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
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, FileText, Users } from "lucide-react";
import { format } from "date-fns";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

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

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", selectedAssignment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, profiles!submissions_student_id_fkey(full_name)")
        .eq("assignment_id", selectedAssignment!);
      if (error) {
        // Fallback without join if foreign key doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", selectedAssignment!);
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
    enabled: !!selectedAssignment,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assignments").insert({
        teacher_id: user!.id,
        title,
        description,
        due_date: dueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      toast({ title: "Assignment created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, grade, feedback }: { id: string; grade: string; feedback: string }) => {
      const { error } = await supabase
        .from("submissions")
        .update({ grade, feedback })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      toast({ title: "Graded!" });
    },
  });

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
            <DialogContent>
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
            {assignments.map((a) => (
              <Card
                key={a.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedAssignment === a.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{a.title}</CardTitle>
                      <CardDescription className="mt-1">{a.description}</CardDescription>
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
            ))}
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
                <CardContent className="py-8 text-center text-muted-foreground">
                  No submissions yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {submissions.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.profiles?.full_name || s.student_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.submitted_at), "MMM d, yyyy h:mm a")}</p>
                      </div>
                      <p className="text-sm bg-muted p-3 rounded-md">{s.content}</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Grade"
                          defaultValue={s.grade || ""}
                          className="w-24"
                          onBlur={(e) => {
                            if (e.target.value !== (s.grade || "")) {
                              gradeMutation.mutate({ id: s.id, grade: e.target.value, feedback: s.feedback || "" });
                            }
                          }}
                        />
                        <Input
                          placeholder="Feedback"
                          defaultValue={s.feedback || ""}
                          className="flex-1"
                          onBlur={(e) => {
                            if (e.target.value !== (s.feedback || "")) {
                              gradeMutation.mutate({ id: s.id, grade: s.grade || "", feedback: e.target.value });
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
