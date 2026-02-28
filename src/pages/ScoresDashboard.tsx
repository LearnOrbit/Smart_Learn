import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, BookMarked, Lightbulb, Users } from "lucide-react";

interface ScoreRow {
  po_id: string;
  po_code: string;
  po_score: number;
  co_id: string;
  co_code: string;
  co_score: number;
  lo_id: string;
  lo_code: string;
  lo_score: number;
}

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: any }) {
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium w-16 shrink-0">{label}</span>
      <Progress value={score} className="flex-1 h-2" />
      <span className={`text-sm font-bold w-12 text-right ${color}`}>{score.toFixed(1)}%</span>
    </div>
  );
}

function StudentScoresView({ studentId }: { studentId: string }) {
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["student_scores", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_student_scores", { _student_id: studentId });
      if (error) throw error;
      return (data as ScoreRow[]) || [];
    },
    enabled: !!studentId,
  });

  if (isLoading) return <p className="text-muted-foreground">Calculating scores...</p>;
  if (scores.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        No outcome data available yet. Scores appear once assignments are graded.
      </CardContent>
    </Card>
  );

  // Deduplicate POs, COs, LOs
  const poMap = new Map<string, { code: string; score: number }>();
  const coMap = new Map<string, { code: string; score: number }>();
  const loMap = new Map<string, { code: string; score: number }>();

  scores.forEach((r) => {
    if (!poMap.has(r.po_id)) poMap.set(r.po_id, { code: r.po_code, score: Number(r.po_score) });
    if (!coMap.has(r.co_id)) coMap.set(r.co_id, { code: r.co_code, score: Number(r.co_score) });
    if (!loMap.has(r.lo_id)) loMap.set(r.lo_id, { code: r.lo_code, score: Number(r.lo_score) });
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Program Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...poMap.entries()].map(([id, { code, score }]) => (
            <ScoreBar key={id} label={code} score={score} icon={Target} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookMarked className="h-4 w-4" /> Course Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...coMap.entries()].map(([id, { code, score }]) => (
            <ScoreBar key={id} label={code} score={score} icon={BookMarked} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> Learning Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...loMap.entries()].map(([id, { code, score }]) => (
            <ScoreBar key={id} label={code} score={score} icon={Lightbulb} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScoresDashboard() {
  const { role, user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  // For teachers: fetch all students
  const { data: students = [] } = useQuery({
    queryKey: ["student_profiles"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (error) throw error;

      if (!roles.length) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      if (pErr) throw pErr;
      return profiles || [];
    },
    enabled: role === "teacher",
  });

  if (role === "student") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>My Scores</h2>
            <p className="text-muted-foreground">Your LO, CO, and PO attainment scores</p>
          </div>
          <StudentScoresView studentId={user!.id} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Student Scores</h2>
          <p className="text-muted-foreground">View LO → CO → PO attainment per student</p>
        </div>

        <div className="max-w-xs">
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger>
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s: any) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.full_name || s.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStudent ? (
          <StudentScoresView studentId={selectedStudent} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Select a student to view their scores.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
