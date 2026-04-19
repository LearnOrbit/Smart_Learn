import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import StudentAnalyticsModal from "@/components/StudentAnalyticsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Users,
  Edit,
  Save,
  Search,
  UserCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  BarChart3,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface PerformanceData {
  id: string;
  student_id: string;
  subject_id: string | null;
  student_marks: number;
  attendance: number;
  internal_assessments: number;
  lab_performance: number;
  assignment_scores: number;
  study_hours: number;
  concept_mastery: number;
  teacher_remarks: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StudentItem {
  id: string;
  email: string;
  name: string;
  role: string;
  performance: PerformanceData | null;
}

interface MetricsForm {
  student_marks: number;
  attendance: number;
  internal_assessments: number;
  lab_performance: number;
  assignment_scores: number;
  study_hours: number;
  concept_mastery: number;
  teacher_remarks: string;
}

const DEFAULT_METRICS: MetricsForm = {
  student_marks: 0,
  attendance: 0,
  internal_assessments: 0,
  lab_performance: 0,
  assignment_scores: 0,
  study_hours: 0,
  concept_mastery: 0,
  teacher_remarks: "",
};

// ── Helper ───────────────────────────────────────────────────────────

function averageScore(p: PerformanceData): number {
  // Use weighted academic components (Matching LES Engine weights)
  const w = { marks: 0.25, attendance: 0.15, ia: 0.20, lab: 0.15, assign: 0.10, study: 0.05, mastery: 0.10 };
  
  return Math.round(
    (p.student_marks * w.marks) +
    (p.attendance * w.attendance) +
    ((p.internal_assessments / 20) * 100 * w.ia) +
    ((p.lab_performance / 25) * 100 * w.lab) +
    ((p.assignment_scores / 10) * 100 * w.assign) +
    (Math.min((p.study_hours / 168) * 100, 100) * w.study) +
    (p.concept_mastery * w.mastery)
  );
}

function riskBadge(avg: number) {
  if (avg >= 70) return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
  if (avg >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>;
  return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
}

// ── Component ────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [analyticsStudent, setAnalyticsStudent] = useState<{id: string; name: string} | null>(null);
  const [form, setForm] = useState<MetricsForm>(DEFAULT_METRICS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch students (teacher) ───────────────────────────────────────
  const {
    data: students = [],
    isLoading,
  } = useQuery<StudentItem[]>({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/students-list");
      if (error) throw error;
      return data || [];
    },
    enabled: user?.role === "teacher",
  });

  // ── Fetch own performance (student) ────────────────────────────────
  const { data: myPerformance } = useQuery<PerformanceData | null>({
    queryKey: ["my-performance"],
    queryFn: async () => {
      const { data, error } = await apiClient.get(
        `/student-performance/${user?.id}`
      );
      if (error) return null;
      return data;
    },
    enabled: user?.role === "student",
  });

  // ── Save performance mutation ──────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      student_id: string;
      metrics: MetricsForm;
    }) => {
      const { data, error } = await apiClient.post("/student-performance", {
        student_id: payload.student_id,
        ...payload.metrics,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      setEditingStudent(null);
      toast({ title: "Saved!", description: "Student performance updated." });
    },
    onError: (e: Error) => {
      toast({
        title: "Error",
        description: e.message || "Failed to save",
        variant: "destructive",
      });
    },
  });

  // ── Delete student mutation ────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await apiClient.delete(`/students/${studentId}`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students-list"] });
      toast({ title: "Student deleted" });
    },
    onError: (e: Error) => {
      toast({
        title: "Error",
        description: e.message || "Failed to delete student",
        variant: "destructive",
      });
    },
  });

  // ── Open edit dialog ───────────────────────────────────────────────
  const openEdit = (student: StudentItem) => {
    const p = student.performance;
    setForm(
      p
        ? {
            student_marks: p.student_marks,
            attendance: p.attendance,
            internal_assessments: p.internal_assessments,
            lab_performance: p.lab_performance,
            assignment_scores: p.assignment_scores,
            study_hours: p.study_hours,
            concept_mastery: p.concept_mastery,
            teacher_remarks: p.teacher_remarks || "",
          }
        : { ...DEFAULT_METRICS }
    );
    setEditingStudent(student);
  };

  // ── Filter students ────────────────────────────────────────────────
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── TEACHER VIEW ───────────────────────────────────────────────────
  if (user?.role === "teacher") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2
              className="text-3xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Student Analytics
            </h2>
            <p className="text-muted-foreground">
              View all students, enter marks, attendance and performance data
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="rounded-lg bg-blue-100 p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{students.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Total Students
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="rounded-lg bg-green-100 p-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {students.filter((s) => s.performance).length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Marks Entered
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="rounded-lg bg-red-100 p-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {
                      students.filter(
                        (s) => s.performance && averageScore(s.performance) < 50
                      ).length
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    At Risk Students
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Student list */}
          {isLoading ? (
            <p className="text-muted-foreground">Loading students...</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {students.length === 0
                    ? "No students have signed up yet."
                    : "No students match your search."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((student) => {
                const perf = student.performance;
                const avg = perf ? averageScore(perf) : null;
                const isExpanded = expandedId === student.id;

                return (
                  <Card key={student.id} className="transition-all">
                    {/* Collapsed row */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : student.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {perf ? (
                          <>
                            <span className="text-sm font-semibold">
                              Avg: {avg}%
                            </span>
                            {riskBadge(avg!)}
                          </>
                        ) : (
                          <Badge variant="outline">No data</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(student);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          {perf ? "Edit" : "Enter Marks"}
                        </Button>
                        {perf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log(`📊 Analytics clicked for:`, {
                                studentName: student.name,
                                studentId: student.id,
                                hasPerformanceData: !!perf
                              });
                              setAnalyticsStudent({ id: student.id, name: student.name });
                            }}
                          >
                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                            Analytics
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${student.name}? This will remove all their submissions and data permanently.`)) {
                              deleteMutation.mutate(student.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && perf && (
                      <CardContent className="border-t pt-4 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <MetricPill label="Marks" value={perf.student_marks} />
                          <MetricPill label="Attendance" value={perf.attendance} />
                          <MetricPill
                            label="Internals"
                            value={perf.internal_assessments}
                            max={20}
                          />
                          <MetricPill
                            label="Lab"
                            value={perf.lab_performance}
                            max={25}
                          />
                          <MetricPill
                            label="Assignments"
                            value={perf.assignment_scores}
                            max={10}
                          />
                          <MetricPill
                            label="Study hrs/wk"
                            value={perf.study_hours}
                            max={40}
                          />
                          <MetricPill
                            label="Mastery"
                            value={perf.concept_mastery}
                          />
                        </div>
                        {perf.teacher_remarks && (
                          <p className="mt-3 text-sm text-muted-foreground italic">
                            Remarks: {perf.teacher_remarks}
                          </p>
                        )}
                      </CardContent>
                    )}
                    {isExpanded && !perf && (
                      <CardContent className="border-t pt-4 pb-4 text-sm text-muted-foreground">
                        No performance data entered yet. Click "Enter Marks" to
                        add.
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Edit Dialog ───────────────────────────────────────── */}
          <Dialog
            open={!!editingStudent}
            onOpenChange={(open) => !open && setEditingStudent(null)}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent?.performance ? "Edit" : "Enter"} Marks —{" "}
                  {editingStudent?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Field
                  label="Student Marks (0-100)"
                  value={form.student_marks}
                  onChange={(v) => setForm({ ...form, student_marks: v })}
                />
                <Field
                  label="Attendance (0-100)"
                  value={form.attendance}
                  onChange={(v) => setForm({ ...form, attendance: v })}
                />
                <Field
                  label="Internal Assessments (0-20)"
                  value={form.internal_assessments}
                  onChange={(v) =>
                    setForm({ ...form, internal_assessments: v })
                  }
                  max={20}
                />
                <Field
                  label="Lab Performance (0-25)"
                  value={form.lab_performance}
                  onChange={(v) => setForm({ ...form, lab_performance: v })}
                  max={25}
                />
                <Field
                  label="Assignment Scores (0-10)"
                  value={form.assignment_scores}
                  onChange={(v) => setForm({ ...form, assignment_scores: v })}
                  max={10}
                />
                <Field
                  label="Study Hours / Week"
                  value={form.study_hours}
                  onChange={(v) => setForm({ ...form, study_hours: v })}
                  max={168}
                />
                <Field
                  label="Concept Mastery (0-100)"
                  value={form.concept_mastery}
                  onChange={(v) => setForm({ ...form, concept_mastery: v })}
                />
              </div>
              <div className="mt-2 space-y-1.5">
                <Label>Teacher Remarks</Label>
                <Textarea
                  value={form.teacher_remarks}
                  onChange={(e) =>
                    setForm({ ...form, teacher_remarks: e.target.value })
                  }
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
              <Button
                className="w-full mt-4"
                disabled={saveMutation.isPending}
                onClick={() =>
                  editingStudent &&
                  saveMutation.mutate({
                    student_id: editingStudent.id,
                    metrics: form,
                  })
                }
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Performance Data"}
              </Button>
            </DialogContent>
          </Dialog>

          {/* ── Analytics Modal ────────────────────────────────────── */}
          {analyticsStudent && (
            <StudentAnalyticsModal
              isOpen={!!analyticsStudent}
              onClose={() => setAnalyticsStudent(null)}
              studentId={analyticsStudent.id}
              studentName={analyticsStudent.name}
            />
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── STUDENT VIEW ───────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            My Analytics
          </h2>
          <p className="text-muted-foreground">
            Your performance data as entered by your teacher
          </p>
        </div>

        {myPerformance ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="Marks" value={myPerformance.student_marks} />
              <MetricCard label="Attendance" value={myPerformance.attendance} />
              <MetricCard
                label="Internals"
                value={myPerformance.internal_assessments}
                max={20}
              />
              <MetricCard
                label="Lab"
                value={myPerformance.lab_performance}
                max={25}
              />
              <MetricCard
                label="Assignments"
                value={myPerformance.assignment_scores}
                max={10}
              />
              <MetricCard
                label="Study hrs/wk"
                value={myPerformance.study_hours}
                max={40}
              />
              <MetricCard
                label="Mastery"
                value={myPerformance.concept_mastery}
              />
              <MetricCard
                label="Average"
                value={averageScore(myPerformance)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Overall Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-lg font-semibold">
                  Average: {averageScore(myPerformance)}%
                </span>
                {riskBadge(averageScore(myPerformance))}
              </CardContent>
            </Card>

            {myPerformance.teacher_remarks && (
              <Card>
                <CardHeader>
                  <CardTitle>Teacher Remarks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{myPerformance.teacher_remarks}</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-yellow-900 mb-2">
                    No Performance Data Yet
                  </p>
                  <p className="text-sm text-yellow-800">
                    Your teacher has not entered your marks yet. Once they do,
                    your analytics will appear here automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function MetricPill({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">
        {value}
        {max === 100 ? "%" : ""}
      </p>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70
      ? "from-green-50 to-green-100 text-green-700"
      : pct >= 50
      ? "from-yellow-50 to-yellow-100 text-yellow-700"
      : "from-red-50 to-red-100 text-red-700";
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-2xl font-bold">
        {value}
        {max === 100 ? "%" : ""}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-white/40 overflow-hidden">
        <div
          className="h-full bg-current rounded-full opacity-60"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
