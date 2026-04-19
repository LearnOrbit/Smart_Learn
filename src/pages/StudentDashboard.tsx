import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreVertical, Plus, BookOpen, Bell, CheckSquare, Clock,
  ChevronRight, X, TrendingUp, Bot, Megaphone, Link, Star,
  AlertCircle, Users, BarChart3, Folder, Upload, FileCheck,
  Loader2, Printer, Target, FileText, ClipboardList, Pin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  getClassrooms, getEnrollments, requestJoinClass,
  getClassroomMaterials, ClassroomMaterial, leaveClassroom,
} from "@/utils/mockClassrooms";

/* ─── Types ─── */
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
  classroom_id?: string;
  classroom_name?: string;
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
  created_at?: string;
  classroom_id?: string;
  // Submission tracking (from /api/student/assignments)
  submission_status?: "pending" | "submitted" | "graded";
  submission_pdf_path?: string | null;
  submission_id?: string | null;
  score?: number | null;
  submitted_at_iso?: string | null;
}

/* ─── Helpers ─── */
const BANNER_COLORS = [
  { bannerColor: "#1e7e6e", cardColor: "#e0f2f1" },
  { bannerColor: "#1565c0", cardColor: "#e3f2fd" },
  { bannerColor: "#6a1b9a", cardColor: "#f3e5f5" },
  { bannerColor: "#ad1457", cardColor: "#fce4ec" },
  { bannerColor: "#f57f17", cardColor: "#fff8e1" },
  { bannerColor: "#2e7d32", cardColor: "#e8f5e9" },
  { bannerColor: "#37474f", cardColor: "#eceff1" },
  { bannerColor: "#bf360c", cardColor: "#fbe9e7" },
];

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/* ─── Component ─── */
export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [classToLeave, setClassToLeave] = useState<ClassData | null>(null);
  const [activeTab, setActiveTab] = useState<"todo" | "reviewed">("todo");
  const [localClasses, setLocalClasses] = useState<ClassData[]>([]);
  const [submissionClassId, setSubmissionClassId] = useState<string | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [viewingMaterialText, setViewingMaterialText] = useState<{ title: string; content: string } | null>(null);
  const [classroomMode, setClassroomMode] = useState<string | null>(null);
  const [submittedMap, setSubmittedMap] = useState<Record<string, number>>({});
  const [activeClassTab, setActiveClassTab] = useState<"stream" | "classwork" | "scores" | "analytics" | "members">("stream");
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post("/announcements/", {
        title: announceTitle,
        message: announceContent,
        classroom_id: classroomMode,
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
    onError: (e: Error) => toast({ title: "Failed to post", description: e.message, variant: "destructive" }),
  });

  const userName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Student";

  /* ── Sync local (mock) classrooms ── */
  useEffect(() => {
    const syncLocalClasses = () => {
      const enrollments = getEnrollments();
      const dbClasses = getClassrooms();
      setMaterials(getClassroomMaterials());
      const enrolledDbClasses = dbClasses
        .filter((c) =>
          enrollments.some((e) => e.classroomId === c.id && e.studentName === userName)
        )
        .map((c) => ({
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
    window.addEventListener("storage", syncLocalClasses);
    return () => {
      window.removeEventListener("classroomSync", syncLocalClasses);
      window.removeEventListener("storage", syncLocalClasses);
    };
  }, [userName]);

  const allDisplayClasses = [...localClasses];

  /* ── Fetch real published assignments from API ──
     Only fetch assignments whose classroom_id matches one the student has joined.
     Backend filters by status=published; we further filter by classroom membership. */
  const { data: rawApiAssignments = [] } = useQuery<any[]>({
    queryKey: ["student-assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/student/assignments");
      if (error) {
        // Fallback: fetch all and filter client-side if /student/assignments doesn't exist yet
        const fallback = await apiClient.get("/assignments");
        if (fallback.error) throw fallback.error;
        return (fallback.data ?? []).filter((a: any) => a.status === "published");
      }
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  /* ── Fetch announcements — from all classrooms the student is in ── */
  const { data: announcementsData } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: async () => {
      // Try the dedicated student endpoint first
      const res = await apiClient.get("/student/announcements");
      if (!res.error) return res.data ?? [];
      // Fallback to general announcements endpoint
      const fallback = await apiClient.get("/announcements/");
      return fallback.data?.announcements ?? [];
    },
    refetchInterval: 30000,
  });
  const allAnnouncements: Announcement[] = Array.isArray(announcementsData)
    ? announcementsData
    : (announcementsData?.announcements ?? []);

  /* ── Map API assignments → Assignment interface ── */
  const realAssignments: Assignment[] = rawApiAssignments.map((a: any) => {
    const dueMs = a.due_date ? new Date(a.due_date).getTime() : Date.now() + 7 * 86400000;
    const dueLabel = a.due_date
      ? new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "No due date";
    const frontendId = `real-${a.id}`;
    const submittedAt = submittedMap[frontendId] ||
      (a.submitted_at ? new Date(a.submitted_at).getTime() : undefined);
    const isDone = a.submission_status === "submitted" || a.submission_status === "graded" || !!submittedAt;
    const isLate = isDone && submittedAt && submittedAt > dueMs;
    return {
      id: frontendId,
      classId: a.classroom_id || a.subject_id || "real",
      className: a.classroom_name || a.subject_name || a.subject_code || "General",
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
      classroom_id: a.classroom_id,
      // Submission tracking
      submission_status: a.submission_status ?? "pending",
      submission_pdf_path: a.submission_pdf_path ?? null,
      submission_id: a.submission_id ?? null,
      score: a.score ?? null,
      submitted_at_iso: a.submitted_at ?? null,
    };
  });

  /* ── Match assignment to a displayed class ── */
  const isAssignmentForClass = (a: Assignment, targetClassId: string | undefined | null) => {
    if (!targetClassId) return false;
    // Direct classroom_id match (from new AssignmentCreator with classroom selector)
    if (a.classroom_id && a.classroom_id === targetClassId) return true;
    // classId match (mock/legacy)
    if (a.classId === targetClassId) return true;
    // Fuzzy subject name match (legacy fallback)
    if (a.isReal) {
      const targetCls = allDisplayClasses.find((c) => c.id === targetClassId);
      if (targetCls) {
        const cName = targetCls.name?.toLowerCase() || "";
        const cSubj = targetCls.subject?.toLowerCase() || "";
        const aName = a.className?.toLowerCase() || "";
        if (cSubj && (aName === cSubj || aName.includes(cSubj) || cSubj.includes(aName))) return true;
        if (cName && (aName === cName || aName.includes(cName) || cName.includes(aName))) return true;
      }
    }
    return false;
  };

  /* ── Filter to only assignments in student's joined classrooms ── */
  const allAssignments = realAssignments.filter((a) =>
    allDisplayClasses.some((c) => isAssignmentForClass(a, c.id))
  );

  const pendingAssignments = allAssignments
    .filter((a) => !a.done)
    .sort((a, b) => a.dueMs - b.dueMs);

  const doneAssignments = allAssignments.filter((a) => a.done);

  /* ── Recent announcements for sidebar ── */
  const recentAnnouncements = allAnnouncements.slice(0, 5);

  /* ── Join class ── */
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
      setSubmittedMap((prev) => ({ ...prev, [frontendId]: Date.now() }));
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      toast({ title: "Submitted! ✓", description: "Your assignment PDF was uploaded." });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  /* ── Leave class ── */
  const handleLeaveClass = () => {
    if (!classToLeave) return;
    leaveClassroom(classToLeave.id, userName);
    setClassToLeave(null);
  };

  /* ── Announcements for the currently viewed classroom ── */
  const currentClassAnnouncements = classroomMode
    ? allAnnouncements.filter(
      (a) =>
        a.classroom_id === classroomMode ||
        (!a.classroom_id && allDisplayClasses.find((c) => c.id === classroomMode))
    )
    : [];

  return (
    <DashboardLayout>
      <div className="gc-page">
        {/* ══════════════ MAIN CONTENT ══════════════ */}
        <div className="gc-main">

          {/* ── Classroom View ── */}
          {classroomMode ? (
            <div className="gc-classroom-view space-y-6">
              {/* Banner */}
              <div
                className="relative overflow-hidden rounded-xl h-48 sm:h-56 flex flex-col justify-end p-6 text-white"
                style={{ backgroundColor: allDisplayClasses.find((c) => c.id === classroomMode)?.bannerColor || "#1e7e6e" }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setClassroomMode(null)}
                  className="absolute top-4 left-4 h-9 w-9 p-0 rounded-full bg-black/20 text-white hover:bg-black/40 z-10"
                >
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </Button>
                <div className="relative z-10">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
                    {allDisplayClasses.find((c) => c.id === classroomMode)?.name || "Classroom"}
                  </h1>
                  <p className="text-lg opacity-90 font-medium">
                    {allDisplayClasses.find((c) => c.id === classroomMode)?.section} ·{" "}
                    {allDisplayClasses.find((c) => c.id === classroomMode)?.subject}
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
                    className={`pb-3 text-sm font-medium transition-colors whitespace-nowrap border-b-4 ${activeClassTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── STREAM TAB ── */}
              {activeClassTab === "stream" && (
                <div className="grid lg:grid-cols-4 gap-6">
                  {/* Upcoming sidebar */}
                  <div className="hidden lg:block space-y-4">
                    <Card className="shadow-none border border-slate-200">
                      <CardHeader className="py-4 px-5">
                        <CardTitle className="text-sm font-semibold">Upcoming</CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0">
                        {allAssignments.filter((a) => isAssignmentForClass(a, classroomMode) && !a.done).length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Woohoo, no work due soon!</p>
                        ) : (
                          <div className="space-y-3">
                            {allAssignments
                              .filter((a) => isAssignmentForClass(a, classroomMode) && !a.done)
                              .slice(0, 3)
                              .map((a) => (
                                <div key={a.id} className="text-xs">
                                  <p className="font-medium hover:underline cursor-pointer" onClick={() => setViewingAssignment(a)}>{a.title}</p>
                                  <p className="text-slate-400 mt-0.5">Due {a.due}</p>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Activity Feed */}
                  <div className="lg:col-span-3 space-y-4">
                    {/* Announce box */}
                    {isAnnouncing ? (
                      <Card className="shadow-none border border-slate-200">
                        <CardContent className="p-4 space-y-4">
                          <Input
                            placeholder="Announcement Title (optional)"
                            value={announceTitle}
                            onChange={(e) => setAnnounceTitle(e.target.value)}
                            className="bg-muted/30"
                          />
                          <Textarea
                            placeholder="Announce something to your class"
                            value={announceContent}
                            onChange={(e) => setAnnounceContent(e.target.value)}
                            className="min-h-[100px] bg-muted/30"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsAnnouncing(false)}>Cancel</Button>
                            <Button
                              onClick={() => createAnnouncementMutation.mutate()}
                              disabled={createAnnouncementMutation.isPending || !announceContent.trim()}
                            >
                              Post
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card
                        className="shadow-none border border-slate-200 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setIsAnnouncing(true)}
                      >
                        <CardContent className="py-4 px-5 flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
                            {getInitials(userName)}
                          </div>
                          <p className="text-sm text-muted-foreground">Announce something to your class</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Feed items: announcements + assignments merged by date */}
                    {(() => {
                      const classAssignments = allAssignments
                        .filter((a) => isAssignmentForClass(a, classroomMode))
                        .map((a) => ({
                          type: "assignment" as const,
                          data: a,
                          dateMs: a.created_at ? new Date(a.created_at).getTime() : a.dueMs - 86400000,
                        }));

                      const classAnnouncements = currentClassAnnouncements.map((a) => ({
                        type: "announcement" as const,
                        data: a,
                        dateMs: new Date(a.created_at).getTime(),
                      }));

                      const feedItems = [...classAssignments, ...classAnnouncements].sort(
                        (a, b) => b.dateMs - a.dateMs
                      );

                      if (feedItems.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed text-muted-foreground">
                            <Megaphone className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-sm">This classroom is quiet for now.</p>
                            <p className="text-xs mt-1 opacity-70">Assignments posted by your teacher will appear here.</p>
                          </div>
                        );
                      }

                      return feedItems.map((item, index) => {
                        if (item.type === "announcement") {
                          const ann = item.data as Announcement;
                          return (
                            <Card key={`ann-${ann.id || index}`} className="shadow-none border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10">
                              <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                  <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="text-sm sm:text-base font-semibold">{ann.author_name || "Teacher"}</h4>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {format(new Date(ann.created_at), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                    {ann.pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
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
                            className={`shadow-none transition-colors cursor-pointer ${a.done ? "border-slate-200 bg-slate-50/50" : "border-slate-200 hover:border-slate-300"
                              }`}
                            onClick={() => setViewingAssignment(a)}
                          >
                            <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                              <div
                                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shrink-0 ${a.isLate
                                    ? "bg-rose-100 text-rose-500"
                                    : a.done
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-primary/10 text-primary"
                                  }`}
                              >
                                <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="text-sm sm:text-base font-semibold truncate">
                                      {allDisplayClasses.find((c) => c.id === classroomMode)?.teacher_name} posted a new assignment: {a.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {a.created_at ? format(new Date(a.created_at), "MMM d") : "Posted today"} · Due {a.due}
                                      {a.totalMarks ? ` · ${a.totalMarks} marks` : ""}
                                    </p>
                                  </div>
                                  {a.done && a.isLate && (
                                    <Badge className="bg-rose-100 text-rose-700 border-none h-5 px-2 text-[10px] font-bold shrink-0">⚠ LATE</Badge>
                                  )}
                                  {a.done && !a.isLate && (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-none h-5 px-2 text-[10px] font-bold shrink-0">✓ SUBMITTED</Badge>
                                  )}
                                  {!a.done && a.dueMs < Date.now() && (
                                    <Badge className="bg-rose-50 text-rose-600 border-none h-5 px-2 text-[10px] font-bold shrink-0">OVERDUE</Badge>
                                  )}
                                </div>
                                {a.submittedAt && (
                                  <p className={`text-[10px] mt-1 font-medium ${a.isLate ? "text-rose-500" : "text-emerald-600"}`}>
                                    Submitted{" "}
                                    {new Date(a.submittedAt).toLocaleString("en-US", {
                                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                    })}
                                    {a.isLate ? " (after deadline)" : " (on time)"}
                                  </p>
                                )}
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-8 rounded-full text-xs font-semibold px-4 border-slate-300"
                                    onClick={(e) => { e.stopPropagation(); setViewingAssignment(a); }}
                                  >
                                    <FileText className="h-3.5 w-3.5 mr-1.5" /> View Paper
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm"
                                    className={`h-8 rounded-full text-xs font-semibold px-4 ${a.done ? "text-slate-400 hover:text-primary hover:bg-primary/5" : "text-primary hover:bg-primary/5"}`}
                                    onClick={(e) => { e.stopPropagation(); document.getElementById(`feed-input-${a.id}`)?.click(); }}
                                    disabled={uploadMutation.isPending}
                                  >
                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                    {a.done ? "Resubmit" : uploadMutation.isPending ? "Uploading…" : "Submit Work"}
                                    <input
                                      type="file" id={`feed-input-${a.id}`} className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                          e.stopPropagation();
                                          uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f });
                                        }
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

              {/* ── CLASSWORK & FILES TAB ── */}
              {activeClassTab === "classwork" && (
                <div className="space-y-4 max-w-4xl mx-auto mt-4 px-2">
                  <h2 className="text-xl font-bold border-b pb-4 mb-4">Classwork & Files</h2>

                  {/* Materials */}
                  {materials.filter((m) => m.classroomId === classroomMode).length > 0 && (
                    <div className="mb-6 space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Course Materials</h3>
                      {materials
                        .filter((m) => m.classroomId === classroomMode)
                        .map((mat) => (
                          <Card key={mat.id} className="shadow-none border-slate-200 hover:border-primary/50 transition-colors bg-blue-50/30">
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-semibold text-base">{mat.fileName}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Uploaded: {new Date(mat.uploadedAt).toLocaleDateString()} · {mat.fileSize}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => {
                                    if (mat.filePath) {
                                      window.open(
                                        `${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8002"}/uploads/${mat.filePath}`,
                                        "_blank"
                                      );
                                    } else {
                                      setViewingMaterialText({ title: mat.fileName, content: mat.extractedText });
                                    }
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" /> View PDF
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => navigate("/chatbot", { state: { material: mat, classroom: allDisplayClasses.find((c) => c.id === classroomMode) } })}
                                >
                                  <Bot className="h-4 w-4 mr-2" /> Chat with PDF
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}

                  {/* Assignments in this classroom */}
                  {(() => {
                    const classAssignments = allAssignments.filter((a) => isAssignmentForClass(a, classroomMode));
                    if (classAssignments.length === 0 && materials.filter((m) => m.classroomId === classroomMode).length === 0) {
                      return <p className="text-muted-foreground text-sm italic">No classwork or files posted yet.</p>;
                    }
                    if (classAssignments.length === 0) return null;
                    const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "");
                    return (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignments</h3>
                        {classAssignments.map((a) => {
                          const isSubmitted = a.submission_status === "submitted" || a.submission_status === "graded" || a.done;
                          const isGraded = a.submission_status === "graded";
                          const pdfUrl = a.submission_pdf_path
                            ? `${BACKEND_URL}/uploads/${a.submission_pdf_path}`
                            : null;
                          return (
                            <Card key={a.id} className={`shadow-sm border-2 transition-all ${
                              isGraded ? "border-emerald-200 bg-emerald-50/30" :
                              isSubmitted ? "border-blue-200 bg-blue-50/30" :
                              a.dueMs < Date.now() ? "border-red-200 bg-red-50/20" :
                              "border-slate-200 hover:border-primary/50"
                            }`}>
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  {/* Left: icon + info */}
                                  <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
                                      isGraded ? "bg-emerald-100 text-emerald-600" :
                                      isSubmitted ? "bg-blue-100 text-blue-600" :
                                      "bg-primary/10 text-primary"
                                    }`}>
                                      {isGraded ? <FileCheck className="h-5 w-5" /> :
                                       isSubmitted ? <FileCheck className="h-5 w-5" /> :
                                       <ClipboardList className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-base text-slate-800">{a.title}</p>
                                        {/* Status badge */}
                                        {isGraded && (
                                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100">
                                            ✓ Graded
                                          </Badge>
                                        )}
                                        {isSubmitted && !isGraded && (
                                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-[10px] font-bold uppercase tracking-wider hover:bg-blue-100">
                                            ✓ Submitted
                                          </Badge>
                                        )}
                                        {!isSubmitted && a.dueMs < Date.now() && (
                                          <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
                                            Overdue
                                          </Badge>
                                        )}
                                        {!isSubmitted && a.dueMs > Date.now() && (
                                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-amber-600 border-amber-300 bg-amber-50">
                                            Pending
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Due: {a.due}
                                        {a.totalMarks ? ` · ${a.totalMarks} marks` : ""}
                                        {isGraded && a.score != null && (
                                          <span className="ml-2 font-bold text-emerald-700">· Score: {a.score}/{a.totalMarks ?? "?"}</span>
                                        )}
                                        {isSubmitted && a.submitted_at_iso && (
                                          <span className="ml-2">
                                            · Submitted {new Date(a.submitted_at_iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                          </span>
                                        )}
                                      </p>
                                      {a.description && (
                                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{a.description}</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: action buttons */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* View Questions paper */}
                                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => setViewingAssignment(a)}>
                                      <FileText className="h-3.5 w-3.5" /> View Paper
                                    </Button>

                                    {/* View submitted PDF */}
                                    {pdfUrl && (
                                      <Button
                                        variant="outline" size="sm"
                                        className="text-xs h-8 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                                        onClick={() => window.open(pdfUrl, "_blank")}
                                      >
                                        <FileCheck className="h-3.5 w-3.5" /> My Submission
                                      </Button>
                                    )}

                                    {/* Upload / Resubmit */}
                                    <>
                                      <input
                                        type="file" accept=".pdf,image/*" className="hidden"
                                        id={`classwork-file-${a.id}`}
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f });
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        className={`text-xs h-8 gap-1.5 ${
                                          isSubmitted
                                            ? "bg-slate-700 hover:bg-slate-800 text-white"
                                            : "bg-primary hover:bg-primary/90 text-white"
                                        }`}
                                        disabled={uploadMutation.isPending}
                                        onClick={() => document.getElementById(`classwork-file-${a.id}`)?.click()}
                                      >
                                        {uploadMutation.isPending
                                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                                          : isSubmitted
                                          ? <><Upload className="h-3.5 w-3.5" /> Resubmit</>
                                          : <><Upload className="h-3.5 w-3.5" /> Submit PDF</>}
                                      </Button>
                                    </>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── MEMBERS TAB ── */}
              {activeClassTab === "members" && (
                <div className="max-w-2xl mx-auto space-y-10 mt-8 px-2">
                  <div>
                    <h2 className="text-2xl font-bold text-primary border-b-2 border-primary/20 pb-3 mb-6">Teachers</h2>
                    <div className="flex justify-between items-center px-2">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg shadow-sm border border-slate-300">
                          {getInitials(allDisplayClasses.find((c) => c.id === classroomMode)?.teacher_name || "Teacher")}
                        </div>
                        <p className="font-semibold text-lg">
                          {allDisplayClasses.find((c) => c.id === classroomMode)?.teacher_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-primary/20 pb-3 mb-6">
                      <h2 className="text-2xl font-bold text-primary">Classmates</h2>
                      <span className="text-muted-foreground font-medium">
                        {getEnrollments().filter((e) => e.classroomId === classroomMode).length} students
                      </span>
                    </div>
                    <div className="space-y-2 px-2">
                      {getEnrollments()
                        .filter((e) => e.classroomId === classroomMode)
                        .map((e, i) => (
                          <div key={i} className="flex justify-between items-center border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50/50 rounded-md px-2 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shadow-sm border border-slate-200">
                                {getInitials(e.studentName)}
                              </div>
                              <p className="text-sm font-medium">{e.studentName}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SCORES TAB ── */}
              {activeClassTab === "scores" && (
                <div className="space-y-6 max-w-4xl mx-auto mt-4 px-2">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>My Scores</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: "Overall Average", val: "88%", desc: "Top 15% of class" },
                      {
                        title: "Completed Work",
                        val: `${allAssignments.filter((a) => isAssignmentForClass(a, classroomMode) && a.done).length}/${allAssignments.filter((a) => isAssignmentForClass(a, classroomMode)).length}`,
                        desc: "Assignments submitted",
                      },
                      { title: "Predicted Grade", val: "A", desc: "Keep it up!" },
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
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" /> Graded Assignments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {allAssignments.filter((a) => isAssignmentForClass(a, classroomMode) && a.done).length === 0 ? (
                        <p className="text-muted-foreground text-sm italic py-4 text-center">No graded assignments yet.</p>
                      ) : (
                        allAssignments
                          .filter((a) => isAssignmentForClass(a, classroomMode) && a.done)
                          .map((a) => (
                            <div key={a.id} className="flex items-center justify-between border-b border-slate-100 pb-4 pt-2 last:border-0 last:pb-0 hover:bg-slate-50 px-2 rounded -mx-2 transition-colors">
                              <div>
                                <p className="font-semibold text-slate-800">{a.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Submitted: {new Date(a.submittedAt || Date.now()).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border-none">Graded</Badge>
                                <span className="font-black text-lg text-emerald-600">
                                  {a.totalMarks ? `${Math.round(a.totalMarks * 0.88)}/${a.totalMarks}` : "85%"}
                                </span>
                              </div>
                            </div>
                          ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── ANALYTICS TAB ── */}
              {activeClassTab === "analytics" && (
                <div className="space-y-6 max-w-4xl mx-auto mt-4 px-2">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Learning Efficiency Analytics
                  </h2>
                  <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 overflow-hidden relative shadow-sm">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <TrendingUp className="h-32 w-32" />
                    </div>
                    <CardContent className="p-8 sm:p-10 flex flex-col items-center justify-center text-center relative z-10">
                      <Badge className="bg-indigo-100 text-indigo-700 border-none hover:bg-indigo-100 mb-6 uppercase tracking-widest text-[10px] font-black">
                        AI Insights
                      </Badge>
                      <div className="h-36 w-36 rounded-full bg-white shadow-xl flex items-center justify-center mb-6 relative border border-indigo-50">
                        <div className="absolute inset-2 rounded-full border-[10px] border-indigo-600 border-t-indigo-200 border-r-indigo-100 rotate-45"></div>
                        <div className="flex flex-col items-center">
                          <span className="text-4xl font-extrabold text-indigo-900 tracking-tight">72</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LES Score</span>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-slate-800 mb-2">Steady Learning Velocity</h3>
                      <p className="text-slate-600 max-w-xl text-sm leading-relaxed">
                        Your Learning Efficiency Score (LES) for this subject indicates that your study hours are correlating well
                        with your assignment scores. You might want to focus your next study session explicitly on{" "}
                        <span className="font-semibold text-indigo-700 bg-indigo-100 px-1 rounded">Lab Performance</span>.
                      </p>
                      <Button
                        onClick={() => navigate("/chatbot")}
                        className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-full px-6"
                      >
                        <Target className="h-4 w-4 mr-2" /> Talk to AI Assistant
                      </Button>
                    </CardContent>
                  </Card>
                  <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <Card className="shadow-sm border-rose-100 overflow-hidden">
                      <div className="h-1 w-full bg-rose-500"></div>
                      <CardHeader className="bg-rose-50/50 pb-4">
                        <CardTitle className="text-base flex items-center gap-2 text-rose-900">
                          <AlertCircle className="h-5 w-5 text-rose-500" /> Needs Attention
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 px-5">
                        <ul className="space-y-3">
                          {[{ topic: "Pipelining Hazards", pct: 40 }, { topic: "Addressing Modes", pct: 45 }].map((t) => (
                            <li key={t.topic} className="text-sm flex flex-col gap-1 p-3 bg-white border border-rose-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>{t.topic}</span>
                                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">{t.pct}% mastery</Badge>
                              </div>
                              <Progress value={t.pct} className="h-1.5 mt-2 bg-rose-100" />
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm border-emerald-100 overflow-hidden">
                      <div className="h-1 w-full bg-emerald-500"></div>
                      <CardHeader className="bg-emerald-50/50 pb-4">
                        <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
                          <CheckSquare className="h-5 w-5 text-emerald-500" /> Strong Concepts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 px-5">
                        <ul className="space-y-3">
                          {[{ topic: "Cache Memory", pct: 88 }, { topic: "Instruction Sets", pct: 85 }].map((t) => (
                            <li key={t.topic} className="text-sm flex flex-col gap-1 p-3 bg-white border border-emerald-100 shadow-sm rounded-lg">
                              <div className="flex justify-between items-center text-slate-800 font-medium">
                                <span>{t.topic}</span>
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">{t.pct}% mastery</Badge>
                              </div>
                              <Progress value={t.pct} className="h-1.5 mt-2 bg-emerald-100" />
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── HOME: Class Cards ── */
            <>
              <div className="gc-topbar">
                <div>
                  <h1 className="gc-greeting">
                    Welcome back, <span className="gc-name">{userName}</span> 👋
                  </h1>
                  <p className="gc-sub">Here are your enrolled classes</p>
                </div>
                <Button className="gc-join-btn" onClick={() => setJoinOpen(true)}>
                  <Plus className="gc-btn-icon" /> Join Class
                </Button>
              </div>

              {allDisplayClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed text-muted-foreground mb-8">
                  <BookOpen className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">You haven't joined any classes yet</p>
                  <p className="text-xs mt-1">Ask your teacher for a class code and click "Join Class"</p>
                </div>
              ) : (
                <div className="gc-grid">
                  {allDisplayClasses.map((cls) => (
                    <div key={cls.id} className="gc-card" onClick={() => setSelectedClass(cls)}>
                      <div className="gc-card-banner" style={{ backgroundColor: cls.bannerColor }}>
                        <div className="gc-card-banner-content">
                          <div>
                            <h2 className="gc-card-name">{cls.name}</h2>
                            {cls.section && <p className="gc-card-section">{cls.section}</p>}
                            <p className="gc-card-teacher">{cls.subject}</p>
                          </div>
                        </div>
                        <div className="gc-card-menu" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="gc-more-btn" title="More options">
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="gc-dropdown">
                              <DropdownMenuItem className="gc-dd-item" onClick={() => { setClassroomMode(cls.id); setSelectedClass(null); }}>
                                <BookOpen className="h-4 w-4" /> Open Classroom
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gc-dd-item" onClick={() => navigate("/analytics")}>
                                <TrendingUp className="h-4 w-4" /> Analytics
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gc-dd-item" onClick={() => navigate("/chatbot")}>
                                <Bot className="h-4 w-4" /> AI Assistant
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gc-dd-item gc-dd-leave" onClick={(e) => { e.stopPropagation(); setClassToLeave(cls); }}>
                                <X className="h-4 w-4" /> Unenroll
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="gc-teacher-avatar">
                          <span>{getInitials(cls.teacher_name)}</span>
                        </div>
                      </div>
                      <div className="gc-card-body" style={{ backgroundColor: cls.cardColor }}>
                        <p className="gc-card-teacher-name">{cls.teacher_name}</p>
                        <div className="gc-card-footer">
                          <div className="gc-card-icons">
                            <button className="gc-icon-btn" title="Notifications" onClick={(e) => e.stopPropagation()}><Bell className="h-5 w-5" /></button>
                            <button className="gc-icon-btn" title="Files" onClick={(e) => e.stopPropagation()}><Folder className="h-5 w-5" /></button>
                            <button className="gc-icon-btn" title="Members" onClick={(e) => e.stopPropagation()}><Users className="h-5 w-5" /></button>
                          </div>
                          <div className="gc-card-icons">
                            <button className="gc-icon-btn" title="Scores" onClick={(e) => { e.stopPropagation(); navigate("/scores"); }}><BarChart3 className="h-5 w-5" /></button>
                            <button className="gc-icon-btn" title="Analytics" onClick={(e) => { e.stopPropagation(); navigate("/analytics"); }}><TrendingUp className="h-5 w-5" /></button>
                            <button className="gc-icon-btn" title="AI Assistant" onClick={(e) => { e.stopPropagation(); navigate("/chatbot"); }}><Bot className="h-5 w-5" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ══════════════ RIGHT SIDEBAR ══════════════ */}
        <aside className="gc-sidebar">

          {/* ── To-Do widget ── */}
          <div className="gc-widget">
            <div className="gc-widget-tabs">
              <button className={`gc-tab ${activeTab === "todo" ? "gc-tab-active" : ""}`} onClick={() => setActiveTab("todo")}>
                To do {pendingAssignments.length > 0 && <span className="ml-1 gc-badge-count">{pendingAssignments.length}</span>}
              </button>
              <button className={`gc-tab ${activeTab === "reviewed" ? "gc-tab-active" : ""}`} onClick={() => setActiveTab("reviewed")}>
                Reviewed
              </button>
            </div>
            <div className="gc-todo-list">
              {activeTab === "todo" &&
                (pendingAssignments.length === 0 ? (
                  <div className="gc-empty">
                    <CheckSquare className="h-10 w-10 gc-empty-icon" />
                    <p>No work due. Enjoy your day!</p>
                  </div>
                ) : (
                  pendingAssignments.map((a) => (
                    <div
                      key={a.id}
                      className={`gc-todo-item ${a.isReal ? "border-l-2 border-primary/50 pl-2" : ""}`}
                      onClick={() => a.isReal && setViewingAssignment(a)}
                    >
                      <div className="gc-todo-icon-wrap">
                        <AlertCircle className="h-4 w-4 gc-todo-icon" />
                      </div>
                      <div className="gc-todo-info" style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <p className="gc-todo-title">{a.title}</p>
                          {a.isReal && (
                            <span style={{ fontSize: "10px", background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))", borderRadius: "4px", padding: "1px 5px", fontWeight: 600 }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="gc-todo-class">{a.className}</p>
                        {a.description && (
                          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "2px", lineHeight: "1.4" }}>
                            {a.description}
                          </p>
                        )}
                        <div className="gc-todo-due">
                          <Clock className="h-3 w-3" />
                          <span>Due {a.due}</span>
                          {a.totalMarks && (
                            <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>· {a.totalMarks} marks</span>
                          )}
                        </div>
                        {a.isReal && (
                          <div style={{ marginTop: "6px" }}>
                            <span
                              onClick={(e) => { e.stopPropagation(); setViewingAssignment(a); }}
                              style={{ fontSize: "11px", fontWeight: 600, background: "hsl(var(--primary)/0.08)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary)/0.25)", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <FileText className="h-3 w-3" /> View Questions
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ))}
              {activeTab === "reviewed" &&
                (doneAssignments.length === 0 ? (
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
                ))}
            </div>
          </div>

          {/* ── Upcoming widget ── */}
          <div className="gc-widget gc-upcoming">
            <h3 className="gc-widget-title">
              <Clock className="h-4 w-4" /> Upcoming
            </h3>
            {pendingAssignments.length === 0 ? (
              <p className="gc-upcoming-empty">No upcoming work 🎉</p>
            ) : (
              pendingAssignments.slice(0, 4).map((a) => (
                <div key={a.id} className="gc-upcoming-item" onClick={() => setViewingAssignment(a)} style={{ cursor: "pointer" }}>
                  <div className={`gc-upcoming-dot ${a.dueMs < Date.now() ? "gc-upcoming-dot-overdue" : ""}`} />
                  <div>
                    <p className="gc-upcoming-name">{a.title}</p>
                    <p className="gc-upcoming-meta">
                      {a.className} · Due {a.due}
                      {a.dueMs < Date.now() && <span className="gc-overdue-tag"> · Overdue</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Announcements widget ── */}
          <div className="gc-widget gc-upcoming">
            <h3 className="gc-widget-title" style={{ color: "hsl(var(--primary))" }}>
              <Megaphone className="h-4 w-4" /> Announcements
            </h3>
            {recentAnnouncements.length === 0 ? (
              <p className="gc-upcoming-empty">No announcements yet.</p>
            ) : (
              <div className="space-y-4">
                {recentAnnouncements.map((ann) => (
                  <div key={ann.id} className="border-l-2 border-amber-400 pl-3">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-sm line-clamp-1 flex-1">{ann.title || "Announcement"}</p>
                      {ann.pinned && <Pin className="h-3 w-3 text-primary shrink-0 ml-1" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ann.content}</p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">
                      {ann.author_name || "Teacher"} · {format(new Date(ann.created_at), "MMM d")}
                      {ann.classroom_name && <span> · {ann.classroom_name}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Class Detail Modal ── */}
      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className="gc-modal">
          <DialogHeader>
            <DialogTitle className="gc-modal-title">{selectedClass?.name}</DialogTitle>
            <DialogDescription className="gc-modal-desc">{selectedClass?.section} · {selectedClass?.subject}</DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="gc-modal-body">
              <div className="gc-modal-banner" style={{ backgroundColor: selectedClass.bannerColor }}>
                <BookOpen className="h-14 w-14 text-white/40" />
                <div>
                  <h3 className="gc-modal-class-name">{selectedClass.name}</h3>
                  <p className="gc-modal-class-sub">{selectedClass.section}</p>
                </div>
              </div>
              <div className="gc-modal-teacher-row">
                <div className="gc-modal-avatar">{getInitials(selectedClass.teacher_name)}</div>
                <div>
                  <p className="gc-modal-teacher">{selectedClass.teacher_name}</p>
                  <p className="gc-modal-role">Class Teacher</p>
                </div>
              </div>
              <div className="gc-modal-stats">
                {[
                  { label: "Students", value: getEnrollments().filter((e) => e.classroomId === selectedClass.id).length.toString() },
                  { label: "Assignments", value: allAssignments.filter((a) => isAssignmentForClass(a, selectedClass.id)).length.toString() },
                  { label: "Submitted", value: allAssignments.filter((a) => isAssignmentForClass(a, selectedClass.id) && a.done).length.toString() },
                ].map((s) => (
                  <div key={s.label} className="gc-stat-card">
                    <p className="gc-stat-val">{s.value}</p>
                    <p className="gc-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Pending assignments in this class */}
              <div className="mt-4 border-t pt-4 px-6 pb-2">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Upload className="h-4 w-4" /> Submit Assignment</p>
                {allAssignments.filter((a) => isAssignmentForClass(a, selectedClass?.id) && !a.done).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pending assignments for this class.</p>
                ) : (
                  <div className="space-y-2">
                    {allAssignments.filter((a) => isAssignmentForClass(a, selectedClass?.id) && !a.done).map((a) => (
                      <div key={a.id} className="flex flex-col rounded-lg border p-3 text-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{a.title}</p>
                            <p className="text-xs text-muted-foreground">Due {a.due}{a.totalMarks ? ` · ${a.totalMarks}m` : ""}</p>
                          </div>
                          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer" onClick={() => setViewingAssignment(a)}>
                            <FileText className="h-3 w-3 mr-1" /> View Paper
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <input type="file" accept=".pdf,image/*" className="hidden" id={`file-${a.id}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadMutation.mutate({ assignmentId: a.id.replace("real-", ""), file: f });
                            }}
                          />
                          <label htmlFor={`file-${a.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild disabled={uploadMutation.isPending}>
                              <span className="cursor-pointer">
                                {uploadMutation.isPending ? (
                                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                                ) : (
                                  <><Upload className="h-3 w-3 mr-1.5" />Submit PDF Solution</>
                                )}
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="gc-modal-actions">
                <Button className="gc-primary-btn" onClick={() => { setClassroomMode(selectedClass.id); setSelectedClass(null); }}>
                  Open Classroom <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gc-secondary-btn" onClick={() => { setSelectedClass(null); }}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Material Text Viewer ── */}
      <Dialog open={!!viewingMaterialText} onOpenChange={(open) => !open && setViewingMaterialText(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingMaterialText?.title}</DialogTitle>
            <DialogDescription>Extracted text representation.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-md whitespace-pre-wrap font-mono text-sm">
            {viewingMaterialText?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join Class Modal ── */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="gc-modal gc-join-modal">
          <DialogHeader>
            <DialogTitle className="gc-modal-title">Join a class</DialogTitle>
            <DialogDescription className="gc-modal-desc">Ask your teacher for the class code, then enter it here.</DialogDescription>
          </DialogHeader>
          <div className="gc-join-body">
            <p className="gc-join-hint">Class code</p>
            <input className="gc-join-input" placeholder="e.g. abc123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
            <p className="gc-join-note">Use a class code that's 5–7 letters or numbers with no spaces or symbols.</p>
            <div className="gc-join-actions">
              <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
              <Button disabled={!joinCode.trim()} onClick={handleJoin}>Join</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Unenroll Modal ── */}
      <Dialog open={!!classToLeave} onOpenChange={(open) => !open && setClassToLeave(null)}>
        <DialogContent className="gc-modal gc-join-modal">
          <DialogHeader>
            <DialogTitle className="gc-modal-title">Unenroll</DialogTitle>
            <DialogDescription className="gc-modal-desc mt-2">
              Are you sure you want to unenroll from {classToLeave?.name}?
            </DialogDescription>
          </DialogHeader>
          <div className="gc-join-body pt-2">
            <div className="gc-join-actions mt-4">
              <Button variant="outline" onClick={() => setClassToLeave(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleLeaveClass}>Unenroll</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Assignment Paper ── */}
      <Dialog open={!!viewingAssignment} onOpenChange={(open) => !open && setViewingAssignment(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none gap-0">
          {viewingAssignment && (
            <div className="bg-white text-slate-900 min-h-full">
              <div className="bg-slate-900 text-white p-8 text-center space-y-2 border-b-4 border-primary">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assignment Question Paper</p>
                <h2 className="text-3xl font-extrabold">{viewingAssignment.title}</h2>
                <p className="text-slate-300 font-medium">{viewingAssignment.className}</p>
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm">
                  <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /><span>Due: <strong>{viewingAssignment.due}</strong></span></div>
                  <div className="flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /><span>Max Marks: <strong>{viewingAssignment.totalMarks || "N/A"}</strong></span></div>
                </div>
              </div>
              <div className="px-8 py-4 bg-slate-50 border-b italic text-slate-600 text-sm">
                <strong>Instructions:</strong> Read each question carefully before attempting. Submit your solutions in PDF format before the deadline.
              </div>
              <div className="p-8 space-y-8">
                {(!viewingAssignment.questions || viewingAssignment.questions.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                    <p>No questions found in this assignment.</p>
                  </div>
                ) : (
                  viewingAssignment.questions.map((q, idx) => (
                    <div key={idx} className="flex gap-4">
                      <span className="font-bold text-slate-400 w-6 mt-1 text-lg">{idx + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <p className="text-lg leading-relaxed text-slate-800 font-medium">{q.question_text}</p>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-slate-200">{q.marks} Marks</Badge>
                          {q.difficulty && (
                            <Badge className={`text-[10px] font-bold uppercase tracking-wider ${q.difficulty === "hard" ? "bg-rose-100 text-rose-700 border-rose-200" : q.difficulty === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                              {q.difficulty}
                            </Badge>
                          )}
                          {q.co_code && <span className="text-xs text-slate-400 font-mono">[{q.co_code}]</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-8 bg-slate-50 border-t flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print Paper
                </Button>
                <div className="flex items-center gap-3">
                  {viewingAssignment?.isReal && (
                    <>
                      <input type="file" accept=".pdf,image/*" style={{ display: "none" }} id="dialog-submit-file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadMutation.mutate({ assignmentId: viewingAssignment.id.replace("real-", ""), file: f });
                        }}
                      />
                      <Button className="gap-2 bg-primary text-white font-bold px-6" disabled={uploadMutation.isPending}
                        onClick={() => document.getElementById("dialog-submit-file")?.click()}>
                        {uploadMutation.isPending ? <><span className="animate-spin">⏳</span> Uploading...</> : viewingAssignment?.done ? <><Upload className="h-4 w-4" /> Resubmit PDF</> : <><Upload className="h-4 w-4" /> Submit PDF Solution</>}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" onClick={() => setViewingAssignment(null)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════ SCOPED STYLES ══════════════ */}
      <style>{`
        .gc-page { display: flex; gap: 24px; align-items: flex-start; min-height: 100%; font-family: var(--font-body, 'Roboto', sans-serif); }
        .gc-main { flex: 1; min-width: 0; }
        .gc-sidebar { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
        @media (max-width: 960px) { .gc-page { flex-direction: column; } .gc-sidebar { width: 100%; } }

        .gc-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 12px; flex-wrap: wrap; }
        .gc-greeting { font-size: 1.5rem; font-weight: 700; color: hsl(var(--foreground)); margin: 0; }
        .gc-name { color: hsl(var(--primary)); }
        .gc-sub { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 4px 0 0; }
        .gc-join-btn { display: flex; align-items: center; gap: 6px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 24px; padding: 10px 20px; font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.15); transition: filter .2s, box-shadow .2s; }
        .gc-join-btn:hover { filter: brightness(0.9); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
        .gc-btn-icon { width: 18px; height: 18px; }

        .gc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

        .gc-card { border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); cursor: pointer; transition: box-shadow .2s, transform .2s; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); }
        .gc-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.15); transform: translateY(-2px); }
        .gc-card-banner { position: relative; height: 100px; padding: 16px; overflow: hidden; }
        .gc-card-banner-content { position: relative; z-index: 1; }
        .gc-card-name { font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0 0 2px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .gc-card-section { font-size: 0.78rem; color: rgba(255,255,255,.85); margin: 0; }
        .gc-card-teacher { font-size: 0.82rem; color: rgba(255,255,255,.9); margin: 2px 0 0; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
        .gc-card-menu { position: absolute; top: 8px; right: 8px; z-index: 10; }
        .gc-more-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.2); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .gc-more-btn:hover { background: rgba(255,255,255,.3); }
        .gc-teacher-avatar { position: absolute; bottom: -20px; left: 16px; width: 48px; height: 48px; border-radius: 50%; background: hsl(var(--card)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; color: hsl(var(--foreground)); box-shadow: 0 2px 6px rgba(0,0,0,.15); border: 3px solid hsl(var(--card)); z-index: 2; }
        .gc-card-body { padding: 28px 16px 12px; background: hsl(var(--card)); }
        .gc-card-teacher-name { font-size: 0.82rem; color: hsl(var(--muted-foreground)); margin: 0 0 12px; padding-left: 56px; }
        .gc-card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid hsl(var(--border)); padding-top: 10px; margin-top: 4px; }
        .gc-card-icons { display: flex; gap: 4px; }
        .gc-icon-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .gc-icon-btn:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }

        .gc-dropdown { background: hsl(var(--popover)); border: 1px solid hsl(var(--border)); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.15); min-width: 180px; padding: 4px; }
        .gc-dd-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.875rem; color: hsl(var(--foreground)); cursor: pointer; transition: background .15s; border-radius: 4px; }
        .gc-dd-item:hover { background: hsl(var(--muted)); }
        .gc-dd-leave { color: hsl(var(--destructive)); }
        .gc-dd-leave:hover { background: hsla(var(--destructive), 0.1); }

        .gc-widget { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 8px; overflow: hidden; }
        .gc-widget-tabs { display: flex; border-bottom: 1px solid hsl(var(--border)); }
        .gc-tab { flex: 1; padding: 12px; font-size: 0.85rem; font-weight: 600; color: hsl(var(--muted-foreground)); background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; transition: color .15s, border-color .15s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .gc-tab:hover { color: hsl(var(--primary)); background: hsla(var(--primary), 0.05); }
        .gc-tab-active { color: hsl(var(--primary)); border-bottom-color: hsl(var(--primary)); }
        .gc-badge-count { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 10px; padding: 1px 6px; font-size: 11px; font-weight: 700; }

        .gc-todo-list { padding: 8px 0; max-height: 360px; overflow-y: auto; }
        .gc-todo-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 1px solid hsl(var(--border)); cursor: pointer; transition: background .15s; }
        .gc-todo-item:hover { background: hsl(var(--muted)); }
        .gc-todo-item:last-child { border-bottom: none; }
        .gc-todo-done { opacity: .7; }
        .gc-todo-icon-wrap { width: 32px; height: 32px; border-radius: 50%; background: hsla(var(--destructive), 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .gc-done-icon-wrap { background: hsla(142, 71%, 45%, 0.1); }
        .gc-todo-icon { color: hsl(var(--destructive)); }
        .gc-done-icon { color: hsl(142, 71%, 45%); }
        .gc-todo-info { flex: 1; min-width: 0; }
        .gc-todo-title { font-size: 0.82rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gc-todo-class { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin: 0 0 4px; }
        .gc-todo-due { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: hsl(var(--destructive)); font-weight: 600; }
        .gc-badge-done { display: inline-block; font-size: 0.7rem; font-weight: 700; color: hsl(142, 71%, 45%); background: hsla(142, 71%, 45%, 0.1); padding: 2px 8px; border-radius: 12px; }
        .gc-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; color: hsl(var(--muted-foreground)); font-size: 0.82rem; text-align: center; }
        .gc-empty-icon { opacity: 0.5; }

        .gc-upcoming { padding: 16px; }
        .gc-widget-title { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: hsl(var(--foreground)); margin: 0 0 12px; }
        .gc-upcoming-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid hsl(var(--border)); }
        .gc-upcoming-item:last-child { border-bottom: none; }
        .gc-upcoming-dot { width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--primary)); flex-shrink: 0; margin-top: 5px; }
        .gc-upcoming-dot-overdue { background: hsl(var(--destructive)); }
        .gc-upcoming-name { font-size: 0.8rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0 0 2px; }
        .gc-upcoming-meta { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin: 0; }
        .gc-overdue-tag { color: hsl(var(--destructive)); font-weight: 700; }
        .gc-upcoming-empty { font-size: 0.8rem; color: hsl(var(--muted-foreground)); text-align: center; padding: 8px 0; }

        .gc-modal { background: hsl(var(--card)); border-radius: 12px; border: 1px solid hsl(var(--border)); padding: 0; max-width: 540px; overflow: hidden; color: hsl(var(--card-foreground)); }
        .gc-modal-title { font-size: 1.3rem; font-weight: 700; color: hsl(var(--foreground)); padding: 24px 24px 0; }
        .gc-modal-desc { font-size: 0.85rem; color: hsl(var(--muted-foreground)); padding: 4px 24px 0; }
        .gc-modal-body { padding: 0; }
        .gc-modal-banner { display: flex; align-items: center; gap: 20px; padding: 24px; margin: 16px 24px; border-radius: 10px; color: #fff; }
        .gc-modal-class-name { font-size: 1.2rem; font-weight: 700; margin: 0 0 4px; }
        .gc-modal-class-sub { font-size: 0.85rem; color: rgba(255,255,255,.8); margin: 0; }
        .gc-modal-teacher-row { display: flex; align-items: center; gap: 14px; padding: 0 24px 16px; }
        .gc-modal-avatar { width: 44px; height: 44px; border-radius: 50%; background: hsl(var(--muted)); color: hsl(var(--foreground)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; }
        .gc-modal-teacher { font-size: 0.9rem; font-weight: 600; color: hsl(var(--foreground)); margin: 0; }
        .gc-modal-role { font-size: 0.78rem; color: hsl(var(--muted-foreground)); margin: 0; }
        .gc-modal-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 24px 20px; }
        .gc-stat-card { background: hsl(var(--muted)); border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 14px; text-align: center; }
        .gc-stat-val { font-size: 1.5rem; font-weight: 700; color: hsl(var(--primary)); margin: 0 0 4px; }
        .gc-stat-label { font-size: 0.72rem; color: hsl(var(--muted-foreground)); margin: 0; }
        .gc-modal-actions { display: flex; gap: 12px; padding: 16px 24px 24px; border-top: 1px solid hsl(var(--border)); }
        .gc-primary-btn { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 6px; font-weight: 600; display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; cursor: pointer; transition: filter .2s; flex: 1; justify-content: center; }
        .gc-primary-btn:hover { filter: brightness(0.9); }
        .gc-secondary-btn { border: 1px solid hsl(var(--border)); color: hsl(var(--foreground)); border-radius: 6px; font-weight: 600; padding: 10px 20px; background: transparent; cursor: pointer; transition: background .2s; flex: 1; text-align: center; }
        .gc-secondary-btn:hover { background: hsl(var(--muted)); }

        .gc-join-modal { max-width: 440px; }
        .gc-join-body { padding: 12px 24px 24px; display: flex; flex-direction: column; gap: 10px; }
        .gc-join-hint { font-size: 0.78rem; font-weight: 700; color: hsl(var(--muted-foreground)); letter-spacing: .5px; text-transform: uppercase; margin: 0; }
        .gc-join-input { width: 100%; padding: 12px 16px; border: 1px solid hsl(var(--border)); background: transparent; border-radius: 6px; font-size: 1rem; color: hsl(var(--foreground)); outline: none; font-family: monospace; letter-spacing: 2px; transition: border-color .2s; }
        .gc-join-input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsla(var(--primary), 0.15); }
        .gc-join-note { font-size: 0.78rem; color: hsl(var(--muted-foreground)); margin: 0; line-height: 1.5; }
        .gc-join-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
      `}</style>
    </DashboardLayout>
  );
}