import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Attendance() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionId, setSessionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState("present");
  const [bulkText, setBulkText] = useState("");
  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", user?.id],
    enabled: role === "student" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/attendance/summary/${user?.id}`);
      if (error) throw error;
      return data as { total_sessions: number; present: number; absent: number; late: number; attendance_percentage: number };
    },
  });
  const createSession = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.post("/attendance/sessions", { title, session_date: sessionDate });
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (data) => { setSessionId(data.id); toast({ title: "Attendance session created" }); },
    onError: (error: Error) => toast({ title: "Could not create session", description: error.message, variant: "destructive" }),
  });
  const record = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post(`/attendance/sessions/${sessionId}/records`, { student_id: studentId, status });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Attendance saved" }),
    onError: (error: Error) => toast({ title: "Could not save attendance", description: error.message, variant: "destructive" }),
  });
  const bulkRecord = useMutation({
    mutationFn: async () => {
      const records = bulkText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
        const [bulkStudentId, bulkStatus = "present", ...note] = line.split(",").map((part) => part.trim());
        return { student_id: bulkStudentId, status: bulkStatus, note: note.join(",") };
      });
      const { data, error } = await apiClient.post(`/attendance/sessions/${sessionId}/records/bulk`, { records });
      if (error) throw error;
      return data as { updated: number };
    },
    onSuccess: (data) => { setBulkText(""); toast({ title: `${data.updated} attendance records saved` }); },
    onError: (error: Error) => toast({ title: "Could not save bulk attendance", description: error.message, variant: "destructive" }),
  });
  const sessionSummary = useQuery({
    queryKey: ["attendance-session-summary", sessionId],
    enabled: role === "teacher" && !!sessionId,
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/attendance/sessions/${sessionId}/summary`);
      if (error) throw error;
      return data as { total_records: number; present: number; absent: number; late: number; attendance_percentage: number };
    },
  });
  const engagementSummary = useQuery({
    queryKey: ["engagement-summary", user?.id],
    enabled: role === "student" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await apiClient.get("/engagement/summary");
      if (error) throw error;
      return data as { submissions: number; graded_submissions: number; average_score: number | null; chatbot_activity_status: string };
    },
  });
  return <DashboardLayout><div className="space-y-6 max-w-3xl"><div><h1 className="text-2xl font-bold">Attendance</h1><p className="text-muted-foreground">Track sessions and calculate attendance from recorded status.</p></div>{role === "teacher" ? <><Card><CardHeader><CardTitle>Create session</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Session title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Data Structures - Lecture 1" /></div><div><Label>Date</Label><Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /></div></div><Button disabled={!title || createSession.isPending} onClick={() => createSession.mutate()}>Create session</Button>{sessionId && <p className="text-sm text-muted-foreground">Session ID: {sessionId}</p>}</CardContent></Card><Card><CardHeader><CardTitle>Record students</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Student ID</Label><Input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Student user ID" /></div><div><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="present">Present</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="absent">Absent</SelectItem></SelectContent></Select></div><Button disabled={!sessionId || !studentId || record.isPending} onClick={() => record.mutate()}>Save attendance</Button><div className="space-y-2 border-t pt-4"><Label htmlFor="bulk-attendance">Bulk records (one per line: student ID, status, note)</Label><textarea id="bulk-attendance" className="min-h-24 w-full rounded-md border bg-background p-2 text-sm" value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder="student-1, present\nstudent-2, absent, sick" /><Button variant="outline" disabled={!sessionId || !bulkText.trim() || bulkRecord.isPending} onClick={() => bulkRecord.mutate()}>Save bulk attendance</Button></div>{sessionId && <p className="text-sm text-muted-foreground">Session summary: {sessionSummary.data?.present ?? 0} present, {sessionSummary.data?.absent ?? 0} absent, {sessionSummary.data?.late ?? 0} late ({sessionSummary.data?.attendance_percentage ?? 0}%)</p>}</CardContent></Card></> : <><Card><CardHeader><CardTitle>My attendance</CardTitle></CardHeader><CardContent>{summaryQuery.isLoading ? <p>Loading...</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-5"><div><b>{summaryQuery.data?.attendance_percentage ?? 0}%</b><p className="text-xs text-muted-foreground">Attendance</p></div><div><b>{summaryQuery.data?.total_sessions ?? 0}</b><p className="text-xs text-muted-foreground">Sessions</p></div><div><b>{summaryQuery.data?.present ?? 0}</b><p className="text-xs text-muted-foreground">Present</p></div><div><b>{summaryQuery.data?.late ?? 0}</b><p className="text-xs text-muted-foreground">Late</p></div><div><b>{summaryQuery.data?.absent ?? 0}</b><p className="text-xs text-muted-foreground">Absent</p></div></div>}</CardContent></Card><Card><CardHeader><CardTitle>Engagement summary</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{engagementSummary.data?.submissions ?? 0} submissions, {engagementSummary.data?.graded_submissions ?? 0} graded.</p><p>Average score: {engagementSummary.data?.average_score ?? "N/A"}</p><p className="text-muted-foreground">{engagementSummary.data?.chatbot_activity_status || "Chatbot activity unavailable"}</p></CardContent></Card></>}</div></DashboardLayout>;
}
