import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, Plus, Search, Download } from "lucide-react";

interface ResearchTrend {
  id: string;
  title: string;
  summary: string;
  source: string | null;
  url: string | null;
  tags: string[];
  trend_date: string | null;
}

const emptyForm = { title: "", summary: "", source: "", url: "", tags: "", trend_date: "" };

export default function ResearchTrends() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [externalResults, setExternalResults] = useState<ResearchTrend[]>([]);

  const { data: trends = [], isLoading } = useQuery<ResearchTrend[]>({
    queryKey: ["research-trends"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/research-trends");
      if (error) throw error;
      return data as ResearchTrend[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.post("/research-trends", {
        ...form,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["research-trends"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.delete(`/research-trends/${id}`);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["research-trends"] }),
  });

  const crossrefSearch = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.get(`/research-trends/search/crossref?q=${encodeURIComponent(searchQuery)}&rows=8`);
      if (error) throw error;
      return data as ResearchTrend[];
    },
    onSuccess: (data) => setExternalResults(data),
  });

  const importMutation = useMutation({
    mutationFn: async (trend: ResearchTrend) => {
      const { data, error } = await apiClient.post("/research-trends", {
        title: trend.title,
        summary: trend.summary,
        source: trend.source,
        url: trend.url,
        tags: trend.tags,
        trend_date: trend.trend_date,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["research-trends"] }),
  });

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Research Trends</h2>
          <p className="text-muted-foreground">Curate research notes and sources for your classes. Entries are stored locally in this workspace.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Add trend</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="trend-title">Title</Label><Input id="trend-title" value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="e.g. Retrieval-augmented learning" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="trend-summary">Summary</Label><Textarea id="trend-summary" value={form.summary} onChange={(event) => updateField("summary", event.target.value)} rows={3} placeholder="A short note about the trend" /></div>
            <div className="space-y-1.5"><Label htmlFor="trend-source">Source</Label><Input id="trend-source" value={form.source} onChange={(event) => updateField("source", event.target.value)} placeholder="Publisher or paper" /></div>
            <div className="space-y-1.5"><Label htmlFor="trend-url">Source URL</Label><Input id="trend-url" type="url" value={form.url} onChange={(event) => updateField("url", event.target.value)} placeholder="https://..." /></div>
            <div className="space-y-1.5"><Label htmlFor="trend-date">Date</Label><Input id="trend-date" value={form.trend_date} onChange={(event) => updateField("trend_date", event.target.value)} placeholder="2026-09" /></div>
            <div className="space-y-1.5"><Label htmlFor="trend-tags">Tags</Label><Input id="trend-tags" value={form.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="AI, assessment" /></div>
            <div className="sm:col-span-2"><Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || createMutation.isPending}><Save className="mr-2 h-4 w-4" />Save trend</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Search Crossref</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2"><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search public research metadata" onKeyDown={(event) => { if (event.key === "Enter" && searchQuery.trim()) crossrefSearch.mutate(); }} /><Button onClick={() => crossrefSearch.mutate()} disabled={!searchQuery.trim() || crossrefSearch.isPending}><Search className="mr-2 h-4 w-4" />Search</Button></div>
            <p className="text-xs text-muted-foreground">Crossref results are external previews and are not stored until you import them.</p>
            {crossrefSearch.isError && <p className="text-sm text-destructive">Crossref search failed. Try again.</p>}
            <div className="space-y-3">{externalResults.map((trend) => <div key={trend.id} className="flex items-start justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{trend.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{trend.summary || "No abstract available."}</p><a className="text-xs text-primary underline" href={trend.url || undefined} target="_blank" rel="noreferrer">{trend.source || "Crossref source"}</a></div><Button variant="outline" size="sm" onClick={() => importMutation.mutate(trend)} disabled={importMutation.isPending}><Download className="mr-2 h-4 w-4" />Import</Button></div>)}</div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading trends...</p> : trends.length === 0 ? <p className="text-sm text-muted-foreground">No curated trends yet.</p> : trends.map((trend) => (
            <Card key={trend.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div><CardTitle className="text-base">{trend.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{trend.source || "User-curated note"}{trend.trend_date ? ` · ${trend.trend_date}` : ""}</p></div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(trend.id)} disabled={deleteMutation.isPending} aria-label={`Delete ${trend.title}`}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-3"><p className="whitespace-pre-wrap text-sm">{trend.summary}</p><div className="flex flex-wrap gap-2">{trend.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}{trend.url && <a className="text-sm text-primary underline" href={trend.url} target="_blank" rel="noreferrer">Open source</a>}</div></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
