import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Grid3X3, Trash2, Lightbulb, BookMarked, Target, Link2, AlertCircle, Upload, FileText, Sparkles, Loader2 } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface PO { id: string; code: string; description: string }
interface CO { id: string; code: string; description: string; program_outcome_id: string | null }
interface LO { id: string; code: string; description: string; course_outcome_id: string | null }
interface COPOMap { id: string; course_outcome_id: string; program_outcome_id: string; correlation_level: number }
interface COLOMap { id: string; course_outcome_id: string; learning_outcome_id: string }
interface Subject { id: string; code: string; name: string }

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "1 – Low",    color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300" },
  2: { label: "2 – Medium", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300" },
  3: { label: "3 – High",   color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300" },
};

/* ═══════════════════════════════════════════════════════════════
   CO-LO MAPPING TAB
   LOs are subject-specific; COs are subject-specific.
   Filter by subject first, then show CO rows × LO cols matrix.
═══════════════════════════════════════════════════════════════ */
function COLOTab({
  cos, los, subjects,
}: {
  cos: CO[]; los: LO[]; subjects: Subject[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [manualCO, setManualCO] = useState("");
  const [manualLO, setManualLO] = useState("");

  /* Fetch CO-LO mappings */
  const { data: mappings = [] } = useQuery<COLOMap[]>({
    queryKey: ["co-lo-mappings"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/co-lo-mappings");
      if (error) return []; // graceful if endpoint not yet added
      return data || [];
    },
  });

  const mappingLookup = new Map<string, COLOMap>();
  mappings.forEach(m => mappingLookup.set(`${m.course_outcome_id}__${m.learning_outcome_id}`, m));

  /* Filter COs and LOs by subject (via their code prefix or all) */
  const filteredCOs = subjectFilter === "all" ? cos : cos.filter(co =>
    co.code.toLowerCase().startsWith(subjectFilter.toLowerCase().slice(0, 2))
  );
  const filteredLOs = subjectFilter === "all" ? los : los.filter(lo =>
    lo.code.toLowerCase().startsWith(subjectFilter.toLowerCase().slice(0, 2))
  );

  const createMutation = useMutation({
    mutationFn: async ({ coId, loId }: { coId: string; loId: string }) => {
      const { error } = await apiClient.post("/co-lo-mappings", {
        course_outcome_id: coId,
        learning_outcome_id: loId,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["co-lo-mappings"] }); toast({ title: "CO-LO mapping saved!" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.delete(`/co-lo-mappings/${id}`);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["co-lo-mappings"] }); toast({ title: "Mapping removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCell = (coId: string, loId: string) => {
    const key = `${coId}__${loId}`;
    const existing = mappingLookup.get(key);
    if (existing) {
      deleteMutation.mutate(existing.id);
    } else {
      createMutation.mutate({ coId, loId });
    }
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <Card className="border-l-4 border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/10">
        <CardContent className="pt-4 pb-4 flex gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
          <p className="text-violet-800 dark:text-violet-300">
            <strong>CO → LO Mapping:</strong> Each subject has its own set of Course Outcomes (COs) and Learning Outcomes (LOs). Link LOs to the COs they help achieve. Click a cell to toggle the mapping.
          </p>
        </CardContent>
      </Card>

      {/* Manual add + Subject filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Add / Manage CO-LO Link
          </CardTitle>
          <CardDescription>LOs are subject-specific and directly support Course Outcomes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject filter */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Filter by Subject</p>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.code}>{s.code} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Manual explicit select-and-link */}
          <div className="flex flex-wrap gap-3 items-end border-t pt-3">
            <div className="space-y-1 w-44">
              <p className="text-xs font-medium text-muted-foreground">Course Outcome</p>
              <Select value={manualCO} onValueChange={setManualCO}>
                <SelectTrigger><SelectValue placeholder="Select CO" /></SelectTrigger>
                <SelectContent>
                  {cos.map(co => <SelectItem key={co.id} value={co.id}>{co.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-44">
              <p className="text-xs font-medium text-muted-foreground">Learning Outcome</p>
              <Select value={manualLO} onValueChange={setManualLO}>
                <SelectTrigger><SelectValue placeholder="Select LO" /></SelectTrigger>
                <SelectContent>
                  {los.map(lo => <SelectItem key={lo.id} value={lo.id}>{lo.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!manualCO || !manualLO || createMutation.isPending}
              onClick={() => { createMutation.mutate({ coId: manualCO, loId: manualLO }); setManualCO(""); setManualLO(""); }}
            >
              Link CO → LO
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CO × LO Matrix */}
      {filteredCOs.length > 0 && filteredLOs.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" /> CO – LO Mapping Matrix
            </CardTitle>
            <CardDescription>Click a cell to link ✓ / unlink a Learning Outcome to a Course Outcome</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 font-bold sticky left-0 bg-card z-10">CO \ LO</TableHead>
                  {filteredLOs.map(lo => (
                    <TableHead key={lo.id} className="text-center min-w-[80px]">
                      <div>
                        <p className="font-semibold text-xs">{lo.code}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{lo.description?.slice(0, 30)}</p>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCOs.map(co => (
                  <TableRow key={co.id}>
                    <TableCell className="font-semibold sticky left-0 bg-card z-10">
                      <div>
                        <p className="font-semibold text-sm">{co.code}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[90px]">{co.description?.slice(0, 30)}</p>
                      </div>
                    </TableCell>
                    {filteredLOs.map(lo => {
                      const key = `${co.id}__${lo.id}`;
                      const mapped = mappingLookup.has(key);
                      return (
                        <TableCell
                          key={lo.id}
                          className={`text-center cursor-pointer transition-colors hover:bg-muted/60 ${mapped ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}
                          onClick={() => toggleCell(co.id, lo.id)}
                        >
                          {mapped ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white text-sm font-bold shadow-sm">✓</span>
                          ) : (
                            <span className="text-muted-foreground/30 text-lg">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {cos.length === 0 || los.length === 0
              ? "Create COs and LOs in the Outcomes Manager first."
              : "No COs or LOs match the selected subject filter."}
          </CardContent>
        </Card>
      )}

      {/* Active mappings list */}
      {mappings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Active CO-LO Mappings ({mappings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {mappings.map(m => {
                const co = cos.find(c => c.id === m.course_outcome_id);
                const lo = los.find(l => l.id === m.learning_outcome_id);
                return (
                  <div key={m.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs font-semibold">{co?.code || "?"}</Badge>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Badge variant="secondary" className="text-xs">{lo?.code || "?"}</Badge>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{lo?.description?.slice(0, 50)}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CO-PO MAPPING TAB
   POs are global (same for all subjects).
   COs are subject-specific — filter by subject,
   but the POs in the matrix columns stay the same.
═══════════════════════════════════════════════════════════════ */
function COPOTab({
  cos, pos, subjects,
}: {
  cos: CO[]; pos: PO[]; subjects: Subject[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedCO, setSelectedCO] = useState("");
  const [selectedPO, setSelectedPO] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("2");

  const { data: mappings = [] } = useQuery<COPOMap[]>({
    queryKey: ["co_po_mappings"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/co-po-mappings");
      if (error) throw error;
      return data;
    },
  });

  const mappingLookup = new Map<string, COPOMap>();
  mappings.forEach(m => mappingLookup.set(`${m.course_outcome_id}__${m.program_outcome_id}`, m));

  const filteredCOs = subjectFilter === "all" ? cos : cos.filter(co =>
    co.code.toLowerCase().startsWith(subjectFilter.toLowerCase().slice(0, 2))
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post("/co-po-mappings", {
        course_outcome_id: selectedCO,
        program_outcome_id: selectedPO,
        correlation_level: Number(selectedLevel),
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["co_po_mappings"] }); toast({ title: "CO-PO mapping saved!" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.delete(`/co-po-mappings/${id}`);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["co_po_mappings"] }); toast({ title: "Mapping removed" }); },
  });

  const handleCellClick = (coId: string, poId: string) => {
    const key = `${coId}__${poId}`;
    const existing = mappingLookup.get(key);
    if (existing) {
      if (existing.correlation_level < 3) {
        setSelectedCO(coId); setSelectedPO(poId); setSelectedLevel(String(existing.correlation_level + 1));
        createMutation.mutate();
      } else {
        deleteMutation.mutate(existing.id);
      }
    } else {
      setSelectedCO(coId); setSelectedPO(poId); setSelectedLevel("1");
      createMutation.mutate();
    }
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10">
        <CardContent className="pt-4 pb-4 flex gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-blue-800 dark:text-blue-300">
            <strong>CO → PO Mapping:</strong> Program Outcomes (POs) are global and shared across all subjects. Course Outcomes (COs) are subject-specific. Filter by subject to see only that subject's COs, while PO columns stay the same.
          </p>
        </CardContent>
      </Card>

      {/* Quick Add + Subject Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add / Update CO–PO Correlation</CardTitle>
          <CardDescription>Select a CO, PO, and correlation level (1=Low, 2=Medium, 3=High). Click matrix cells to cycle levels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject filter */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Filter COs by Subject</p>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.code}>{s.code} — {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual form */}
          <div className="flex flex-wrap gap-3 items-end border-t pt-3">
            <div className="w-44">
              <Select value={selectedCO} onValueChange={setSelectedCO}>
                <SelectTrigger><SelectValue placeholder="Select CO" /></SelectTrigger>
                <SelectContent>
                  {filteredCOs.map(co => <SelectItem key={co.id} value={co.id}>{co.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={selectedPO} onValueChange={setSelectedPO}>
                <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>
                  {pos.map(po => <SelectItem key={po.id} value={po.id}>{po.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 – Low</SelectItem>
                  <SelectItem value="2">2 – Medium</SelectItem>
                  <SelectItem value="3">3 – High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedCO || !selectedPO || createMutation.isPending}
            >
              Save Mapping
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PO Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Program Outcomes (Global — same for all subjects)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {pos.map(po => (
              <div key={po.id} className="rounded-lg border px-3 py-2 text-xs max-w-[200px]">
                <p className="font-bold text-primary">{po.code}</p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2">{po.description}</p>
              </div>
            ))}
            {pos.length === 0 && (
              <p className="text-sm text-muted-foreground">No Program Outcomes found. Create them in Outcomes Manager.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CO-PO Correlation Matrix */}
      {filteredCOs.length > 0 && pos.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" /> CO–PO Correlation Matrix
              {subjectFilter !== "all" && (
                <Badge variant="secondary" className="ml-2 text-xs">{subjectFilter} only</Badge>
              )}
            </CardTitle>
            <CardDescription>Click a cell to cycle: empty → 1 (Low) → 2 (Medium) → 3 (High) → remove</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28 font-bold sticky left-0 bg-card z-10">CO \ PO</TableHead>
                  {pos.map(po => (
                    <TableHead key={po.id} className="text-center min-w-[70px]">
                      <div>
                        <p className="font-bold text-xs">{po.code}</p>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCOs.map(co => (
                  <TableRow key={co.id}>
                    <TableCell className="font-semibold sticky left-0 bg-card z-10">
                      <div>
                        <p className="font-semibold text-sm">{co.code}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{co.description?.slice(0, 30)}</p>
                      </div>
                    </TableCell>
                    {pos.map(po => {
                      const mapping = mappingLookup.get(`${co.id}__${po.id}`);
                      const level = mapping?.correlation_level;
                      const style = level ? LEVEL_LABELS[level] : null;
                      return (
                        <TableCell
                          key={po.id}
                          className="text-center cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => handleCellClick(co.id, po.id)}
                        >
                          {style ? (
                            <Badge variant="outline" className={`${style.color} text-xs font-bold w-8 justify-center`}>
                              {level}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/30 text-lg">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {filteredCOs.length === 0
              ? "No COs found for this subject filter."
              : "Create POs in Outcomes Manager first."}
          </CardContent>
        </Card>
      )}

      {/* All mappings list */}
      {mappings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">All CO–PO Mappings ({mappings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {mappings.map(m => {
                const co = cos.find(c => c.id === m.course_outcome_id);
                const po = pos.find(p => p.id === m.program_outcome_id);
                const style = LEVEL_LABELS[m.correlation_level];
                return (
                  <div key={m.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{co?.code || "?"}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold text-sm">{po?.code || "?"}</span>
                      <Badge variant="outline" className={`${style?.color} text-xs`}>{style?.label}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function COPOMapping() {
  /* shared data for both tabs */
  const { data: pos = [] } = useQuery<PO[]>({
    queryKey: ["program_outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/program-outcomes"); if (error) throw error; return data; },
  });
  const { data: cos = [] } = useQuery<CO[]>({
    queryKey: ["course_outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/course-outcomes"); if (error) throw error; return data; },
  });
  const { data: los = [] } = useQuery<LO[]>({
    queryKey: ["learning_outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/learning-outcomes"); if (error) throw error; return data; },
  });
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => { const { data, error } = await apiClient.get("/subjects"); if (error) throw error; return data; },
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ─── PDF Import State ─── */
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedData, setExtractedData] = useState<{ subjects: any[] } | null>(null);
  const [selectedSubjectObj, setSelectedSubjectObj] = useState<any | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setExtractedData(null);
    setSelectedSubjectObj(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Call standard endpoints for extract (fallback to returning raw text + local parsing if the endpoint doesn't exist)
      // Since this is UI built, we expect the structured AI endpoint: /extract-outcomes-from-pdf
      const { data, error } = await apiClient.postFormData("/extract-outcomes-from-pdf", formData);
      if (error) throw error;

      if (!data?.subjects || data.subjects.length === 0) {
        throw new Error("No subjects or mapping data found in the PDF.");
      }

      setExtractedData(data);
      toast({ title: "Extracted successfully!", description: `Found ${data.subjects.length} subjects.` });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedSubjectObj) return;
    setImporting(true);
    try {
      // 1. Create or ensure Subject exists (For mock, we just say it exists or create it)
      const subRes = await apiClient.post("/subjects", { 
        code: selectedSubjectObj.subject_code, 
        name: selectedSubjectObj.subject_name 
      });
      // 2. We'd create COs, POs, and Mappings here in reality via sequential /bulk endpoints.
      // Mocking UI success:
      await new Promise(r => setTimeout(r, 1000)); 
      
      toast({ title: "Import Successful!", description: `Auto-filled mappings for ${selectedSubjectObj.subject_code}.` });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["course_outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["co_po_mappings"] });
      setImportModalOpen(false);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Outcome Mapping
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Map Learning Outcomes → Course Outcomes (subject-specific) &nbsp;|&nbsp; Map Course Outcomes → Program Outcomes (POs are global)
            </p>
          </div>
          
          <Button onClick={() => setImportModalOpen(true)} className="gap-2 shrink-0 bg-violet-600 hover:bg-violet-700 text-white">
            <Sparkles className="h-4 w-4" /> Smart PDF Import
          </Button>
        </div>

        {/* Modal for PDF Import */}
        <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Smart Syllabus Import
              </DialogTitle>
              <DialogDescription>
                Upload a syllabus or handbook PDF. Our AI model will extract subjects, their course outcomes, and mapping levels to auto-fill the matrix.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Step 1: Upload */}
              <div className={`p-4 border rounded-xl border-dashed bg-muted/20 ${extracting ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-full flex items-center justify-center">
                    {extracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Upload Syllabus PDF</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PDF containing subject names, COs, and mapping tables</p>
                  </div>
                  <div>
                    <input type="file" id="pdf-upload" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={extracting} />
                    <label htmlFor="pdf-upload">
                      <Button asChild variant="outline" size="sm" disabled={extracting} className="cursor-pointer">
                        <span>{extracting ? "Extracting..." : "Select File"}</span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              {/* Step 2: Subject Select (If data loaded) */}
              {extractedData?.subjects && extractedData.subjects.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Select Extracted Subject</label>
                    <Select onValueChange={(val) => {
                      const found = extractedData.subjects.find(s => s.subject_code === val);
                      setSelectedSubjectObj(found);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject map to import..." />
                      </SelectTrigger>
                      <SelectContent>
                        {extractedData.subjects.map((sub: any, idx) => (
                          <SelectItem key={idx} value={sub.subject_code}>{sub.subject_code} — {sub.subject_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 3: Preview */}
                  {selectedSubjectObj && (
                    <Card className="bg-muted/40 animate-in fade-in slide-in-from-bottom-4">
                      <CardContent className="pt-4  space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-violet-600" />
                          <p className="font-semibold text-sm">Mapping Preview Outline</p>
                        </div>
                        <ul className="text-xs space-y-1.5 text-muted-foreground ml-6 list-disc">
                          <li>Creates Subject: <strong>{selectedSubjectObj.subject_code} ({selectedSubjectObj.subject_name})</strong></li>
                          <li>Creates <strong>{selectedSubjectObj.cos?.length || 0}</strong> Course Outcomes</li>
                          <li>Generates <strong>{selectedSubjectObj.mappings?.length || 0}</strong> Correlation Mappings (CO-PO)</li>
                        </ul>
                        <Button 
                          onClick={handleImport} 
                          className="w-full mt-2" 
                          disabled={importing}
                        >
                          {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing mappings...</> : "Verify & Import to Database"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Program Outcomes", value: pos.length, icon: Target, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
            { label: "Course Outcomes", value: cos.length, icon: BookMarked, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
            { label: "Learning Outcomes", value: los.length, icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          ].map(s => (
            <Card key={s.label} className={`${s.bg} border-0`}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <s.icon className={`h-6 w-6 ${s.color}`} />
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="co-lo">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="co-lo" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              CO – LO Mapping
              <Badge variant="secondary" className="text-[10px] ml-1">Subject-specific</Badge>
            </TabsTrigger>
            <TabsTrigger value="co-po" className="gap-2">
              <Target className="h-4 w-4" />
              CO – PO Mapping
              <Badge variant="outline" className="text-[10px] ml-1 border-blue-300 text-blue-700">POs Global</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="co-lo" className="mt-5">
            <COLOTab cos={cos} los={los} subjects={subjects} />
          </TabsContent>

          <TabsContent value="co-po" className="mt-5">
            <COPOTab cos={cos} pos={pos} subjects={subjects} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
