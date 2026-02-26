import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, FileText, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submissionContent, setSubmissionContent] = useState<Record<string, string>>({});

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content }: { assignmentId: string; content: string }) => {
      const { error } = await supabase.from("submissions").insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      setSubmissionContent((prev) => ({ ...prev, [vars.assignmentId]: "" }));
      toast({ title: "Submitted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getSubmission = (assignmentId: string) =>
    mySubmissions.find((s) => s.assignment_id === assignmentId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>My Assignments</h2>
          <p className="text-muted-foreground">View assignments and submit your work</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No assignments available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignments.map((a) => {
              const submission = getSubmission(a.id);
              const isSubmitted = !!submission;
              const isGraded = !!submission?.grade;

              return (
                <Card key={a.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{a.title}</CardTitle>
                          {isGraded ? (
                            <Badge className="bg-primary/10 text-primary border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Graded: {submission.grade}
                            </Badge>
                          ) : isSubmitted ? (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Submitted
                            </Badge>
                          ) : null}
                        </div>
                        <CardDescription>{a.description}</CardDescription>
                      </div>
                      {a.due_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(a.due_date), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isGraded && submission.feedback && (
                      <div className="rounded-md bg-primary/5 p-3 text-sm">
                        <p className="font-medium text-primary mb-1">Teacher Feedback</p>
                        <p className="text-foreground">{submission.feedback}</p>
                      </div>
                    )}
                    {isSubmitted ? (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p className="text-muted-foreground text-xs mb-1">Your submission</p>
                        <p>{submission.content}</p>
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const content = submissionContent[a.id]?.trim();
                          if (content) submitMutation.mutate({ assignmentId: a.id, content });
                        }}
                        className="space-y-3"
                      >
                        <Textarea
                          placeholder="Write your submission here..."
                          value={submissionContent[a.id] || ""}
                          onChange={(e) =>
                            setSubmissionContent((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          rows={3}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submitMutation.isPending || !submissionContent[a.id]?.trim()}
                        >
                          {submitMutation.isPending ? "Submitting..." : "Submit"}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
