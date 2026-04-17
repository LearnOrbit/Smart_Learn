import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, FileBarChart, Target, BookMarked, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface COReport { co_id: string; co_code: string; co_description: string; avg_score: number; student_count: number; lo_count: number }
interface POReport { po_id: string; po_code: string; po_description: string; weighted_avg_score: number; co_count: number }

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:8002";

function getAttainmentLevel(score: number) {
  if (score >= 70) return { label: "High", color: "text-green-600", icon: CheckCircle2 };
  if (score >= 40) return { label: "Moderate", color: "text-yellow-600", icon: AlertTriangle };
  return { label: "Low", color: "text-red-600", icon: AlertTriangle };
}

export default function Reports() {
  const { role } = useAuth();
  const { toast } = useToast();

  const { data: coReport = [], isLoading: coLoading } = useQuery<COReport[]>({
    queryKey: ["report_co_attainment"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/reports/co-attainment");
      if (error) throw error;
      return data;
    },
    enabled: role === "teacher",
  });

  const { data: poReport = [], isLoading: poLoading } = useQuery<POReport[]>({
    queryKey: ["report_po_attainment"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/reports/po-attainment");
      if (error) throw error;
      return data;
    },
    enabled: role === "teacher",
  });

  const downloadCSV = async (endpoint: string, filename: string) => {
    try {
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/api${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Downloaded ${filename}` });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  if (role !== "teacher") {
    return (
      <DashboardLayout>
        <Card><CardContent className="py-8 text-center text-muted-foreground">Reports are available to teachers only.</CardContent></Card>
      </DashboardLayout>
    );
  }

  const coChartData = coReport.map((r) => ({ name: r.co_code, score: r.avg_score }));
  const poChartData = poReport.map((r) => ({ name: r.po_code, score: r.weighted_avg_score, fullMark: 100 }));

  // Pie distribution
  const highCount = coReport.filter((r) => r.avg_score >= 70).length;
  const modCount = coReport.filter((r) => r.avg_score >= 40 && r.avg_score < 70).length;
  const lowCount = coReport.filter((r) => r.avg_score < 40).length;
  const pieData = [
    { name: "High (≥70)", value: highCount },
    { name: "Moderate (40-70)", value: modCount },
    { name: "Low (<40)", value: lowCount },
  ].filter((d) => d.value > 0);
  const pieColors = ["#10b981", "#f59e0b", "#ef4444"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Reports & Analytics</h2>
            <p className="text-muted-foreground">CO/PO attainment analytics with downloadable reports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV("/reports/co-attainment-csv", "co_attainment.csv")}>
              <Download className="h-4 w-4 mr-1" />CO CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCSV("/reports/po-attainment-csv", "po_attainment.csv")}>
              <Download className="h-4 w-4 mr-1" />PO CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCSV("/reports/student-performance-csv", "student_performance.csv")}>
              <Download className="h-4 w-4 mr-1" />Students CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <BookMarked className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{coReport.length}</p>
                  <p className="text-xs text-muted-foreground">Course Outcomes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{poReport.length}</p>
                  <p className="text-xs text-muted-foreground">Program Outcomes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{highCount}</p>
                  <p className="text-xs text-muted-foreground">COs Attained (≥70)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{lowCount}</p>
                  <p className="text-xs text-muted-foreground">COs At Risk (&lt;40)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CO Attainment Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><BookMarked className="h-4 w-4" /> CO Attainment</CardTitle>
            <CardDescription>Average score (0-100) across all students per Course Outcome</CardDescription>
          </CardHeader>
          <CardContent>
            {coLoading ? <p className="text-muted-foreground">Loading...</p> : coChartData.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No CO data yet. Grade submissions to see attainment.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={coChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {coChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PO Radar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> PO Attainment Radar</CardTitle>
              <CardDescription>Weighted average (using CO-PO correlations)</CardDescription>
            </CardHeader>
            <CardContent>
              {poLoading ? <p className="text-muted-foreground">Loading...</p> : poChartData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No PO data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={poChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar name="PO Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* CO Distribution Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileBarChart className="h-4 w-4" /> CO Distribution</CardTitle>
              <CardDescription>How many COs are High / Moderate / Low</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} label dataKey="value">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CO Detail Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CO Attainment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CO Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">LOs</TableHead>
                  <TableHead className="text-center">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coReport.map((r) => {
                  const att = getAttainmentLevel(r.avg_score);
                  return (
                    <TableRow key={r.co_id}>
                      <TableCell className="font-semibold">{r.co_code}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.co_description}</TableCell>
                      <TableCell className="text-center font-bold">{r.avg_score}%</TableCell>
                      <TableCell className="text-center">{r.lo_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={att.color}>{att.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* PO Detail Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">PO Attainment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Weighted Score</TableHead>
                  <TableHead className="text-center">COs</TableHead>
                  <TableHead className="text-center">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poReport.map((r) => {
                  const att = getAttainmentLevel(r.weighted_avg_score);
                  return (
                    <TableRow key={r.po_id}>
                      <TableCell className="font-semibold">{r.po_code}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.po_description}</TableCell>
                      <TableCell className="text-center font-bold">{r.weighted_avg_score}%</TableCell>
                      <TableCell className="text-center">{r.co_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={att.color}>{att.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
