import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MoreVertical,
  Plus,
  BookOpen,
  Bell,
  CheckSquare,
  Clock,
  ChevronRight,
  X,
  TrendingUp,
  Bot,
  Megaphone,
  Link,
  Star,
  AlertCircle,
  Users,
  BarChart3,
  Folder,
  Sun,
  Moon,
  Upload,
  FileCheck,
  Loader2,
  Printer,
  Target,
  FileText,
  ClipboardList,
  Pin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getClassrooms, getEnrollments, requestJoinClass, getClassroomMaterials, ClassroomMaterial } from "@/utils/mockClassrooms";

/* ───────────────────────── types ───────────────────────── */
interface ClassData {
  id: string;
  name: string;
  section?: string;
  teacher_name: string;
  subject?: string;
  bannerColor: string;
  cardColor: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
}

interface Assignment {
  id: string;
  classId: string;
  className: string;
  title: string;
  due: string;
  dueMs: number;
  done: boolean;
  isLate?: boolean;
  submittedAt?: number;
  isReal?: boolean;
  totalMarks?: number;
  description?: string;
  questions?: any[];
}

/* ───────────────────────── data helpers ───────────────────────── */
const BANNER_COLORS = [
  { bannerColor: "#1e7e6e", cardColor: "#e0f2f1" }, // teal
  { bannerColor: "#1565c0", cardColor: "#e3f2fd" }, // blue
  { bannerColor: "#6a1b9a", cardColor: "#f3e5f5" }, // purple
  { bannerColor: "#ad1457", cardColor: "#fce4ec" }, // pink-red
  { bannerColor: "#f57f17", cardColor: "#fff8e1" }, // amber
  { bannerColor: "#2e7d32", cardColor: "#e8f5e9" }, // green
  { bannerColor: "#37474f", cardColor: "#eceff1" }, // blue-grey
  { bannerColor: "#bf360c", cardColor: "#fbe9e7" }, // deep orange
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const now = Date.now();

/* ───────────────────────── component ───────────────────────── */
export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassData[]>([
    { id: "1", name: "QA (2025-26)", section: "Section A3", teacher_name: "Subha Yadav", subject: "QA", ...BANNER_COLORS[0] },
    { id: "2", name: "CCL TE A3 (AY 25-26)", section: "Section A3", teacher_name: "Dr. Shobha Lolge", subject: "CCL", ...BANNER_COLORS[1] },
    { id: "3", name: "A3/B3 MC LAB", section: "Lab Section", teacher_name: "Rajnandini Kumawat", subject: "LAB", ...BANNER_COLORS[2] },
    { id: "4", name: "CCL A2 2026", section: "Section A2", teacher_name: "Sonal Bankar", subject: "CCL", ...BANNER_COLORS[3] },
    { id: "5", name: "TE A CSS-26", section: "Section A", teacher_name: "Sonal Bankar", subject: "CSS", ...BANNER_COLORS[4] },
    { id: "6", name: "TEA SPCC", section: "Section A", teacher_name: "Dr. Smita Attarde", subject: "SPCC", ...BANNER_COLORS[5] },
  ]);

  const [assignments] = useState<Assignment[]>([
    { id: "a1", classId: "1", className: "QA (2025-26)", title: "Unit Test – Module 3", due: "Apr 12", dueMs: now + 2 * 86400000, done: false },
    { id: "a2", classId: "2", className: "CCL TE A3", title: "Compiler Lab Assignment #4", due: "Apr 14", dueMs: now + 4 * 86400000, done: false },
    { id: "a3", classId: "5", className: "TE A CSS-26", title: "Mini Project Submission", due: "Apr 10", dueMs: now + 86400000, done: true },
    { id: "a4", classId: "6", className: "TEA SPCC", title: "Quiz – Pipelining", due: "Apr 16", dueMs: now + 6 * 86400000, done: false },
    { id: "a5", classId: "3", className: "A3/B3 MC LAB", title: "Lab Record Submission", due: "Apr 11", dueMs: now + 1 * 86400000, done: false },
  ]);

  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [classToLeave, setClassToLeave] = useState<ClassData | null>(null);
  const [activeTab, setActiveTab] = useState<"todo" | "reviewed">("todo");
  const [localClasses, setLocalClasses] = useState<ClassData[]>([]);
  const [submissionClassId, setSubmissionClassId] = useState<string | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [classroomMode, setClassroomMode] = useState<string | null>(null);
  const [submittedMap, setSubmittedMap] = useState<Record<string, number>>({});
  const [activeClassTab, setActiveClassTab] = useState<"stream" | "scores" | "analytics" | "members" | "files">("stream");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post("/announcements/", {
        title: announceTitle,
        message: announceContent,
        subject_id: classroomMode === "real" ? null : classroomMode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setIsAnnouncing(false);
      setAnnounceTitle("");
      setAnnounceContent("");
      toast({ title: "Announcement posted!" });
    },
    onError: (e: Error) => toast({ title: "Failed to post", description: e.message, variant: "destructive" })
  });

  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);

  const userName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Student";

  useEffect(() => {
    const syncLocalClasses = () => {
      const enrollments = getEnrollments();
      const dbClasses = getClassrooms();
      setMaterials(getClassroomMaterials());

      const enrolledDbClasses = dbClasses.filter(c =>
        enrollments.some(e => e.classroomId === c.id && e.studentName === userName)
      ).map(c => ({
        id: c.id,
        name: c.name,
        section: c.section,
        subject: c.subject,
        teacher_name: c.teacherName,
        bannerColor: c.bannerColor,
        cardColor: c.cardColor,
      }));

      setLocalClasses(enrolledDbClasses);
    };

    syncLocalClasses();
    window.addEventListener("classroomSync", syncLocalClasses);
    window.addEventListener("storage", syncLocalClasses); // Cross-tab native sync
    return () => {
      window.removeEventListener("classroomSync", syncLocalClasses);
      window.removeEventListener("storage", syncLocalClasses);
    };
  }, [userName]);

  /* ── Fetch real published assignments from API ── */
  const { data: realApiAssignments = [] } = useQuery<any[]>({
    queryKey: ["student-assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return data ?? [];   // show ALL assignments to students
    },
    refetchInterval: 30000,
  });

  const { data: announcementsData } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiClient.get("/announcements/"),
  });
  const recentAnnouncements: Announcement[] = (announcementsData?.data?.announcements || []).slice(0, 3);

  // Map real API assignments to the Assignment interface
  const realAssignments: Assignment[] = realApiAssignments.map((a: any) => {
    const dueMs = a.due_date ? new Date(a.due_date).getTime() : Date.now() + 7 * 86400000;
    const dueLabel = a.due_date
      ? new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "No due date";
    const frontendId = `real-${a.id}`;
    const submittedAt = submittedMap[frontendId];
    const isDone = !!submittedAt;
    const isLate = isDone && submittedAt > dueMs;
    return {
      id: frontendId,
      classId: a.subject_id || "real",
      className: a.subject?.name || a.subject_code || "General",
      title: a.title,
      due: dueLabel,
      dueMs,
      done: isDone,
      isLate,
      submittedAt,
      isReal: true,
      totalMarks: a.total_marks,
      description: a.description,
      questions: a.questions || [],
      created_at: a.created_at,
    };
  });

  // Merge: real assignments first, then mock (deduplicate by title)
  const allAssignments = [
    ...realAssignments,
    ...assignments.filter(a => !realAssignments.some(r => r.title === a.title)),
  ];

  const allDisplayClasses = [...classes, ...localClasses];

  const pendingAssignments = allAssignments
    .filter((a) => !a.done)
    .sort((a, b) => a.dueMs - b.dueMs);

  const doneAssignments = allAssignments.filter((a) => a.done);

  /* ── Join class handler ── */
  const handleJoin = () => {
    if (!joinCode.trim()) return;
    const res = requestJoinClass(joinCode.trim(), userName);
    if (res.success) {
      toast({ title: "Success", description: res.msg });
      setJoinCode("");
      setJoinOpen(false);
    } else {
      toast({ title: "Failed to join", description: res.msg, variant: "destructive" });
    }
  };

  /* ── Submit assignment PDF ── */
  const uploadMutation = useMutation({
    mutationFn: async ({ assignmentId, file }: { assignmentId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("student_id", user?.id || "");
      form.append("assignment_id", assignmentId);
      const { data, error } = await apiClient.postFormData("/submit-assignment", form);
      if (error) throw error;
      return { data, frontendId: `real-${assignmentId}` };
    },
    onSuccess: ({ frontendId }) => {
      // Record submission time — keeps assignment visible and computes Late/On-time
      setSubmittedMap(prev => ({ ...prev, [frontendId]: Date.now() }));
      toast({ title: "Submitted! ✓", description: "Your assignment PDF was uploaded. Check the status below." });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  /* ── Leave class handler ── */
  const handleLeaveClass = () => {
    if (!classToLeave) return;
    setClasses((prev) => prev.filter((c) => c.id !== classToLeave.id));
    setClassToLeave(null);
  };

  return (
    <DashboardLayout>
      {/* ── page wrapper ── */}
      <div className="gc-page">

        {/* ══════════════ MAIN CONTENT ══════════════ */}
        <div className="gc-main">

          {/* ────── Main Classroom View (If active) ────── */}
          {classroomMode ? (
            <div className="gc-classroom-view space-y-6">
              {/* Desktop Class Banner (Google Classroom style) */}
              <div
                className="relative overflow-hidden rounded-xl h-48 sm:h-56 flex flex-col justify-end p-6 text-white group"
                style={{ backgroundColor: allDisplayClasses.find(c => c.id === classroomMode)?.bannerColor || "#1e7e6e" }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <Button
                  variant="ghost" size="sm" onClick={() => setClassroomMode(null)}
                  className="absolute top-4 left-4 h-9 w-9 p-0 rounded-full bg-black/20 text-white hover:bg-black/40 z-10"
                >
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </Button>
                <div className="relative z-10">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
                    {allDisplayClasses.find(c => c.id === classroomMode)?.name || "Classroom"}
                  </h1>
                  <p className="text-lg opacity-90 font-medium">
                    {allDisplayClasses.find(c => c.id === classroomMode)?.section} • {allDisplayClasses.find(c => c.id === classroomMode)?.subject}
                  </p>
                </div>
              </div>

              {/* Class Tabs */}
              <div className="flex items-center gap-6 border-b border-slate-200 mt-2 mb-6 px-2 overflow-x-auto hide-scrollbar">
                {[
                  { id: "stream", label: "Stream" },
                  { id: "classwork", label: "Classwork & Files" },
                  { id: "members", label: "People" },
                  { id: "scores", label: "Scores" },
                  { id: "analytics", label: "Analytics" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveClassTab(tab.id as any)}
                    className={`pb-3 text-sm font-medium transition-colors whitespace-nowrap border-b-4 ${
                      activeClassTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeClassTab === "stream" && (
                <div className="grid lg:grid-cols-4 gap-6">
                {/* Left Sidebar: Upcoming (GC Style) */}
                <div className="hidden lg:block space-y-4">
                  <Card className="shadow-none border border-slate-200">
                    <CardHeader className="py-4 px-5">
                      <CardTitle className="text-sm font-semibold">Upcoming</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0">
                      {allAssignments.filter(a => a.classId === classroomMode && !a.done).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Woohoo, no work due soon!</p>
                      ) : (
                        <div className="space-y-3">
                          {allAssignments.filter(a => a.classId === classroomMode && !a.done).slice(0, 3).map(a => (
                            <div key={a.id} className="text-xs">
                              <p className="font-medium hover:underline cursor-pointer">{a.title}</p>
                              <p className="text-slate-400 mt-0.5">Due {a.due}</p>
                            </div>
                          ))}
                          <Button variant="link" className="p-0 h-auto text-xs font-bold text-primary">View all</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Main Activity Feed */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Share with your class box */}
                  {isAnnouncing ? (
                    <Card className="shadow-none border border-slate-200">
                      <CardContent className="p-4 space-y-4">
                        <Input placeholder="Announcement Title (optional)" value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} className="bg-muted/30" />
                        <Textarea placeholder="Announce something to your class" value={announceContent} onChange={e => setAnnounceContent(e.target.value)} className="min-h-[100px] bg-muted/30" />
                        <div className="flex justify-end gap-2">
                           <Button variant="ghost" onClick={() => setIsAnnouncing(false)}>Cancel</Button>
                           <Button onClick={() => createAnnouncementMutation.mutate()} disabled={createAnnouncementMutation.isPending || !announceContent.trim()}>Post</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="shadow-none border border-slate-200 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsAnnouncing(true)}>
                      <CardContent className="py-4 px-5 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
                          {getInitials(userName)}
                        </div>
                        <p className="text-sm text-muted-foreground">Announce something to your class</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* The Feed Items */}
                  {(() => {
                    const allAnns = announcementsData?.data?.announcements || [];
                    const classAssignmentsFeed = allAssignments.filter(a => a.classId === classroomMode).map(a => ({ type: 'assignment' as const, data: a as any, dateMs: a.created_at ? new Date(a.created_at).getTime() : a.dueMs - 86400000 }));
                    const classAnnouncementsFeed = allAnns.filter(a => !a.subject_id || a.subject_id === classroomMode || a.subject_id === 'real').map(a => ({ type: 'announcement' as const, data: a as any, dateMs: new Date(a.created_at).getTime() }));
                    const feedItems = [...classAssignmentsFeed, ...classAnnouncementsFeed].sort((a, b) => b.dateMs - a.dateMs);
                    
                    if (feedItems.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed text-muted-foreground">
                          <Megaphone className="h-10 w-10 mb-2 opacity-20" />
                          <p className="text-sm">This classroom is quiet for now.</p>
                        </div>
                      );
                    }
                    
                    return feedItems.map((item, index) => {
                      if (item.type === 'announcement') {
                        const ann = item.data as Announcement;
                        return (
                          <Card key={`ann-${ann.id || index}`} className="shadow-none border-slate-200">
                            <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-sm sm:text-base font-semibold">{ann.author_name}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(ann.created_at), "MMM d, yyyy")}</p>
                                  </div>
                                </div>
                                <div className="mt-3 text-sm whitespace-pre-wrap">
                                  {ann.title && <p className="font-semibold mb-1">{ann.title}</p>}
                                  {ann.content}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }
                      
                      const a = item.data as Assignment;
                      return (
                        <Card
                          key={a.id}
                          className={`shadow-none transition-colors cursor-pointer ${
                            a.done
                              ? "border-slate-200 bg-slate-50/50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          onClick={() => setViewingAssignment(a)}
                        >
                          <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shrink-0 ${
                              a.isLate ? 'bg-rose-100 text-rose-500' :
                              a.done ? 'bg-emerald-100 text-emerald-600' :
                              'bg-primary/10 text-primary'
                            }`}>
                              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-sm sm:text-base font-semibold truncate">
                                    {allDisplayClasses.find(c => c.id === classroomMode)?.teacher_name} posted a new assignment: {a.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {a.created_at ? format(new Date(a.created_at), "MMM d") : "Posted today"} · Due {a.due}{a.totalMarks ? ` · ${a.totalMarks} marks` : ""}
                                  </p>
                                </div>
                                {/* Status Badge */}
                                {a.done && a.isLate && (
                                  <Badge className="bg-rose-100 text-rose-700 border-none h-5 px-2 text-[10px] font-bold shrink-0">
                                    ⚠ LATE
                                  </Badge>
                                )}
                                {a.done && !a.isLate && (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-none h-5 px-2 text-[10px] font-bold shrink-0">
                                    ✓ SUBMITTED
                                  </Badge>
                                )}
                                {!a.done && a.dueMs < Date.now() && (
                                  <Badge className="bg-rose-50 text-rose-600 border-none h-5 px-2 text-[10px] font-bold shrink-0">
                                    OVERDUE
                                  </Badge>
                                )}
                              </div>

                              {/* Submission timestamp if submitted */}
                              {a.submittedAt && (
                                <p className={`text-[10px] mt-1 font-medium ${a.isLate ? 'text-rose-500' : 'text-emerald-600'}`}>
                                  Submitted {new Date(a.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  {a.isLate ? " (after deadline)" : " (on time)"}
                                </p>
                              )}

                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <Button variant="outline" size="sm" className="h-8 rounded-full text-xs font-semibold px-4 border-slate-300"
                                  onClick={(e) => { e.stopPropagation(); setViewingAssignment(a); }}>
                                  <FileText className="h-3.5 w-3.5 mr-1.5" /> View Paper
                                </Button>
                                {/* Always show submit — allows re-submission */}
                                <Button
                                  variant={a.done ? "ghost" : "ghost"} size="sm"
                                  className={`h-8 rounded-full text-xs font-semibold px-4 ${a.done ? 'text-slate-400 hover:text-primary hover:bg-primary/5' : 'text-primary hover:bg-primary/5'}`}
                                  onClick={(e) => { e.stopPropagation(); document.getElementById(`feed-input-${a.id}`)?.click(); }}
                                  disabled={uploadMutation.isPending}
                                >
                                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                                  {a.done ? "Resubmit" : uploadMutation.isPending ? "Uploading…" : "Submit Work"}
                                  <input
                                    type="file" id={`feed-input-${a.id}`} className="hidden"
                                    onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (f) { e.stopPropagation(); uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f }); }
                                    }}
                                  />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>
              )}

              {activeClassTab === "classwork" && (
                <div className="space-y-4 max-w-4xl mx-auto mt-4 px-2">
                  <h2 className="text-xl font-bold border-b pb-4 mb-4">Classwork & Files</h2>
                  
                  {/* Materials Section */}
                  {materials.filter(m => m.classroomId === classroomMode).length > 0 && (
                    <div className="mb-6 space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Course Materials</h3>
                      {materials.filter(m => m.classroomId === classroomMode).map(mat => (
                        <Card key={mat.id} className="shadow-none border-slate-200 hover:border-primary/50 transition-colors bg-blue-50/30">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-base">{mat.fileName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Uploaded: {new Date(mat.uploadedAt).toLocaleDateString()} • {mat.fileSize}</p>
                              </div>
                            </div>
                            <Button size="sm" onClick={() => navigate("/chatbot", { state: { material: mat, classroom: allDisplayClasses.find(c => c.id === classroomMode) } })}>
                              <Bot className="h-4 w-4 mr-2" /> Chat with PDF
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Assignments Section */}
                  {allAssignments.filter(a => a.classId === classroomMode).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignments</h3>
                      {allAssignments.filter(a => a.classId === classroomMode).map(a => (
                        <Card key={a.id} className="shadow-none border-slate-200 hover:border-primary/50 transition-colors">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <ClipboardList className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-base">{a.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Due: {a.due} {a.totalMarks ? `· ${a.totalMarks} marks` : ""}</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setViewingAssignment(a)}>Open details</Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {allAssignments.filter(a => a.classId === classroomMode).length === 0 && materials.filter(m => m.classroomId === classroomMode).length === 0 && (
                    <p className="text-muted-foreground text-sm italic">No classwork or files posted yet.</p>
                  )}
                </div>
              )}

              {activeClassTab === "members" && (
                <div className="max-w-2xl mx-auto space-y-10 mt-8 px-2">
                  <div>
                    <h2 className="text-2xl font-bold text-primary border-b-2 border-primary/20 pb-3 mb-6">Teachers</h2>
                    <div className="flex justify-between items-center px-2">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg shadow-sm border border-slate-300">
                          {getInitials(allDisplayClasses.find(c => c.id === classroomMode)?.teacher_name || "Teacher")}
                        </div>
                        <p className="font-semibold text-lg">{allDisplayClasses.find(c => c.id === classroomMode)?.teacher_name}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-primary/20 pb-3 mb-6">
                      <h2 className="text-2xl font-bold text-primary">Classmates</h2>
                      <span className="text-muted-foreground font-medium">4 students</span>
                    </div>
                    <div className="space-y-2 px-2">
                      {["Rajnandini Kumawat", "Shrutika Shelar", "Pratiksha Varma", "Srushti Yadav"].map((name, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50/50 rounded-md px-2 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shadow-sm border border-slate-200">
                              {getInitials(name)}
                            </div>
                            <p className="text-sm font-medium">{name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeClassTab === "scores" && (
                <div className="space-y-6 max-w-4xl mx-auto mt-4 px-2">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>My Scores</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: "Overall Average", val: "88%", desc: "Top 15% of class" },
                      { title: "Completed Work", val: `${allAssignments.filter(a => a.classId === classroomMode && a.done).length}/${allAssignments.filter(a => a.classId === classroomMode).length}`, desc: "Assignments submitted" },
                      { title: "Predicted Grade", val: "A", desc: "Keep it up!" }
                    ].map((stat, i) => (
                      <Card key={i} className="border-slate-200/60 shadow-sm border-t-4 border-t-primary/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-muted-foreground">{stat.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-slate-800">{stat.val}</div>
                          <p className="text-xs text-slate-500 mt-1">{stat.desc}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <Card className="shadow-sm border-slate-200 pt-2">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary"/> Graded Assignments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {allAssignments.filter(a => a.classId === classroomMode && a.done).length === 0 ? (
                        <p className="text-muted-foreground text-sm italic py-4 text-center">No graded assignments yet.</p>
                      ) : (
                        allAssignments.filter(a => a.classId === classroomMode && a.done).map(a => (
                          <div key={a.id} className="flex items-center justify-between border-b border-slate-100 pb-4 pt-2 last:border-0 last:pb-0 hover:bg-slate-50 px-2 rounded -mx-2 transition-colors">
                            <div>
                              <p className="font-semibold text-slate-800">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">Submitted: {new Date(a.submittedAt || Date.now()).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border-none">Graded</Badge>
                              <span className="font-black text-lg text-emerald-600">{a.totalMarks ? `${Math.round(a.totalMarks * 0.88)}/${a.totalMarks}` : "85%"}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeClassTab === "analytics" && (
                <div className="space-y-6 max-w-4xl mx-auto mt-4 px-2">
                   <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Learning Efficiency Analytics & Feedback</h2>
                   
                   <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 overflow-hidden relative shadow-sm">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                       <TrendingUp className="h-32 w-32"/>
                     </div>
                     <CardContent className="p-8 sm:p-10 flex flex-col items-center justify-center text-center relative z-10">
                       <Badge className="bg-indigo-100 text-indigo-700 border-none hover:bg-indigo-100 mb-6 uppercase tracking-widest text-[10px] font-black">AI Insights</Badge>
                       <div className="h-36 w-36 rounded-full bg-white shadow-xl flex items-center justify-center mb-6 relative border border-indigo-50">
                         <div className="absolute inset-2 rounded-full border-[10px] border-indigo-600 border-t-indigo-200 border-r-indigo-100 rotate-45"></div>
                         <div className="flex flex-col items-center">
                           <span className="text-4xl font-extrabold text-indigo-900 tracking-tight">72</span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LES Score</span>
                         </div>
                       </div>
                       <h3 className="text-2xl font-bold text-slate-800 mb-2">Steady Learning Velocity</h3>
                       <p className="text-slate-600 max-w-xl text-sm leading-relaxed">
                         Your Learning Efficiency Score (LES) for this subject indicates that your study hours are correlating well with your assignment scores. 
                         You might want to focus your next study session explicitly on <span className="font-semibold text-indigo-700 bg-indigo-100 px-1 rounded">Lab Performance</span>.
                       </p>
                       
                       <Button onClick={() => navigate("/chatbot")} className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-full px-6 transition-transform hover:scale-105">
                         <Target className="h-4 w-4 mr-2" /> Talk to AI Assistant
                       </Button>
                     </CardContent>
                   </Card>

                   <div className="grid md:grid-cols-2 gap-6 mt-8">
                      <Card className="shadow-sm border-rose-100 bg-root overflow-hidden">
                        <div className="h-1 w-full bg-rose-500"></div>
                        <CardHeader className="bg-rose-50/50 pb-4">
                          <CardTitle className="text-base flex items-center gap-2 text-rose-900">
                            <AlertCircle className="h-5 w-5 text-rose-500"/> Needs Attention
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 px-5">
                          <ul className="space-y-3">
                            <li className="text-sm flex flex-col gap-1 p-3 bg-white border border-rose-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>Pipelining Hazards</span> 
                                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">40% mastery</Badge>
                              </div>
                              <Progress value={40} className="h-1.5 mt-2 bg-rose-100" />
                            </li>
                            <li className="text-sm flex flex-col gap-1 p-3 bg-white border border-rose-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>Addressing Modes</span> 
                                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">45% mastery</Badge>
                              </div>
                              <Progress value={45} className="h-1.5 mt-2 bg-rose-100 border-none" />
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-emerald-100 overflow-hidden">
                        <div className="h-1 w-full bg-emerald-500"></div>
                        <CardHeader className="bg-emerald-50/50 pb-4">
                          <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                            <CheckSquare className="h-5 w-5 text-emerald-500"/> Strong Concepts
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 px-5">
                          <ul className="space-y-3">
                            <li className="text-sm flex flex-col gap-1 p-3 bg-white border border-emerald-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>Cache Memory</span> 
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">88% mastery</Badge>
                              </div>
                              <Progress value={88} className="h-1.5 mt-2 bg-emerald-100" />
                            </li>
                            <li className="text-sm flex flex-col gap-1 p-3 bg-white border border-emerald-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>Instruction Sets</span> 
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">85% mastery</Badge>
                              </div>
                              <Progress value={85} className="h-1.5 mt-2 bg-emerald-100" />
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                   </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── Greeting / top bar ── */}
              <div className="gc-topbar">
                <div>
                  <h1 className="gc-greeting">
                    Welcome back, <span className="gc-name">{userName}</span> 👋
                  </h1>
                  <p className="gc-sub">Here are your enrolled classes</p>
                </div>
                <div className="gc-top-actions" style={{ display: 'flex', gap: '12px' }}>
                  <Button
                    className="gc-join-btn"
                    onClick={() => setJoinOpen(true)}
                  >
                    <Plus className="gc-btn-icon" />
                    Join Class
                  </Button>
                </div>
              </div>

              {/* ── Class cards grid ── */}
              <div className="gc-grid">
                {allDisplayClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="gc-card"
                    onClick={() => setSelectedClass(cls)}
                  >
                    {/* Banner */}
                    <div
                      className="gc-card-banner"
                      style={{ backgroundColor: cls.bannerColor }}
                    >
                      <div className="gc-card-banner-content">
                        <div>
                          <h2 className="gc-card-name">{cls.name}</h2>
                          {cls.section && (
                            <p className="gc-card-section">{cls.section}</p>
                          )}
                          <p className="gc-card-teacher">{cls.subject}</p>
                        </div>
                      </div>

                      {/* Three-dot menu */}
                      <div className="gc-card-menu" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="gc-more-btn" title="More options">
                              <MoreVertical className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="gc-dropdown">
                            <DropdownMenuItem className="gc-dd-item"
                              onClick={() => { setClassroomMode(cls.id); setSelectedClass(null); }}>
                              <BookOpen className="h-4 w-4" /> Open Classroom
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gc-dd-item"
                              onClick={() => navigate("/analytics")}>
                              <TrendingUp className="h-4 w-4" /> Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gc-dd-item"
                              onClick={() => navigate("/chatbot")}>
                              <Bot className="h-4 w-4" /> AI Assistant
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gc-dd-item"
                              onClick={() => navigate("/announcements")}>
                              <Megaphone className="h-4 w-4" /> Announcements
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gc-dd-item gc-dd-copy">
                              <Link className="h-4 w-4" /> Copy class link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gc-dd-item gc-dd-leave"
                              onClick={(e) => { e.stopPropagation(); setClassToLeave(cls); }}>
                              <X className="h-4 w-4" /> Unenroll
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Teacher avatar – bottom-left */}
                      <div className="gc-teacher-avatar">
                        <span>{getInitials(cls.teacher_name)}</span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="gc-card-body" style={{ backgroundColor: cls.cardColor }}>
                      <p className="gc-card-teacher-name">{cls.teacher_name}</p>

                      {/* Bottom icon row */}
                      <div className="gc-card-footer">
                        <div className="gc-card-icons">
                          <button className="gc-icon-btn" title="Notifications"
                            onClick={(e) => { e.stopPropagation(); }}>
                            <Bell className="h-5 w-5" />
                          </button>
                          <button className="gc-icon-btn" title="Files"
                            onClick={(e) => { e.stopPropagation(); }}>
                            <Folder className="h-5 w-5" />
                          </button>
                          <button className="gc-icon-btn" title="Members"
                            onClick={(e) => e.stopPropagation()}>
                            <Users className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="gc-card-icons">
                          <button className="gc-icon-btn" title="Scores"
                            onClick={(e) => { e.stopPropagation(); navigate("/scores"); }}>
                            <BarChart3 className="h-5 w-5" />
                          </button>
                          <button className="gc-icon-btn" title="Analytics"
                            onClick={(e) => { e.stopPropagation(); navigate("/analytics"); }}>
                            <TrendingUp className="h-5 w-5" />
                          </button>
                          <button className="gc-icon-btn" title="Announcements"
                            onClick={(e) => { e.stopPropagation(); navigate("/announcements"); }}>
                            <Megaphone className="h-5 w-5" />
                          </button>
                          <button className="gc-icon-btn" title="AI Assistant"
                            onClick={(e) => { e.stopPropagation(); navigate("/chatbot"); }}>
                            <Bot className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ══════════════ RIGHT SIDEBAR ══════════════ */}
        <aside className="gc-sidebar">

          {/* ── To-do widget ── */}
          <div className="gc-widget">
            {/* Tabs */}
            <div className="gc-widget-tabs">
              <button
                className={`gc-tab ${activeTab === "todo" ? "gc-tab-active" : ""}`}
                onClick={() => setActiveTab("todo")}
              >
                To do
              </button>
              <button
                className={`gc-tab ${activeTab === "reviewed" ? "gc-tab-active" : ""}`}
                onClick={() => setActiveTab("reviewed")}
              >
                Reviewed
              </button>
            </div>

            {/* Todo list */}
            <div className="gc-todo-list">
              {activeTab === "todo" && (
                pendingAssignments.length === 0 ? (
                  <div className="gc-empty">
                    <CheckSquare className="h-10 w-10 gc-empty-icon" />
                    <p>No work due. Enjoy your day!</p>
                  </div>
                ) : (
                  pendingAssignments.map((a) => (
                    <div key={a.id} className={`gc-todo-item ${a.isReal ? "border-l-2 border-primary/50 pl-2" : ""}`}>
                      <div className="gc-todo-icon-wrap">
                        <AlertCircle className="h-4 w-4 gc-todo-icon" />
                      </div>
                      <div className="gc-todo-info" style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <p className="gc-todo-title">{a.title}</p>
                          {a.isReal && (
                            <span style={{ fontSize: "10px", background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))", borderRadius: "4px", padding: "1px 5px", fontWeight: 600 }}>NEW</span>
                          )}
                        </div>
                        <p className="gc-todo-class">{a.className}</p>
                        {a.description && (
                          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "2px", lineHeight: "1.4" }}>{a.description}</p>
                        )}
                        <div className="gc-todo-due" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Clock className="h-3 w-3" />
                          <span>Due {a.due}</span>
                          {a.totalMarks && <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>· {a.totalMarks} marks</span>}
                        </div>
                        {a.isReal && (
                          <div style={{ marginTop: "6px" }}>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              style={{ display: "none" }}
                              id={`submit-${a.id}`}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f });
                              }}
                            />
                            <button
                              onClick={() => document.getElementById(`submit-${a.id}`)?.click()}
                              style={{
                                fontSize: "11px", fontWeight: 600,
                                background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))",
                                border: "1px solid hsl(var(--primary)/0.3)", borderRadius: "6px",
                                padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px"
                              }}
                            >
                              <Upload className="h-3 w-3" /> Submit PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === "reviewed" && (
                doneAssignments.length === 0 ? (
                  <div className="gc-empty">
                    <Star className="h-10 w-10 gc-empty-icon" />
                    <p>No reviewed work yet.</p>
                  </div>
                ) : (
                  doneAssignments.map((a) => (
                    <div key={a.id} className="gc-todo-item gc-todo-done">
                      <div className="gc-todo-icon-wrap gc-done-icon-wrap">
                        <CheckSquare className="h-4 w-4 gc-done-icon" />
                      </div>
                      <div className="gc-todo-info">
                        <p className="gc-todo-title">{a.title}</p>
                        <p className="gc-todo-class">{a.className}</p>
                        <span className="gc-badge-done">Submitted</span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          {/* ── Upcoming widget ── */}
          <div className="gc-widget gc-upcoming">
            <h3 className="gc-widget-title">
              <Clock className="h-4 w-4" /> Upcoming
            </h3>
            {pendingAssignments.slice(0, 3).map((a) => (
              <div key={a.id} className="gc-upcoming-item">
                <div className="gc-upcoming-dot" />
                <div>
                  <p className="gc-upcoming-name">{a.title}</p>
                  <p className="gc-upcoming-meta">{a.className} · Due {a.due}</p>
                </div>
              </div>
            ))}
            {pendingAssignments.length === 0 && (
              <p className="gc-upcoming-empty">No upcoming work 🎉</p>
            )}
          </div>

          {/* ── Recent Announcements widget ── */}
          <div className="gc-widget gc-upcoming">
            <h3 className="gc-widget-title text-primary">
              <Megaphone className="h-4 w-4" /> Announcements
            </h3>
            {recentAnnouncements.length === 0 ? (
              <p className="gc-upcoming-empty">No announcements yet.</p>
            ) : (
              <div className="space-y-4">
                {recentAnnouncements.map((ann) => (
                  <div key={ann.id} className="border-l-2 border-primary/40 pl-3">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-sm line-clamp-1 flex-1">{ann.title}</p>
                      {ann.pinned && <Pin className="h-3 w-3 text-primary shrink-0 ml-1" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ann.content}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">
                      {ann.author_name} · {format(new Date(ann.created_at), "MMM d")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full text-xs mt-3 text-primary bg-primary/5 hover:bg-primary/10" onClick={() => navigate("/announcements")}>
              View all announcements
            </Button>
          </div>
        </aside>
      </div>

      {/* ══════════════ CLASS DETAIL MODAL ══════════════ */}
      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className="gc-modal">
          <DialogHeader>
            <DialogTitle className="gc-modal-title">
              {selectedClass?.name}
            </DialogTitle>
            <DialogDescription className="gc-modal-desc">
              {selectedClass?.section} · {selectedClass?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedClass && (
            <div className="gc-modal-body">
              {/* Banner */}
              <div
                className="gc-modal-banner"
                style={{ backgroundColor: selectedClass.bannerColor }}
              >
                <BookOpen className="h-14 w-14 text-white/40" />
                <div>
                  <h3 className="gc-modal-class-name">{selectedClass.name}</h3>
                  <p className="gc-modal-class-sub">{selectedClass.section}</p>
                </div>
              </div>

              {/* Teacher */}
              <div className="gc-modal-teacher-row">
                <div className="gc-modal-avatar">
                  {getInitials(selectedClass.teacher_name)}
                </div>
                <div>
                  <p className="gc-modal-teacher">{selectedClass.teacher_name}</p>
                  <p className="gc-modal-role">Class Teacher</p>
                </div>
              </div>

              {/* Stats */}
              <div className="gc-modal-stats">
                {[
                  { label: "Students", value: "32" },
                  { label: "Assignments", value: "8" },
                  { label: "Submitted", value: "5" },
                ].map((s) => (
                  <div key={s.label} className="gc-stat-card">
                    <p className="gc-stat-val">{s.value}</p>
                    <p className="gc-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Submission Panel */}
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Submit Assignment
                </p>
                {pendingAssignments.filter(a => a.classId === selectedClass?.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pending assignments for this class.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingAssignments.filter(a => a.classId === selectedClass?.id).map(a => (
                      <div key={a.id} className="flex flex-col rounded-lg border p-3 text-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{a.title}</p>
                            <p className="text-xs text-muted-foreground font-medium">Due {a.due} {a.totalMarks ? `· ${a.totalMarks}m` : ""}</p>
                          </div>
                          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer" onClick={() => setViewingAssignment(a)}>
                            <FileText className="h-3 w-3 mr-1" /> View Paper
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            id={`file-${a.id}`}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f });
                            }}
                          />
                          <label htmlFor={`file-${a.id}`} className="flex-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-8"
                              asChild
                              disabled={uploadMutation.isPending}
                            >
                              <span className="cursor-pointer">
                                {uploadMutation.isPending
                                  ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                                  : <><Upload className="h-3 w-3 mr-1.5" />Submit PDF Solution</>
                                }
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="gc-modal-actions">
                <Button className="gc-primary-btn" onClick={() => { setClassroomMode(selectedClass.id); setSelectedClass(null); }}>
                  Open Classroom <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gc-secondary-btn"
                  onClick={() => { setSelectedClass(null); navigate("/announcements"); }}>
                  Announcements
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════ JOIN CLASS MODAL ══════════════ */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="gc-modal gc-join-modal">
          <DialogHeader>
            <div className="gc-join-header">
              <DialogTitle className="gc-modal-title">Join a class</DialogTitle>
              <button className="gc-close-btn" onClick={() => setJoinOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <DialogDescription className="gc-modal-desc">
              Ask your teacher for the class code, then enter it here.
            </DialogDescription>
          </DialogHeader>

          <div className="gc-join-body">
            <p className="gc-join-hint">Class code</p>
            <input
              className="gc-join-input"
              placeholder="e.g. abc123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <p className="gc-join-note">
              Use a class code that's 5–7 letters or numbers with no spaces or symbols.
            </p>
            <div className="gc-join-actions">
              <Button variant="outline" className="gc-secondary-btn" onClick={() => setJoinOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gc-primary-btn"
                disabled={!joinCode.trim()}
                onClick={handleJoin}
              >
                Join
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════ UNENROLL MODAL ══════════════ */}
      <Dialog open={!!classToLeave} onOpenChange={(open) => !open && setClassToLeave(null)}>
        <DialogContent className="gc-modal gc-join-modal">
          <DialogHeader>
            <div className="gc-join-header">
              <DialogTitle className="gc-modal-title">Unenroll</DialogTitle>
              <button className="gc-close-btn" onClick={() => setClassToLeave(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <DialogDescription className="gc-modal-desc mt-2">
              Are you sure you want to unenroll from {classToLeave?.name}? You will be removed from this class.
            </DialogDescription>
          </DialogHeader>

          <div className="gc-join-body pt-2">
            <div className="gc-join-actions mt-4">
              <Button variant="outline" className="gc-secondary-btn" onClick={() => setClassToLeave(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="gc-primary-btn bg-red-600 hover:bg-red-700"
                onClick={handleLeaveClass}
              >
                Unenroll
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════ SCOPED STYLES ══════════════ */}
      <style>{`
        /* ── Layout ── */
        .gc-page {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          min-height: 100%;
          font-family: var(--font-body), 'Roboto', sans-serif;
          background: transparent;
        }
        .gc-main { flex: 1; min-width: 0; }
        .gc-sidebar {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        @media (max-width: 960px) {
          .gc-page { flex-direction: column; }
          .gc-sidebar { width: 100%; }
        }

        /* ── Top bar ── */
        .gc-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .gc-greeting {
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0;
        }
        .gc-name { color: hsl(var(--primary)); }
        .gc-sub { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 4px 0 0; }
        .gc-join-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 24px;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,.15);
          transition: filter .2s, box-shadow .2s;
        }
        .gc-join-btn:hover { filter: brightness(0.9); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
        .gc-btn-icon { width: 18px; height: 18px; }

        /* ── Grid ── */
        .gc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        /* ── Class card ── */
        .gc-card {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.08);
          cursor: pointer;
          transition: box-shadow .2s, transform .2s;
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
        }
        .gc-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
          transform: translateY(-2px);
        }

        /* Banner */
        .gc-card-banner {
          position: relative;
          height: 100px;
          padding: 16px;
          overflow: hidden;
        }
        .gc-card-banner::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.1) 0%, transparent 60%);
        }
        .gc-card-banner-content {
          position: relative;
          z-index: 1;
        }
        .gc-card-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 2px;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .gc-card-section {
          font-size: 0.78rem;
          color: rgba(255,255,255,.85);
          margin: 0;
        }
        .gc-card-teacher {
          font-size: 0.82rem;
          color: rgba(255,255,255,.9);
          margin: 2px 0 0;
          font-weight: 600;
          letter-spacing: .4px;
          text-transform: uppercase;
        }

        /* Three-dot menu */
        .gc-card-menu {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 10;
        }
        .gc-more-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,.2);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background .15s;
        }
        .gc-more-btn:hover { background: rgba(255,255,255,.3); }

        /* Teacher avatar */
        .gc-teacher-avatar {
          position: absolute;
          bottom: -20px;
          left: 16px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: hsl(var(--card));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: hsl(var(--foreground));
          box-shadow: 0 2px 6px rgba(0,0,0,.15);
          border: 3px solid hsl(var(--card));
          z-index: 2;
        }

        /* Card body */
        .gc-card-body {
          padding: 28px 16px 12px;
          min-height: 80px;
          background: hsl(var(--card));
        }
        .gc-card-teacher-name {
          font-size: 0.82rem;
          color: hsl(var(--muted-foreground));
          margin: 0 0 12px;
          padding-left: 56px;
        }
        .gc-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid hsl(var(--border));
          padding-top: 10px;
          margin-top: 4px;
        }
        .gc-card-icons { display: flex; gap: 4px; }
        .gc-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: hsl(var(--muted-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background .15s;
        }
        .gc-icon-btn:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }

        .gc-open-btn {
          display: flex;
          align-items: center;
          gap: 2px;
          border: none;
          background: transparent;
          color: hsl(var(--primary));
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 4px;
          transition: background .15s;
        }
        .gc-open-btn:hover { background: hsla(var(--primary), 0.1); }

        /* ── Dropdown ── */
        .gc-dropdown {
          background: hsl(var(--popover));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,.15);
          min-width: 180px;
          padding: 4px;
        }
        .gc-dd-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          cursor: pointer;
          transition: background .15s;
          border-radius: 4px;
        }
        .gc-dd-item:hover { background: hsl(var(--muted)); }
        .gc-dd-copy { color: hsl(var(--muted-foreground)); }
        .gc-dd-leave { color: hsl(var(--destructive)); }
        .gc-dd-leave:hover { background: hsla(var(--destructive), 0.1); color: hsl(var(--destructive)); }

        /* ── Sidebar widget ── */
        .gc-widget {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
          color: hsl(var(--foreground));
        }
        .gc-widget-tabs {
          display: flex;
          border-bottom: 1px solid hsl(var(--border));
        }
        .gc-tab {
          flex: 1;
          padding: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: color .15s, border-color .15s, background .15s;
          text-align: center;
        }
        .gc-tab:hover { color: hsl(var(--primary)); background: hsla(var(--primary), 0.05); }
        .gc-tab-active { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); }

        /* Todo list */
        .gc-todo-list { padding: 8px 0; max-height: 360px; overflow-y: auto; }
        .gc-todo-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid hsl(var(--border));
          transition: background .15s;
          cursor: pointer;
        }
        .gc-todo-item:hover { background: hsl(var(--muted)); }
        .gc-todo-item:last-child { border-bottom: none; }
        .gc-todo-done { opacity: .7; }
        .gc-todo-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: hsla(var(--destructive), 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .gc-done-icon-wrap { background: hsla(142, 71%, 45%, 0.1); }
        .gc-todo-icon { color: hsl(var(--destructive)); }
        .gc-done-icon { color: hsl(142, 71%, 45%); }
        .gc-todo-info { flex: 1; min-width: 0; }
        .gc-todo-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin: 0 0 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gc-todo-class { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin: 0 0 4px; }
        .gc-todo-due {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          color: hsl(var(--destructive));
          font-weight: 600;
        }
        .gc-badge-done {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          color: hsl(142, 71%, 45%);
          background: hsla(142, 71%, 45%, 0.1);
          padding: 2px 8px;
          border-radius: 12px;
        }
        .gc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 32px 16px;
          color: hsl(var(--muted-foreground));
          font-size: 0.82rem;
          text-align: center;
        }
        .gc-empty-icon { color: hsl(var(--muted-foreground)); opacity: 0.5; }

        /* Upcoming */
        .gc-upcoming { padding: 16px; }
        .gc-widget-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0 0 12px;
        }
        .gc-upcoming-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid hsl(var(--border));
        }
        .gc-upcoming-item:last-child { border-bottom: none; }
        .gc-upcoming-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: hsl(var(--primary));
          flex-shrink: 0;
          margin-top: 5px;
        }
        .gc-upcoming-name { font-size: 0.8rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0 0 2px; }
        .gc-upcoming-meta { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin: 0; }
        .gc-upcoming-empty { font-size: 0.8rem; color: hsl(var(--muted-foreground)); text-align: center; padding: 8px 0; }

        /* ── Modal ── */
        .gc-modal {
          background: hsl(var(--card));
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          box-shadow: 0 12px 40px rgba(0,0,0,.2);
          padding: 0;
          max-width: 540px;
          overflow: hidden;
          color: hsl(var(--card-foreground));
        }
        .gc-modal-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          padding: 24px 24px 0;
        }
        .gc-modal-desc {
          font-size: 0.85rem;
          color: hsl(var(--muted-foreground));
          padding: 4px 24px 0;
        }
        .gc-modal-body { padding: 0; }
        .gc-modal-banner {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          margin: 16px 24px;
          border-radius: 10px;
          color: #fff;
        }
        .gc-modal-class-name { font-size: 1.2rem; font-weight: 700; margin: 0 0 4px; }
        .gc-modal-class-sub { font-size: 0.85rem; color: rgba(255,255,255,.8); margin: 0; }

        .gc-modal-teacher-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 24px 16px;
        }
        .gc-modal-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .gc-modal-teacher { font-size: 0.9rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0; }
        .gc-modal-role { font-size: 0.78rem; color: hsl(var(--muted-foreground)); margin: 0; }

        .gc-modal-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 0 24px 20px;
        }
        .gc-stat-card {
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 14px;
          text-align: center;
        }
        .gc-stat-val { font-size: 1.5rem; font-weight: 700; color: hsl(var(--primary)); margin: 0 0 4px; }
        .gc-stat-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin: 0; }

        .gc-modal-actions {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          border-top: 1px solid hsl(var(--border));
        }
        .gc-primary-btn {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 6px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border: none;
          cursor: pointer;
          transition: filter .2s;
          flex: 1;
          justify-content: center;
        }
        .gc-primary-btn:hover { filter: brightness(0.9); }
        .gc-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .gc-secondary-btn {
          border: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
          border-radius: 6px;
          font-weight: 600;
          padding: 10px 20px;
          background: transparent;
          cursor: pointer;
          transition: background .2s;
          flex: 1;
          text-align: center;
        }
        .gc-secondary-btn:hover { background: hsl(var(--muted)); }

        /* Join class modal */
        .gc-join-modal { max-width: 440px; }
        .gc-join-header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
        .gc-close-btn {
          width: 36px; height: 36px; border-radius: 50%; border: none;
          background: transparent; color: hsl(var(--muted-foreground)); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s;
        }
        .gc-close-btn:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }
        .gc-join-body { padding: 12px 24px 24px; display: flex; flex-direction: column; gap: 10px; }
        .gc-join-hint { font-size: 0.78rem; font-weight: 700; color: hsl(var(--muted-foreground)); letter-spacing: .5px; text-transform: uppercase; margin: 0; }
        .gc-join-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid hsl(var(--border));
          background: transparent;
          border-radius: 6px;
          font-size: 1rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color .2s;
          font-family: monospace;
          letter-spacing: 2px;
        }
        .gc-join-input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsla(var(--primary), 0.15); }
        .gc-join-note { font-size: 0.78rem; color: hsl(var(--muted-foreground)); margin: 0; line-height: 1.5; }
        .gc-join-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
        .gc-join-actions .gc-primary-btn { flex: unset; padding: 10px 24px; }
      `}</style>
      {/* ══════════════ VIEW ASSIGNMENT PAPER ══════════════ */}
      <Dialog open={!!viewingAssignment} onOpenChange={(open) => !open && setViewingAssignment(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none gap-0">
          {viewingAssignment && (
            <div className="bg-white text-slate-900 min-h-full">
              {/* Paper Header */}
              <div className="bg-slate-900 text-white p-8 text-center space-y-2 border-b-4 border-primary">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assignment Question Paper</p>
                <h2 className="text-3xl font-extrabold">{viewingAssignment.title}</h2>
                <p className="text-slate-300 font-medium">{viewingAssignment.className}</p>
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm">
                  <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> <span>Due: <strong>{viewingAssignment.due}</strong></span></div>
                  <div className="flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> <span>Max Marks: <strong>{viewingAssignment.totalMarks || "N/A"}</strong></span></div>
                </div>
              </div>

              {/* Instructions */}
              <div className="px-8 py-4 bg-slate-50 border-b italic text-slate-600 text-sm">
                <strong>Instructions:</strong> Read each question carefully before attempting. Submit your solutions in PDF format before the deadline. Marks for each question are mentioned on the right.
              </div>

              {/* Questions */}
              <div className="p-8 space-y-8">
                {(!viewingAssignment.questions || viewingAssignment.questions.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                    <p>No questions found in this assignment.</p>
                  </div>
                ) : (
                  viewingAssignment.questions.map((q, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <span className="font-bold text-slate-400 w-6 mt-1 text-lg">{idx + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <p className="text-lg leading-relaxed text-slate-800 font-medium">
                          {q.question_text}
                        </p>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-slate-200">
                            {q.marks} Marks
                          </Badge>
                          {q.difficulty && (
                            <Badge className={`text-[10px] font-bold uppercase tracking-wider ${q.difficulty === "hard" ? "bg-rose-100 text-rose-700 border-rose-200" :
                                q.difficulty === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                  "bg-emerald-100 text-emerald-700 border-emerald-200"
                              }`}>
                              {q.difficulty}
                            </Badge>
                          )}
                          {q.co_code && (
                            <span className="text-xs text-slate-400 font-mono">[{q.co_code}]</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-8 bg-slate-50 border-t flex items-center justify-between no-print">
                <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print Paper
                </Button>
                <Button className="font-bold px-6" onClick={() => setViewingAssignment(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
