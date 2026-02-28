import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, FileText, CheckCircle, Clock, Upload, Image, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { createWorker } from "tesseract.js";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submissionContent, setSubmissionContent] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [ocrProcessing, setOcrProcessing] = useState<Record<string, boolean>>({});
  const [ocrText, setOcrText] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const handleImageSelect = async (assignmentId: string, file: File) => {
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: file }));
    setOcrProcessing((prev) => ({ ...prev, [assignmentId]: true }));

    try {
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      setOcrText((prev) => ({ ...prev, [assignmentId]: text }));
      toast({ title: "OCR Complete", description: "Text extracted from image." });
    } catch (err: any) {
      toast({ title: "OCR Failed", description: err.message, variant: "destructive" });
    } finally {
      setOcrProcessing((prev) => ({ ...prev, [assignmentId]: false }));
    }
  };

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content }: { assignmentId: string; content: string }) => {
      let imagePath: string | null = null;
      const file = selectedFiles[assignmentId];
      const extractedText = ocrText[assignmentId] || null;

      // Upload image if present
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${assignmentId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("submission-images")
          .upload(path, file);
        if (uploadError) throw uploadError;
        imagePath = path;
      }

      const { error } = await supabase.from("submissions").insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        content,
        image_path: imagePath,
        extracted_text: extractedText,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      setSubmissionContent((prev) => ({ ...prev, [vars.assignmentId]: "" }));
      setSelectedFiles((prev) => ({ ...prev, [vars.assignmentId]: null }));
      setOcrText((prev) => ({ ...prev, [vars.assignmentId]: "" }));
      toast({ title: "Submitted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getSubmission = (assignmentId: string) =>
    mySubmissions.find((s) => s.assignment_id === assignmentId);

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("submission-images").getPublicUrl(path);
    return data.publicUrl;
  };

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
                      <div className="space-y-2">
                        <div className="rounded-md bg-muted p-3 text-sm">
                          <p className="text-muted-foreground text-xs mb-1">Your submission</p>
                          <p>{submission.content}</p>
                        </div>
                        {submission.image_path && (
                          <img
                            src={getImageUrl(submission.image_path)}
                            alt="Submission"
                            className="rounded-md max-h-48 object-contain border"
                          />
                        )}
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const content = submissionContent[a.id]?.trim() || ocrText[a.id]?.trim() || "";
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

                        {/* Image upload section */}
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[a.id] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageSelect(a.id, file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRefs.current[a.id]?.click()}
                            disabled={ocrProcessing[a.id]}
                          >
                            {ocrProcessing[a.id] ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processing OCR...</>
                            ) : (
                              <><Upload className="h-4 w-4 mr-1" />Upload Image</>
                            )}
                          </Button>
                          {selectedFiles[a.id] && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Image className="h-3 w-3" />
                              {selectedFiles[a.id]!.name}
                            </span>
                          )}
                        </div>

                        {/* Show OCR extracted text */}
                        {ocrText[a.id] && (
                          <div className="rounded-md bg-accent/30 border border-accent p-3 text-sm space-y-1">
                            <p className="font-medium text-xs text-muted-foreground">Extracted Text (OCR)</p>
                            <p className="whitespace-pre-wrap text-foreground">{ocrText[a.id]}</p>
                          </div>
                        )}

                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            submitMutation.isPending ||
                            ocrProcessing[a.id] ||
                            (!submissionContent[a.id]?.trim() && !ocrText[a.id]?.trim())
                          }
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
