import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Target, Lightbulb, Upload,
  Loader2, ListTree, CheckCircle2, Search, FileText
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PO { id: string; code: string; description: string }
interface CO { id: string; code: string; description: string; program_outcome_id: string | null }
interface LO { id: string; code: string; description: string; course_outcome_id: string | null }
interface Subject { id: string; code: string; name: string }
interface DraftCO { code: string; description: string }
interface DraftLO { code: string; description: string; co_code: string }

export default function OutcomesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PO form
  const [poOpen, setPoOpen] = useState(false);
  const [poCode, setPoCode] = useState("");
  const [poDesc, setPoDesc] = useState("");

  // Manual CO/LO forms
  const [coOpen, setCoOpen] = useState(false);
  const [coCode, setCoCode] = useState("");
  const [coDesc, setCoDesc] = useState("");
  const [coPoId, setCoPoId] = useState("none");
  const [loOpen, setLoOpen] = useState(false);
  const [loCode, setLoCode] = useState("");
  const [loDesc, setLoDesc] = useState("");
  const [loCoId, setLoCoId] = useState("");

  // List filter
  const [listSubjectId, setListSubjectId] = useState("all");

  // PDF state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfFileName, setPdfFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  // Subject search + extraction
  const [searchSubjectName, setSearchSubjectName] = useState("");
  const [searching, setSearching] = useState(false);
  const [extractedCOs, setExtractedCOs] = useState<DraftCO[]>([]);
  const [extractedLOs, setExtractedLOs] = useState<DraftLO[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSubjectName, setSavedSubjectName] = useState("");

  // PO PDF
  const [poPdfFileName, setPoPdfFileName] = useState("");
  const [poExtracting, setPoExtracting] = useState(false);
  const [extractedPOs, setExtractedPOs] = useState<Array<{ code: string; description: string }>>([]);
  const [poImporting, setPoImporting] = useState(false);

  /* ── Data ── */
  const { data: pos = [] } = useQuery<PO[]>({ queryKey: ["program_outcomes"], queryFn: async () => { const { data, error } = await apiClient.get("/program-outcomes"); if (error) throw error; return data ?? []; } });
  const { data: cos = [] } = useQuery<CO[]>({ queryKey: ["course_outcomes"], queryFn: async () => { const { data, error } = await apiClient.get("/course-outcomes"); if (error) throw error; return data ?? []; } });
  const { data: los = [] } = useQuery<LO[]>({ queryKey: ["learning_outcomes"], queryFn: async () => { const { data, error } = await apiClient.get("/learning-outcomes"); if (error) throw error; return data ?? []; } });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["subjects"], queryFn: async () => { const { data, error } = await apiClient.get("/subjects"); if (error) throw error; return data ?? []; } });

  const listCOs = listSubjectId !== "all" ? cos.filter(co => co.code?.startsWith(listSubjectId.slice(0, 2))) : cos;
  const listLOs = listSubjectId !== "all" ? los.filter(lo => { const p = cos.find(c => c.id === lo.course_outcome_id); return p?.code?.startsWith(listSubjectId.slice(0, 2)); }) : los;

  /* ── Mutations ── */
  const createPO = useMutation({ mutationFn: async () => { const { error } = await apiClient.post("/program-outcomes", { code: poCode, description: poDesc }); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["program_outcomes"] }); setPoOpen(false); setPoCode(""); setPoDesc(""); toast({ title: "PO created!" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const deletePO = useMutation({ mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/program-outcomes/${id}`); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["program_outcomes"] }) });
  const createCO = useMutation({ mutationFn: async () => { const { error } = await apiClient.post("/course-outcomes", { code: coCode, description: coDesc, program_outcome_id: coPoId === "none" ? null : coPoId }); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["course_outcomes"] }); setCoOpen(false); setCoCode(""); setCoDesc(""); toast({ title: "CO created!" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const deleteCO = useMutation({ mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/course-outcomes/${id}`); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["course_outcomes"] }); queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] }); } });
  const createLO = useMutation({ mutationFn: async () => { const { error } = await apiClient.post("/learning-outcomes", { code: loCode, description: loDesc, course_outcome_id: loCoId }); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] }); setLoOpen(false); setLoCode(""); setLoDesc(""); setLoCoId(""); toast({ title: "LO created!" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const deleteLO = useMutation({ mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/learning-outcomes/${id}`); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] }) });

  /* ════ STEP 1: Upload PDF ════ */
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setPdfLoaded(false);
    setRawText("");
    setPreviewReady(false);
    setExtractedCOs([]);
    setExtractedLOs([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.postFormData("/extract-text/pdf", formData);
      if (res.error) throw new Error("Could not read PDF. Please try another file.");
      const text: string = res.data?.text || "";
      if (!text.trim()) throw new Error("PDF appears to be empty or image-only.");
      setRawText(text);
      setPdfFileName(file.name);
      setPdfLoaded(true);
      toast({ title: "PDF loaded!", description: "Now enter the subject name to extract its COs and LOs." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  };

  /* ════ STEP 2: Extract COs & LOs ════ */
  const handleExtract = () => {
    if (!searchSubjectName.trim()) {
      toast({ title: "Enter a subject name first", variant: "destructive" }); return;
    }
    if (!rawText) {
      toast({ title: "Upload a PDF first", variant: "destructive" }); return;
    }
    setSearching(true);
    setPreviewReady(false);
    setExtractedCOs([]);
    setExtractedLOs([]);

    try {
      const keyword = searchSubjectName.trim().toLowerCase();
      const lower = rawText.toLowerCase();

      if (!lower.includes(keyword)) {
        toast({
          title: "Subject not found",
          description: `"${searchSubjectName}" not found in PDF. Try a shorter name.`,
          variant: "destructive"
        });
        return;
      }

      // ── Find a text block after a heading marker ──
      // Uses plain indexOf (no regex) — stateless and reliable.
      // keyword must appear anywhere before the heading in the document.
      const sliceBlock = (
        headingMarker: string,
        stopMarkers: string[]
      ): string => {
        let pos = 0;
        while (pos < lower.length) {
          const found = lower.indexOf(headingMarker, pos);
          if (found === -1) return "";
          if (lower.slice(0, found).includes(keyword)) {
            const afterHeading = found + headingMarker.length;
            const rest = lower.slice(afterHeading);
            let stopIdx = rest.length;
            for (const stop of stopMarkers) {
              const si = rest.indexOf(stop);
              if (si !== -1 && si < stopIdx) stopIdx = si;
            }
            return rawText.slice(afterHeading, afterHeading + stopIdx);
          }
          pos = found + 1;
        }
        return "";
      };

      // ── Find LO block with smart subject↔lab matching ──
      const sliceLabBlock = (stopMarkers: string[]): string => {
        const headingMarker = "lab outcomes:";

        // Strategy 1: If keyword looks like a course code (e.g. "csc601"),
        // derive the lab code (csl601) and find the lab section that has it nearby
        const courseCodeMatch = keyword.match(/^([a-z]+)(\d+)$/i);
        if (courseCodeMatch) {
          const prefix = courseCodeMatch[1].toLowerCase();
          const num = courseCodeMatch[2];
          // Map theory code prefix to lab prefix: csc->csl, cs->csl, etc.
          const labCode = `csl${num}`;

          let pos = 0;
          while (pos < lower.length) {
            const found = lower.indexOf(headingMarker, pos);
            if (found === -1) break;
            // Check if lab code appears within 500 chars before this heading
            const near = lower.slice(Math.max(0, found - 500), found);
            if (near.includes(labCode)) {
              const afterHeading = found + headingMarker.length;
              const rest = lower.slice(afterHeading);
              let stopIdx = rest.length;
              for (const stop of stopMarkers) {
                const si = rest.indexOf(stop);
                if (si !== -1 && si < stopIdx) stopIdx = si;
              }
              return rawText.slice(afterHeading, afterHeading + stopIdx);
            }
            pos = found + 1;
          }
        }

        // Strategy 2: keyword is a subject name (e.g. "system programming")
        // Find the lab section where a significant part of the keyword
        // appears within 500 chars before "Lab Outcomes:"
        // Use first 3+ words of keyword for matching
        const keywordWords = keyword.split(/\s+/).filter(w => w.length > 3);
        const shortKey = keywordWords.slice(0, 2).join(" "); // e.g. "system programming"

        let pos = 0;
        while (pos < lower.length) {
          const found = lower.indexOf(headingMarker, pos);
          if (found === -1) break;
          const near = lower.slice(Math.max(0, found - 500), found);
          if (near.includes(shortKey)) {
            const afterHeading = found + headingMarker.length;
            const rest = lower.slice(afterHeading);
            let stopIdx = rest.length;
            for (const stop of stopMarkers) {
              const si = rest.indexOf(stop);
              if (si !== -1 && si < stopIdx) stopIdx = si;
            }
            return rawText.slice(afterHeading, afterHeading + stopIdx);
          }
          pos = found + 1;
        }

        return "";
      };

      // ── Parse numbered outcome items from a text block ──
      // Handles two PDF formats:
      //   Format A: "1 Identify the relevance..."  (number + text on same line)
      //   Format B: "1\nIdentify the relevance..."  (number alone, text on next line)
      // Also merges wrapped continuation lines.
      const parseNumbered = (block: string, prefix: string): { code: string; description: string }[] => {
        const results: { code: string; description: string }[] = [];
        if (!block.trim()) return results;

        const lines = block
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.length > 0);

        const merged: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // ── Stop conditions — signals we've left the outcomes section ──
          // Single keyword on its own line (PDF splits "Module Content Hrs" across lines)
          if (/^(module|textbook|reference|assessment|suggested|term)$/i.test(line)) break;
          // Sub-item like "1.1 Concept of..."
          if (/^\d+\.\d+/.test(line)) break;
          // Module row: short line ending with a standalone hour number e.g. "Introduction to System Software 2"
          if (/^\d+\s+.+\s+\d+$/.test(line) && line.split(" ").length <= 6) break;

          // ── Format A: number + text on same line — "1 Identify..." ──
          if (/^\d+\s+\S/.test(line) && !/^\d+\.\d+/.test(line)) {
            merged.push(line);
            continue;
          }

          // ── Format B: bare number alone — peek at next line for text ──
          if (/^\d+$/.test(line) && i + 1 < lines.length) {
            const next = lines[i + 1];
            const nextIsClean =
              !/^\d+$/.test(next) &&
              !/^\d+\.\d+/.test(next) &&
              !/^(module|textbook|reference|assessment|suggested|term)$/i.test(next);
            if (nextIsClean) {
              merged.push(`${line} ${next}`);
              i++; // consumed next line
              continue;
            }
          }

          // ── Continuation: append to last item ──
          if (
            merged.length > 0 &&
            !/^\d+$/.test(line) &&
            !/^\d+\.\d+/.test(line) &&
            !/^(module|textbook|reference|assessment|suggested|term)$/i.test(line)
          ) {
            merged[merged.length - 1] += " " + line;
          }
        }

        let counter = 1;
        for (const line of merged) {
          const m = line.match(/^\d+\s+(.+)/);
          if (!m) continue;
          const desc = m[1].replace(/\s+/g, " ").trim();

          // Skip course objectives — "To understand...", "To explore..." etc.
          if (/^to\s+/i.test(desc)) continue;
          // Skip module rows that slipped through — end with bare number, short line
          if (/\b\d+$/.test(desc) && desc.split(" ").length <= 6) continue;
          // Skip anything too short to be a real outcome
          if (desc.length < 10) continue;

          results.push({ code: `${prefix}${counter++}`, description: desc });
        }

        return results;
      };

      // ── Extract CO block ──
      // Heading: "course outcomes:" (present in all subjects in this PDF)
      // Stop: "module" alone on a line, or "module content", or textbooks section
      const coBlock = sliceBlock(
        "course outcomes:",
        [
          "module content",
          "module  content",
          "\nmodule\n",
          "textbooks",
          "text books",
          "references:",
          "course objectives",
        ]
      );

      // ── Extract LO block ──
      const loBlock = sliceLabBlock(
        [
          "suggested list",
          "term work",
          "textbooks",
          "reference books",
          "oral",
        ]
      );

      // ── Parse both blocks ──
      const cos = parseNumbered(coBlock, "CO");
      const los = parseNumbered(loBlock, "LO").map(lo => ({
        ...lo,
        co_code: cos[0]?.code ?? "CO1",
      }));

      // ── Deduplicate by description ──
      const uniq = <T extends { description: string }>(arr: T[]) =>
        arr.filter((x, i, a) =>
          a.findIndex(y => y.description.toLowerCase() === x.description.toLowerCase()) === i
        );

      const uniqueCOs = uniq(cos);
      const uniqueLOs = uniq(los);

      setExtractedCOs(uniqueCOs);
      setExtractedLOs(uniqueLOs);
      setPreviewReady(true);

      if (uniqueCOs.length === 0 && uniqueLOs.length === 0) {
        toast({
          title: "Nothing detected",
          description: "Try a shorter subject name, e.g. 'System Programming'.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Extraction complete!",
          description: `Found ${uniqueCOs.length} COs and ${uniqueLOs.length} LOs for "${searchSubjectName}".`
        });
      }
    } finally {
      setSearching(false);
    }
  };

  /* ════ STEP 3: Save permanently ════ */
  const handleSave = async () => {
    if (extractedCOs.length === 0) {
      toast({ title: "Nothing to save", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      // Delete any previously existing subjects to enforce a single-subject workspace
      for (const s of subjects) {
        await apiClient.delete(`/subjects/${s.id}`);
      }

      const subjectCode = searchSubjectName.trim().toUpperCase().replace(/\s+/g, "").slice(0, 8);
      // Capture the new subject's id so COs and LOs are linked to it
      const { data: subjectData } = await apiClient.post("/subjects", { code: subjectCode, name: searchSubjectName.trim() });
      const newSubjectId = subjectData?.id ?? null;

      for (const co of extractedCOs) {
        if (!co.description.trim()) continue;
        const { data: coData } = await apiClient.post("/course-outcomes", {
          code: co.code,
          description: co.description,
          subject_id: newSubjectId,
          program_outcome_id: null,
        });
        if (coData?.id) {
          const coLOs = extractedLOs.filter(lo => lo.co_code === co.code);
          for (const lo of coLOs) {
            if (!lo.description.trim()) continue;
            await apiClient.post("/learning-outcomes", {
              code: lo.code,
              description: lo.description,
              course_outcome_id: coData.id,
              subject_id: newSubjectId,
            });
          }
        }
      }

      toast({
        title: "Saved!",
        description: `${extractedCOs.length} COs and ${extractedLOs.length} LOs for "${searchSubjectName}" saved permanently.`
      });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["course_outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["learning_outcomes"] });

      setSavedSubjectName(searchSubjectName.trim());
      setPreviewReady(false);
      setExtractedCOs([]);
      setExtractedLOs([]);
      setSearchSubjectName("");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ════ PO PDF ════ */
  const handlePoPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPoPdfFileName(file.name);
    setPoExtracting(true);
    setExtractedPOs([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.postFormData("/extract-text/pdf", formData);
      if (res.error) throw new Error("Could not read PDF.");
      const text: string = res.data?.text || "";
      const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
      const parsed: Array<{ code: string; description: string }> = [];
      for (const line of lines) {
        const m =
          line.match(/^PO\s*(\d+)\s*[:\-–.)\s]+(.{5,})/i) ||
          line.match(/^Program\s*Outcome\s*(\d+)\s*[:\-–.)\s]+(.{5,})/i);
        if (m) parsed.push({ code: `PO${m[1]}`, description: m[2].trim() });
      }
      if (parsed.length === 0) throw new Error("No POs found. Expected lines like 'PO1: Description'.");
      setExtractedPOs(parsed);
      toast({ title: `Found ${parsed.length} POs`, description: "Review and save." });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setPoExtracting(false);
      e.target.value = "";
    }
  };

  const handlePoImport = async () => {
    setPoImporting(true);
    try {
      for (const po of extractedPOs) {
        await apiClient.post("/program-outcomes", { code: po.code, description: po.description });
      }
      toast({ title: "POs saved!", description: `${extractedPOs.length} Program Outcomes saved permanently.` });
      queryClient.invalidateQueries({ queryKey: ["program_outcomes"] });
      setExtractedPOs([]);
      setPoPdfFileName("");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setPoImporting(false);
    }
  };

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Outcomes Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a syllabus PDF, enter the subject name, and auto-extract COs &amp; LOs.
          </p>
        </div>

        <Tabs defaultValue="co-lo">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="co-lo" className="gap-2">
              <ListTree className="h-4 w-4" />CO &amp; LO
            </TabsTrigger>
            <TabsTrigger value="po" className="gap-2">
              <Target className="h-4 w-4" />POs (Global)
            </TabsTrigger>
          </TabsList>

          {/* ══ TAB 1: CO & LO ══ */}
          <TabsContent value="co-lo" className="space-y-4 pt-4">

            {/* Step 1: Upload PDF */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-600 text-white text-xs font-bold">1</span>
                  Upload Syllabus PDF
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload once — then extract outcomes for multiple subjects.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onClick={() => !uploadLoading && document.getElementById("syllabus-upload")?.click()}
                  className={`flex items-center justify-center gap-3 h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${uploadLoading
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20"
                      : pdfLoaded
                        ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10"
                        : "border-muted-foreground/25 hover:border-violet-400 hover:bg-violet-50/30"
                    }`}
                >
                  {uploadLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                      <span className="text-sm text-violet-600 font-medium">Reading PDF…</span>
                    </>
                  ) : pdfLoaded ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">{pdfFileName}</p>
                        <p className="text-xs text-emerald-600/70">PDF loaded — click to replace</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Click to upload PDF</p>
                        <p className="text-xs text-muted-foreground">Any syllabus or course document</p>
                      </div>
                    </>
                  )}
                </div>
                <input id="syllabus-upload" type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
              </CardContent>
            </Card>

            {/* Step 2: Enter subject name + extract */}
            <Card className={pdfLoaded ? "" : "opacity-50 pointer-events-none"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-600 text-white text-xs font-bold">2</span>
                  Enter Subject Name to Extract
                </CardTitle>
                <CardDescription className="text-xs">
                  Type the subject name as it appears in the PDF. The system will find and extract COs &amp; LOs automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. System Programming, Cryptography…"
                    value={searchSubjectName}
                    onChange={e => { setSearchSubjectName(e.target.value); setPreviewReady(false); }}
                    onKeyDown={e => e.key === "Enter" && handleExtract()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleExtract}
                    disabled={searching || !searchSubjectName.trim()}
                    className="gap-2 shrink-0"
                  >
                    {searching
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Searching…</>
                      : <><Search className="h-4 w-4" />Extract</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Preview + Save */}
            {previewReady && (
              <Card className="border-violet-300 dark:border-violet-800 animate-in fade-in slide-in-from-top-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-600 text-white text-xs font-bold">3</span>
                      Extracted for "{searchSubjectName}"
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{extractedCOs.length} COs</Badge>
                      <Badge variant="secondary">{extractedLOs.length} LOs</Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    Review below. These will be permanently saved — only you can delete them later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {extractedCOs.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No COs detected. The PDF may use non-standard formatting.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {extractedCOs.map((co, i) => {
                        const coLOs = extractedLOs.filter(lo => lo.co_code === co.code);
                        return (
                          <div key={i} className="rounded-lg border border-violet-200 dark:border-violet-900/50 overflow-hidden">
                            <div className="px-3 py-2 bg-violet-50 dark:bg-violet-950/20 flex items-start gap-2">
                              <span className="text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0">{co.code}</span>
                              <span className="text-xs">{co.description}</span>
                            </div>
                            {coLOs.length > 0 && (
                              <div className="divide-y">
                                {coLOs.map((lo, j) => (
                                  <div key={j} className="px-3 py-1.5 flex items-start gap-2 bg-background">
                                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                    <span className="text-xs">
                                      <strong className="text-muted-foreground">{lo.code}</strong> — {lo.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Show LOs that aren't linked to any CO (edge case) */}
                      {extractedCOs.length > 0 && extractedLOs.filter(lo => !extractedCOs.find(co => co.code === lo.co_code)).map((lo, j) => (
                        <div key={`orphan-${j}`} className="rounded-lg border border-amber-200 dark:border-amber-900/50 overflow-hidden">
                          <div className="px-3 py-1.5 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-xs">
                              <strong className="text-muted-foreground">{lo.code}</strong> — {lo.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleSave}
                    disabled={saving || extractedCOs.length === 0}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                      : `Save ${extractedCOs.length} COs + ${extractedLOs.length} LOs permanently`
                    }
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Saved Outcomes List */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-sm">Saved Outcomes</h3>
                  <p className="text-xs text-muted-foreground">Permanently stored — delete only when needed</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {savedSubjectName && (
                    <div className="h-8 px-3 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 rounded-md text-xs font-semibold flex items-center border border-violet-200 dark:border-violet-800">
                      Active: {savedSubjectName}
                    </div>
                  )}

                  {/* Add CO manually */}
                  <Dialog open={coOpen} onOpenChange={setCoOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Add CO</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New Course Outcome</DialogTitle></DialogHeader>
                      <form onSubmit={e => { e.preventDefault(); createCO.mutate(); }} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Code</Label>
                          <Input value={coCode} onChange={e => setCoCode(e.target.value)} required placeholder="CO1" />
                        </div>
                        <div className="space-y-2">
                          <Label>Linked PO (optional)</Label>
                          <Select value={coPoId} onValueChange={setCoPoId}>
                            <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {pos.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea value={coDesc} onChange={e => setCoDesc(e.target.value)} rows={3} />
                        </div>
                        <Button type="submit" className="w-full" disabled={createCO.isPending}>Create CO</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Add LO manually */}
                  <Dialog open={loOpen} onOpenChange={setLoOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Add LO</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New Learning Outcome</DialogTitle></DialogHeader>
                      <form onSubmit={e => { e.preventDefault(); createLO.mutate(); }} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Code</Label>
                          <Input value={loCode} onChange={e => setLoCode(e.target.value)} required placeholder="LO1" />
                        </div>
                        <div className="space-y-2">
                          <Label>Linked CO</Label>
                          <Select value={loCoId} onValueChange={setLoCoId}>
                            <SelectTrigger><SelectValue placeholder="Select CO" /></SelectTrigger>
                            <SelectContent>
                              {listCOs.map((co: any) => (
                                <SelectItem key={co.id} value={co.id}>{co.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea value={loDesc} onChange={e => setLoDesc(e.target.value)} rows={3} />
                        </div>
                        <Button type="submit" className="w-full" disabled={createLO.isPending || !loCoId}>Create LO</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {listCOs.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">
                  <ListTree className="h-9 w-9 mx-auto mb-2 opacity-25" />
                  <p className="font-medium text-sm">No outcomes saved yet</p>
                  <p className="text-xs mt-1">Upload a PDF and extract a subject above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {listCOs.map(co => {
                    const childLOs = listLOs.filter(lo => lo.course_outcome_id === co.id);
                    const linkedPO = pos.find(p => p.id === co.program_outcome_id);
                    return (
                      <Card key={co.id} className="overflow-hidden border-violet-200/70 dark:border-violet-900/50">
                        <div className="flex justify-between items-start px-4 py-2.5 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/40">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-violet-800 dark:text-violet-300 text-sm">{co.code}</p>
                              {linkedPO && (
                                <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">
                                  → {linkedPO.code}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm mt-0.5">{co.description}</p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 shrink-0 text-destructive opacity-40 hover:opacity-100"
                            onClick={() => deleteCO.mutate(co.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="bg-background divide-y">
                          {childLOs.length === 0 ? (
                            <p className="px-4 py-2 text-xs text-muted-foreground italic">No LOs linked.</p>
                          ) : childLOs.map(lo => (
                            <div key={lo.id} className="flex justify-between items-start px-4 py-2 group hover:bg-muted/20">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <span className="text-[11px] font-bold text-muted-foreground">{lo.code}</span>
                                  <span className="text-xs ml-1.5">{lo.description}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
                                onClick={() => deleteLO.mutate(lo.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══ TAB 2: POs ══ */}
          <TabsContent value="po" className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Program Outcomes (Global)</h3>
                <p className="text-xs text-muted-foreground">Institution-wide — same across all subjects.</p>
              </div>
              <Dialog open={poOpen} onOpenChange={setPoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add PO</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Program Outcome</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createPO.mutate(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Code (e.g. PO1)</Label>
                      <Input value={poCode} onChange={e => setPoCode(e.target.value)} required placeholder="PO1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={poDesc} onChange={e => setPoDesc(e.target.value)} rows={3} />
                    </div>
                    <Button type="submit" className="w-full" disabled={createPO.isPending}>Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4 text-blue-600" />Import POs from PDF
                </CardTitle>
                <CardDescription className="text-xs">
                  Extracts lines matching "PO1: Description" format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  onClick={() => !poExtracting && document.getElementById("po-pdf-upload")?.click()}
                  className={`flex items-center justify-center gap-3 h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all
                    ${poExtracting
                      ? "border-blue-400 bg-blue-50"
                      : extractedPOs.length > 0
                        ? "border-emerald-400 bg-emerald-50/50"
                        : "border-muted-foreground/25 hover:bg-blue-50/50 hover:border-blue-400"
                    }`}
                >
                  {poExtracting
                    ? <><Loader2 className="h-4 w-4 animate-spin text-blue-600" /><span className="text-sm text-blue-600">Reading…</span></>
                    : extractedPOs.length > 0
                      ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Found {extractedPOs.length} POs — click to re-upload</span></>
                      : <><Upload className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Click to upload PO document</span></>
                  }
                </div>
                <input id="po-pdf-upload" type="file" accept=".pdf" className="hidden" onChange={handlePoPdfUpload} />

                {extractedPOs.length > 0 && (
                  <div className="space-y-2">
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {extractedPOs.map((po, i) => (
                        <div key={i} className="flex gap-2 text-xs p-2 bg-background rounded border">
                          <Target className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-blue-700 dark:text-blue-400">{po.code}</strong> — {po.description}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handlePoImport}
                      disabled={poImporting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {poImporting
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                        : `Save ${extractedPOs.length} Program Outcomes`
                      }
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {pos.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No POs yet. Add manually or upload PDF above.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {pos.map(po => (
                  <Card key={po.id}>
                    <CardContent className="flex items-start justify-between pt-4 pb-4">
                      <div>
                        <p className="font-bold text-primary">{po.code}</p>
                        <p className="text-sm mt-1">{po.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deletePO.mutate(po.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}