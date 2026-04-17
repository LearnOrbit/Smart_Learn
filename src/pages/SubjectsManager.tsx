import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, BookOpen, Link2, Unlink, CheckCircle2 } from "lucide-react";

interface SubjectItem { id: string; code: string; name: string; description: string; created_by: string }
interface CO { id: string; code: string; description: string }
interface SubjectCOMapping { id: string; subject_id: string; course_outcome_id: string }

export default function SubjectsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  /* ─── Queries ── */
  const { data: subjects = [], isLoading } = useQuery<SubjectItem[]>({
    queryKey: ["subjects"],
    queryFn: async () => { const { data, error } = await apiClient.get("/subjects"); if (error) throw error; return data; },
  });

  const { data: cos = [] } = useQuery<CO[]>({
    queryKey: ["course-outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/course-outcomes"); if (error) throw error; return data; },
  });

  // Fetch subject-CO mappings for the selected subject
  const { data: subjectMappings = [] } = useQuery<SubjectCOMapping[]>({
    queryKey: ["subject-co-mappings", selectedSubjectId],
    enabled: !!selectedSubjectId,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/subject-co-mappings?subject_id=${selectedSubjectId}`);
      // If endpoint doesn't exist yet, return empty (graceful degradation)
      if (error) return [];
      return data || [];
    },
  });

  const mappedCOIds = new Set(subjectMappings.map((m: SubjectCOMapping) => m.course_outcome_id));

  /* ─── Mutations ── */
  const createMutation = useMutation({
    mutationFn: async () => { const { error } = await apiClient.post("/subjects", { code, name, description }); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setOpen(false); setCode(""); setName(""); setDescription("");
      toast({ title: "Subject created!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/subjects/${id}`); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["subjects"] }); toast({ title: "Subject deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const linkCOMutation = useMutation({
    mutationFn: async ({ subjectId, coId }: { subjectId: string; coId: string }) => {
      const { error } = await apiClient.post("/subject-co-mappings", { subject_id: subjectId, course_outcome_id: coId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-co-mappings", selectedSubjectId] });
      toast({ title: "CO linked to subject!" });
    },
    onError: (e: Error) => toast({ title: "Link failed", description: e.message, variant: "destructive" }),
  });

  const unlinkCOMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await apiClient.delete(`/subject-co-mappings/${mappingId}`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-co-mappings", selectedSubjectId] });
      toast({ title: "CO unlinked" });
    },
    onError: (e: Error) => toast({ title: "Unlink failed", description: e.message, variant: "destructive" }),
  });

  const toggleCO = (coId: string) => {
    if (!selectedSubjectId) return;
    const existing = subjectMappings.find((m: SubjectCOMapping) => m.course_outcome_id === coId);
    if (existing) {
      unlinkCOMutation.mutate(existing.id);
    } else {
      linkCOMutation.mutate({ subjectId: selectedSubjectId, coId });
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Subjects</h2>
            <p className="text-muted-foreground">Manage course subjects and their CO linkages</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Subject</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Subject</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={code} onChange={e => setCode(e.target.value)} required placeholder="e.g. CS101" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Data Structures" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Subject"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="subjects">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="subjects" className="gap-1.5"><BookOpen className="h-4 w-4" />Subjects</TabsTrigger>
            <TabsTrigger value="co-link" className="gap-1.5"><Link2 className="h-4 w-4" />CO Linkage</TabsTrigger>
          </TabsList>

          {/* ── Subjects Tab ── */}
          <TabsContent value="subjects" className="space-y-4 mt-4">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : subjects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No subjects yet. Create your first one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map(s => (
                  <Card key={s.id} className="group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{s.name}</CardTitle>
                          <p className="text-sm text-primary font-medium mt-0.5">{s.code}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{s.description || "No description"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── CO Linkage Tab ── */}
          <TabsContent value="co-link" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Subject list */}
              <div className="lg:col-span-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Select a Subject
                </p>
                {subjects.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No subjects yet.
                    </CardContent>
                  </Card>
                ) : (
                  subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubjectId(s.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-all text-sm ${
                        selectedSubjectId === s.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/40"
                      }`}
                    >
                      <p className="font-semibold">{s.code}</p>
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                    </button>
                  ))
                )}
              </div>

              {/* CO Linking Panel */}
              <div className="lg:col-span-3">
                {!selectedSubjectId ? (
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a subject to link Course Outcomes</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        COs for <span className="text-primary">{selectedSubject?.code}</span>
                      </CardTitle>
                      <CardDescription>
                        Toggle COs to link/unlink them to this subject. Linked COs will appear in the Question Paper Generator.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cos.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No COs defined. Go to Outcomes Manager first.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {cos.map(co => {
                            const linked = mappedCOIds.has(co.id);
                            return (
                              <button
                                key={co.id}
                                onClick={() => toggleCO(co.id)}
                                className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-all ${
                                  linked
                                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
                                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className={`font-semibold text-sm ${linked ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                                    {co.code}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{co.description}</p>
                                </div>
                                {linked ? (
                                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-xs font-medium">Linked</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                                    <Unlink className="h-4 w-4" />
                                    <span className="text-xs">Not linked</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {mappedCOIds.size > 0 && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">
                            <strong>{mappedCOIds.size}</strong> CO{mappedCOIds.size !== 1 ? "s" : ""} linked to {selectedSubject?.code}.
                            These will appear as options in the Question Paper Generator.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
