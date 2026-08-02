import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Calendar, FileText, Users, Lightbulb, Trash2, MoreVertical,
  Copy, UserCheck, Check, X, Megaphone, Pin, Send, ChevronRight,
  BookOpen, ClipboardList, AlertCircle, Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  getClassrooms, createClassroom, deleteClassroom, updateClassroom,
  getJoinRequests, acceptJoinRequest, rejectJoinRequest, getEnrollments,
  Classroom, JoinRequest, ClassroomMaterial, getClassroomMaterials,
  addClassroomMaterial, deleteClassroomMaterial,
} from "@/utils/mockClassrooms";

const BANNER_COLORS = [
  { bannerColor: "#1e7e6e", cardColor: "#e0f2f1" },
  { bannerColor: "#1565c0", cardColor: "#e3f2fd" },
  { bannerColor: "#6a1b9a", cardColor: "#f3e5f5" },
  { bannerColor: "#ad1457", cardColor: "#fce4ec" },
  { bannerColor: "#f57f17", cardColor: "#fff8e1" },
  { bannerColor: "#2e7d32", cardColor: "#e8f5e9" },
];

const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

interface LearningOutcomeItem { id: string; code: string; description: string; course_outcome_id: string | null }
interface AssignmentItem {
  id: string; teacher_id: string; title: string; description: string;
  due_date: string | null; created_at: string; status: string;
  classroom_id?: string; total_marks?: number; questions_count?: number;
}
interface SubmissionItem {
  id: string; assignment_id: string; student_id: string; student_name?: string; student_email?: string;
  content: string; marks: number | null; grade: string | null; feedback: string | null;
  image_path: string | null; pdf_path: string | null; extracted_text: string | null; submitted_at: string;
}
interface Announcement {
  id: string; title: string; content: string; author_name: string;
  created_at: string; updated_at: string; pinned: boolean; classroom_id?: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /* ── Classroom management state ── */
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSection, setNewClassSection] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassSection, setEditClassSection] = useState("");
  const [editClassSubject, setEditClassSubject] = useState("");

  /* ── Active classroom (drill-down view) ── */
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [classDetailOpen, setClassDetailOpen] = useState(false);
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<Classroom | null>(null);
  const [activeClassTab, setActiveClassTab] = useState<"announcements" | "assignments" | "requests" | "materials">("announcements");

  /* ── Announcement composer ── */
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");
  const [announceClassroomId, setAnnounceClassroomId] = useState<string | null>(null);

  /* ── Submission grading ── */
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  /* ── Material upload ── */
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [viewingMaterialText, setViewingMaterialText] = useState<{ title: string; content: string } | null>(null);

  /* ── Local (mock) classrooms ── */
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState<any[]>([]);
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);

  useEffect(() => {
    const load = () => {
      setClassrooms(getClassrooms());
      setJoinRequests(getJoinRequests());
      setEnrollmentsTotal(getEnrollments());
      setMaterials(getClassroomMaterials());
    };
    load();
    window.addEventListener("classroomSync", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("classroomSync", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const teacherName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Teacher";

  /* ── Queries ── */
  const { data: learningOutcomes = [] } = useQuery({
    queryKey: ["learning_outcomes"],
    queryFn: async () => { const { data, error } = await apiClient.get("/learning-outcomes"); if (error) throw error; return data; },
  });

  /* Fetch ALL assignments by this teacher (draft + published) */
  const { data: assignments = [], isLoading } = useQuery<AssignmentItem[]>({
    queryKey: ["assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return (data ?? []).filter((a: any) => a.teacher_id === user?.id);
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  /* Submissions for selected assignment */
  const { data: submissions = [] } = useQuery<SubmissionItem[]>({
    queryKey: ["submissions", selectedAssignment],
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/submissions?assignment_id=${selectedAssignment}`);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAssignment,
  });

  /* Announcements — fetch from all classrooms owned by teacher */
  const { data: announcementsRaw } = useQuery({
    queryKey: ["announcements", user?.id],
    queryFn: async () => {
      // Try teacher-specific endpoint, fall back to general
      const res = await apiClient.get("/announcements/");
      return res.data?.announcements ?? res.data ?? [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
  const allAnnouncements: Announcement[] = (announcementsRaw ?? []).filter(
    (a: any) => a.teacher_id === user?.id || !a.teacher_id
  );

  /* ── Mutations ── */
  const sendAnnouncementMutation = useMutation({
    mutationFn: async ({ title, content, classroomId }: { title: string; content: string; classroomId: string | null }) => {
      const { error } = await apiClient.post(
        classroomId ? `/classrooms/${classroomId}/announcements` : "/announcements/",
        classroomId
          ? { message: content }
          : { title, message: content, classroom_id: null }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", user?.id] });
      setIsAnnouncing(false);
      setAnnounceTitle("");
      setAnnounceContent("");
      setAnnounceClassroomId(null);
      toast({ title: "Announcement sent!" });
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, grade, feedback }: { id: string; marks: number | null; grade: string; feedback: string }) => {
      const { error } = await apiClient.put(`/submissions/${id}`, { marks, grade, feedback });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["submissions"] }); toast({ title: "Graded!" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/assignments/${id}`); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", user?.id] });
      setSelectedAssignment(null);
      toast({ title: "Assignment deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /* ── Classroom CRUD ── */
  const handleCreateClass = () => {
    if (!newClassName.trim()) return;
    const colorTheme = BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
    const newClass = createClassroom({
      name: newClassName,
      section: newClassSection,
      subject: newClassSubject,
      teacherName,
      bannerColor: colorTheme.bannerColor,
      cardColor: colorTheme.cardColor,
    });
    setCreateClassOpen(false);
    setNewClassName("");
    setNewClassSection("");
    setNewClassSubject("");
    toast({ title: `Class '${newClass.name}' created! Code: ${newClass.code}` });
  };

  const openEditModal = (cls: Classroom) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassSection(cls.section);
    setEditClassSubject(cls.subject);
    setEditClassOpen(true);
  };

  const handleEditClass = () => {
    if (!editClassName.trim() || !editingClassId) return;
    updateClassroom(editingClassId, { name: editClassName, section: editClassSection, subject: editClassSubject });
    setEditClassOpen(false);
    toast({ title: "Class updated!" });
  };

  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClassForDetail) return;
    setIsUploadingMaterial(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.postFormData("/extract-text/pdf", formData);
      if (res.error) throw new Error((res.error as any).message || "Failed to extract text");
      addClassroomMaterial({
        classroomId: selectedClassForDetail.id,
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        extractedText: (res.data as any)?.text || "",
        filePath: (res.data as any)?.file_path,
      });
      toast({ title: "Material uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingMaterial(false);
      if (e.target) e.target.value = "";
    }
  };

  /* ── Derived data ── */
  const publishedAssignments = assignments.filter((a) => a.status === "published");
  const draftAssignments = assignments.filter((a) => a.status !== "published");

  /* Assignments filtered for currently open classroom detail */
  const classroomAssignments = selectedClassForDetail
    ? assignments.filter((a) => a.classroom_id === selectedClassForDetail.id)
    : [];

  /* Announcements for currently open classroom */
  const classroomAnnouncements = selectedClassForDetail
    ? allAnnouncements.filter((a) => a.classroom_id === selectedClassForDetail.id || !a.classroom_id)
    : allAnnouncements;

  /* Last sent announcement (global stream) */
  const lastAnnouncement = allAnnouncements[0];

  return (
    <DashboardLayout>
      <div className="gc-page w-full flex flex-col pt-4">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold font-heading tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {(() => {
                const hour = new Date().getHours();
                const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
                return <>{greeting}, <span className="text-gradient">{teacherName}</span> 👋</>;
              })()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your classrooms, assignments and announcements</p>
          </div>
          <Button
            className="rounded-full bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 px-5 gap-1.5"
            onClick={() => setCreateClassOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create Class
          </Button>
        </div>

        {/* ── Class Cards Grid ── */}
        {classrooms.length === 0 ? (
          <Card className="mb-10 border-none shadow-card-sm">
            <CardContent className="py-16 flex flex-col items-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-indigo-400" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">No classes created yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Click "Create Class" to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {classrooms.map((cls) => {
              const pendingCount = joinRequests.filter((r) => r.classroomId === cls.id && r.status === "pending").length;
              const assignmentCount = assignments.filter((a) => a.classroom_id === cls.id).length;
              return (
                <div
                  key={cls.id}
                  className="group rounded-2xl overflow-hidden border bg-card shadow-card-sm hover:shadow-card-hover transition-all duration-300 cursor-pointer hover:-translate-y-1"
                  onClick={() => { setSelectedClassForDetail(cls); setClassDetailOpen(true); setActiveClassTab("announcements"); }}
                >
                  <div className="relative h-28 px-4 pt-4 overflow-hidden" style={{ backgroundColor: cls.bannerColor }}>
                    <div className="gc-card-banner-content">
                      <h2 className="gc-card-name">{cls.name}</h2>
                      {cls.section && <p className="gc-card-section">{cls.section}</p>}
                      <p className="gc-card-teacher">{cls.subject}</p>
                    </div>
                    <div className="gc-card-menu" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="gc-more-btn"><MoreVertical className="h-5 w-5" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="gc-dropdown">
                          <DropdownMenuItem className="gc-dd-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cls.code); toast({ title: "Code copied!" }); }}>
                            <Copy className="h-4 w-4" /> Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gc-dd-item" onClick={(e) => { e.stopPropagation(); openEditModal(cls); }}>
                            <FileText className="h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gc-dd-item text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete class ${cls.name}?`)) deleteClassroom(cls.id); }}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="gc-teacher-avatar"><span>{getInitials(cls.teacherName)}</span></div>
                  </div>
                  <div className="gc-card-body pb-4">
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded border">Code: <strong>{cls.code}</strong></p>
                      <div className="flex items-center gap-3">
                        {pendingCount > 0 && (
                          <span className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">
                            {pendingCount} pending
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" /> {assignmentCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─────────────────────────────────────
            CLASS DETAIL PANEL (Dialog)
            Shows: Announcements + Assignments
            for the selected classroom
        ───────────────────────────────────── */}
        <Dialog open={classDetailOpen} onOpenChange={(open) => { if (!open) { setClassDetailOpen(false); setSelectedClassForDetail(null); } }}>
          <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden p-0 border-none gap-0 flex flex-col">
            {selectedClassForDetail && (
              <>
                {/* Banner */}
                <div
                  className="relative shrink-0 h-28 px-6 pt-5 flex flex-col justify-end pb-4 overflow-hidden"
                  style={{ backgroundColor: selectedClassForDetail.bannerColor }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                  <div className="relative z-10 text-white">
                    <h2 className="text-2xl font-extrabold font-heading">{selectedClassForDetail.name}</h2>
                    <p className="text-white/80 text-sm">{selectedClassForDetail.section} · {selectedClassForDetail.subject}</p>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                    <span className="text-xs text-white/80 font-mono bg-black/20 px-2 py-1 rounded">
                      {enrollmentsTotal.filter((e) => e.classroomId === selectedClassForDetail.id).length} students · Code: <strong>{selectedClassForDetail.code}</strong>
                    </span>
                    <button
                      className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
                      onClick={() => { setClassDetailOpen(false); setSelectedClassForDetail(null); }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex shrink-0 border-b bg-card">
                  {[
                    { id: "announcements", label: "Announcements", icon: <Megaphone className="h-3.5 w-3.5" /> },
                    { id: "assignments", label: "Assignments", icon: <ClipboardList className="h-3.5 w-3.5" /> },
                    { id: "requests", label: `Requests ${joinRequests.filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending").length > 0 ? `(${joinRequests.filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending").length})` : ""}`, icon: <UserCheck className="h-3.5 w-3.5" /> },
                    { id: "materials", label: "Materials", icon: <FileText className="h-3.5 w-3.5" /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveClassTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors ${activeClassTab === tab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab body */}
                <div className="flex-1 overflow-y-auto bg-card">

                  {/* ── ANNOUNCEMENTS TAB ── */}
                  {activeClassTab === "announcements" && (
                    <div className="p-5 space-y-4">
                      {/* Compose */}
                      {isAnnouncing && announceClassroomId === selectedClassForDetail.id ? (
                        <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                          <Input
                            placeholder="Announcement title (optional)"
                            value={announceTitle}
                            onChange={(e) => setAnnounceTitle(e.target.value)}
                          />
                          <Textarea
                            placeholder={`Write a message for ${selectedClassForDetail.name}...`}
                            value={announceContent}
                            onChange={(e) => setAnnounceContent(e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                          {/* Last sent preview */}
                          {classroomAnnouncements[0] && (
                            <div className="rounded bg-muted px-3 py-2">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                                Last sent · {formatDistanceToNow(new Date(classroomAnnouncements[0].created_at), { addSuffix: true })}
                              </p>
                              <p className="text-xs text-foreground line-clamp-2 mt-0.5">{classroomAnnouncements[0].content}</p>
                            </div>
                          )}
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => { setIsAnnouncing(false); setAnnounceClassroomId(null); }}>Cancel</Button>
                            <Button size="sm" className="gap-1.5"
                              disabled={!announceContent.trim() || sendAnnouncementMutation.isPending}
                              onClick={() => sendAnnouncementMutation.mutate({ title: announceTitle, content: announceContent, classroomId: selectedClassForDetail.id })}
                            >
                              <Send className="h-3.5 w-3.5" /> Send to Class
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="w-full flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors bg-muted/10"
                          onClick={() => { setIsAnnouncing(true); setAnnounceClassroomId(selectedClassForDetail.id); }}
                        >
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
                            {getInitials(teacherName)}
                          </div>
                          <span>Announce something to <strong>{selectedClassForDetail.name}</strong>...</span>
                        </button>
                      )}

                      {/* Announcement history */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
                        {classroomAnnouncements.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No announcements yet for this classroom.</p>
                          </div>
                        ) : (
                          classroomAnnouncements.map((ann, i) => (
                            <div
                              key={ann.id}
                              className={`rounded-lg border px-3 py-2.5 space-y-1 ${i === 0
                                  ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
                                  : "border-border bg-muted/10"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                {i === 0 && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Latest</span>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {format(new Date(ann.created_at), "MMM d, h:mm a")}
                                </span>
                              </div>
                              {ann.title && <p className="text-xs font-semibold">{ann.title}</p>}
                              <p className="text-sm leading-relaxed">{ann.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ASSIGNMENTS TAB ── */}
                  {activeClassTab === "assignments" && (
                    <div className="p-5 space-y-4">
                      {classroomAssignments.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm font-medium">No assignments sent to this classroom yet.</p>
                          <p className="text-xs mt-1">Use Assignment Creator and select this classroom when publishing.</p>
                        </div>
                      ) : (
                        <>
                          {/* Published */}
                          {classroomAssignments.filter((a) => a.status === "published").length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-emerald-500" /> Published · Visible to Students
                              </p>
                              {classroomAssignments.filter((a) => a.status === "published").map((a) => (
                                <AssignmentFeedCard key={a.id} assignment={a} onSelect={() => setSelectedAssignment(a.id)} isSelected={selectedAssignment === a.id} />
                              ))}
                            </div>
                          )}
                          {/* Drafts */}
                          {classroomAssignments.filter((a) => a.status !== "published").length > 0 && (
                            <div className="space-y-2 mt-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Drafts · Not sent yet
                              </p>
                              {classroomAssignments.filter((a) => a.status !== "published").map((a) => (
                                <AssignmentFeedCard key={a.id} assignment={a} isDraft onSelect={() => setSelectedAssignment(a.id)} isSelected={selectedAssignment === a.id} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── JOIN REQUESTS TAB ── */}
                  {activeClassTab === "requests" && (
                    <div className="p-5 space-y-3">
                      {joinRequests.filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending").length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No pending join requests.</p>
                        </div>
                      ) : (
                        joinRequests
                          .filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending")
                          .map((req) => (
                            <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                              <div>
                                <p className="text-sm font-medium">{req.studentName}</p>
                                <p className="text-xs text-muted-foreground">Requested to join</p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive hover:bg-destructive/10" onClick={() => rejectJoinRequest(req.id)}>
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button size="sm" className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white" onClick={() => acceptJoinRequest(req.id)}>
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}

                  {/* ── MATERIALS TAB ── */}
                  {activeClassTab === "materials" && (
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Chapter PDFs / Materials</p>
                        <div className="relative">
                          <input type="file" id="material-upload" accept=".pdf" className="hidden" onChange={handleUploadMaterial} disabled={isUploadingMaterial} />
                          <Label htmlFor="material-upload" className="cursor-pointer">
                            <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md transition ${isUploadingMaterial ? "opacity-50" : "hover:bg-accent"}`}>
                              {isUploadingMaterial ? <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Plus className="h-3 w-3" />}
                              Upload PDF
                            </div>
                          </Label>
                        </div>
                      </div>
                      {materials.filter((m) => m.classroomId === selectedClassForDetail.id).length === 0 ? (
                        <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>No materials uploaded yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {materials.filter((m) => m.classroomId === selectedClassForDetail.id).map((mat) => (
                            <div key={mat.id} className="flex items-center justify-between p-3 border rounded-lg bg-background group">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-sm">PDF</div>
                                <div>
                                  <p className="text-sm font-medium truncate max-w-[200px]">{mat.fileName}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(mat.uploadedAt).toLocaleDateString()} · {mat.fileSize}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => {
                                  if (mat.filePath) window.open(`${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8002"}/uploads/${mat.filePath}`, "_blank");
                                  else setViewingMaterialText({ title: mat.fileName, content: mat.extractedText });
                                }}>
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteClassroomMaterial(mat.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Global Activity Stream ── */}
        <div className="max-w-4xl mb-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Megaphone className="h-5 w-5 text-primary" /> Global Stream
            </h2>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setIsAnnouncing(true); setAnnounceClassroomId(null); }}>
              <Megaphone className="h-3.5 w-3.5" /> Announce to All
            </Button>
          </div>

          {/* Global announce composer */}
          {isAnnouncing && !announceClassroomId && (
            <Card className="shadow-none border border-slate-200">
              <CardContent className="p-4 space-y-3">
                <Input placeholder="Announcement Title (optional)" value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} className="bg-muted/30" />
                <Textarea placeholder="Announce something to all your classes..." value={announceContent} onChange={(e) => setAnnounceContent(e.target.value)} className="min-h-[80px] bg-muted/30" />
                {lastAnnouncement && (
                  <div className="rounded bg-muted px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                      Last sent · {formatDistanceToNow(new Date(lastAnnouncement.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-foreground line-clamp-1 mt-0.5">{lastAnnouncement.content}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAnnouncing(false)}>Cancel</Button>
                  <Button size="sm" className="gap-1.5"
                    disabled={!announceContent.trim() || sendAnnouncementMutation.isPending}
                    onClick={() => sendAnnouncementMutation.mutate({ title: announceTitle, content: announceContent, classroomId: null })}
                  >
                    <Send className="h-3.5 w-3.5" /> Send to All Classes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compose trigger if not composing */}
          {!isAnnouncing && (
            <Card className="shadow-none border border-slate-200 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setIsAnnouncing(true); setAnnounceClassroomId(null); }}>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
                  {getInitials(teacherName)}
                </div>
                <p className="text-sm text-muted-foreground">Announce something to your classes...</p>
              </CardContent>
            </Card>
          )}

          {/* Unified feed: announcements + assignments sorted by date */}
          {(() => {
            const feedItems = [
              ...assignments.map((a) => ({
                type: "assignment" as const,
                data: a,
                dateMs: a.created_at ? new Date(a.created_at).getTime() : 0,
              })),
              ...allAnnouncements.map((a) => ({
                type: "announcement" as const,
                data: a,
                dateMs: new Date(a.created_at).getTime(),
              })),
            ].sort((a, b) => b.dateMs - a.dateMs);

            if (feedItems.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-xl border border-dashed text-muted-foreground">
                  <Megaphone className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">The global stream is quiet. Create an assignment or send an announcement.</p>
                </div>
              );
            }

            return feedItems.map((item, index) => {
              if (item.type === "announcement") {
                const ann = item.data as Announcement;
                return (
                  <Card key={`ann-${ann.id || index}`} className="shadow-none border-amber-200 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10">
                    <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm sm:text-base font-semibold">{ann.author_name || teacherName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(ann.created_at), "MMM d, yyyy")}</p>
                          </div>
                          {ann.pinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
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

              const a = item.data as AssignmentItem;
              return (
                <Card
                  key={`assg-${a.id}`}
                  className={`shadow-none border-slate-200 hover:shadow-sm transition-all relative overflow-hidden cursor-pointer ${selectedAssignment === a.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
                  <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {a.status === "published" ? (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 py-0">Sent to Students</Badge>
                            ) : (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 py-0">Draft</Badge>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-semibold truncate">
                            You posted a new assignment: {a.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.created_at ? format(new Date(a.created_at), "MMM d, yyyy") : "Posted"}
                            {a.due_date ? ` · Due ${format(new Date(a.due_date), "MMM d, yyyy")}` : ""}
                            {a.total_marks ? ` · ${a.total_marks} marks` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this assignment?")) deleteMutation.mutate(a.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>

        {/* Submission grading panel */}
        {selectedAssignment && (
          <div className="space-y-4 max-w-4xl mb-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Student Submissions</h3>
                <Badge className="bg-primary/10 text-primary border-none ml-1">{submissions.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedAssignment(null)}>
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
            </div>
            {submissions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No submissions yet for this assignment.</p>
                  <p className="text-xs mt-1">Submissions will appear here once students upload their PDFs.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {submissions.map((s: SubmissionItem) => {
                  const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "");
                  const pdfUrl = s.pdf_path ? `${BACKEND_URL}/uploads/${s.pdf_path}` : null;
                  return (
                    <Card key={s.id} className="shadow-sm border-slate-200">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                              {(s.student_name || s.student_id).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{s.student_name || s.student_id.slice(0, 8)}</p>
                              {s.student_email && <p className="text-xs text-muted-foreground">{s.student_email}</p>}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Submitted {s.submitted_at ? format(new Date(s.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {pdfUrl && (
                              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.open(pdfUrl, "_blank")}>
                                <FileText className="h-3.5 w-3.5" /> View Submitted PDF
                              </Button>
                            )}
                            {s.marks != null && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">
                                {s.marks} marks
                              </Badge>
                            )}
                          </div>
                        </div>
                        {s.content && s.content !== `Submitted file: ${s.pdf_path?.split('/').pop()}` && (
                          <p className="text-sm bg-muted/50 p-3 rounded-md">{s.content}</p>
                        )}
                        {s.image_path && (
                          <img src={`${(import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/api$/, "")}/uploads/${s.image_path}`} alt="Submission" className="rounded-md max-h-48 object-contain border" />
                        )}
                        {s.extracted_text && (
                          <div className="rounded-md bg-accent/30 border border-accent p-3 text-sm space-y-1">
                            <p className="font-medium text-xs text-muted-foreground">OCR Extracted Text</p>
                            <p className="whitespace-pre-wrap text-foreground line-clamp-4">{s.extracted_text}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Input type="number" placeholder="Marks" defaultValue={s.marks ?? ""} className="w-24"
                            onBlur={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              gradeMutation.mutate({ id: s.id, marks: val, grade: s.grade || "", feedback: s.feedback || "" });
                            }}
                          />
                          <Input placeholder="Grade (A+)" defaultValue={s.grade || ""} className="w-24"
                            onBlur={(e) => {
                              if (e.target.value !== (s.grade || "")) gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: e.target.value, feedback: s.feedback || "" });
                            }}
                          />
                          <Input placeholder="Feedback for student" defaultValue={s.feedback || ""} className="flex-1"
                            onBlur={(e) => {
                              if (e.target.value !== (s.feedback || "")) gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: s.grade || "", feedback: e.target.value });
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Create Class Modal ── */}
        <Dialog open={createClassOpen} onOpenChange={setCreateClassOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create class</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClass(); }} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Class name (required)</Label><Input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required autoFocus placeholder="e.g. Science 101" /></div>
              <div className="space-y-2"><Label>Section</Label><Input value={newClassSection} onChange={(e) => setNewClassSection(e.target.value)} placeholder="e.g. Morning Batch" /></div>
              <div className="space-y-2"><Label>Subject</Label><Input value={newClassSubject} onChange={(e) => setNewClassSubject(e.target.value)} placeholder="e.g. Physics" /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setCreateClassOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!newClassName.trim()}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Edit Class Modal ── */}
        <Dialog open={editClassOpen} onOpenChange={setEditClassOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit class details</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleEditClass(); }} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Class name (required)</Label><Input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} required autoFocus /></div>
              <div className="space-y-2"><Label>Section</Label><Input value={editClassSection} onChange={(e) => setEditClassSection(e.target.value)} /></div>
              <div className="space-y-2"><Label>Subject</Label><Input value={editClassSubject} onChange={(e) => setEditClassSubject(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setEditClassOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!editClassName.trim()}>Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Material text viewer ── */}
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
      </div>

      {/* ══════════════ SCOPED STYLES ══════════════ */}
      <style>{`
        .gc-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 12px; flex-wrap: wrap; }
        .gc-greeting { font-size: 1.5rem; font-weight: 700; color: hsl(var(--foreground)); margin: 0; }
        .gc-name { color: hsl(var(--primary)); }
        .gc-sub { font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin: 4px 0 0; }
        .gc-join-btn { display: flex; align-items: center; gap: 6px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 24px; padding: 10px 20px; font-weight: 600; font-size: 0.9rem; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.15); transition: filter .2s; }
        .gc-join-btn:hover { filter: brightness(0.9); }
        .gc-btn-icon { width: 18px; height: 18px; }

        .gc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

        .gc-card { border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); cursor: pointer; transition: box-shadow .2s, transform .2s; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); }
        .gc-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.15); transform: translateY(-2px); }
        .gc-card-banner { position: relative; height: 100px; padding: 16px; overflow: hidden; }
        .gc-card-banner-content { position: relative; z-index: 1; }
        .gc-card-name { font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0 0 2px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .gc-card-section { font-size: 0.78rem; color: rgba(255,255,255,.85); margin: 0; }
        .gc-card-teacher { font-size: 0.82rem; color: rgba(255,255,255,.9); margin: 2px 0 0; font-weight: 600; text-transform: uppercase; }
        .gc-card-menu { position: absolute; top: 8px; right: 8px; z-index: 10; }
        .gc-more-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.2); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
        .gc-more-btn:hover { background: rgba(255,255,255,.3); }
        .gc-teacher-avatar { position: absolute; bottom: -20px; left: 16px; width: 48px; height: 48px; border-radius: 50%; background: hsl(var(--card)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; color: hsl(var(--foreground)); box-shadow: 0 2px 6px rgba(0,0,0,.15); border: 3px solid hsl(var(--card)); z-index: 2; }
        .gc-card-body { padding: 32px 16px 12px; background: hsl(var(--card)); }

        .gc-dropdown { background: hsl(var(--popover)); border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 4px; }
        .gc-dd-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.875rem; color: hsl(var(--foreground)); cursor: pointer; border-radius: 4px; }
        .gc-dd-item:hover { background: hsl(var(--muted)); }
      `}</style>
    </DashboardLayout>
  );
}

/* ── Assignment card sub-component for the classroom detail panel ── */
function AssignmentFeedCard({
  assignment,
  isDraft = false,
  onSelect,
  isSelected,
}: {
  assignment: AssignmentItem;
  isDraft?: boolean;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border px-3 py-3 space-y-1.5 cursor-pointer transition-colors ${isSelected ? "border-primary/50 bg-primary/5" :
          isDraft ? "border-dashed border-muted-foreground/30 bg-muted/10 hover:border-muted-foreground/50" :
            "border-border bg-background hover:border-primary/30"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {isDraft ? (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 py-0">Draft</Badge>
            ) : (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 py-0">Sent to Students</Badge>
            )}
          </div>
          <p className="font-medium text-sm truncate">{assignment.title}</p>
        </div>
        {assignment.total_marks && (
          <span className="text-xs text-muted-foreground shrink-0">{assignment.total_marks}m</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {assignment.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue && !isDraft ? "text-destructive font-medium" : ""}`}>
            <Clock className="h-3 w-3" />
            {isOverdue && !isDraft ? "Overdue · " : "Due · "}
            {format(new Date(assignment.due_date), "MMM d")}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}