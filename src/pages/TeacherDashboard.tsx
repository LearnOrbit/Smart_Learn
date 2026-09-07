import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  Plus, FileText, Users, Trash2, MoreVertical,
  Copy, UserCheck, Check, X, Megaphone, Pin, Send,
  BookOpen, ClipboardList, AlertCircle, Clock, Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, SectionHeader, StatCard, StatCardGrid, EmptyState } from "@/components/ui";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
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
  // `pages` namespace + `teacherDashboard:` prefix → resolves to the
  // teacher dashboard's per-page bundle. `loaded: Set` inside the
  // loader makes this idempotent on remount.
  const { t } = useTranslation("pages");
  useEffect(() => {
    void loadPageNamespace("teacherDashboard");
  }, []);

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

  const teacherName = user?.email?.split("@")[0]?.replace(/\./g, " ") || t("teacherDashboard:defaults.teacher");

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
      toast({ title: t("teacherDashboard:toasts.announcementSent") });
    },
    onError: (e: Error) => toast({ title: t("teacherDashboard:toasts.failedToSend"), description: e.message, variant: "destructive" }),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, grade, feedback }: { id: string; marks: number | null; grade: string; feedback: string }) => {
      const { error } = await apiClient.put(`/submissions/${id}`, { marks, grade, feedback });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["submissions"] }); toast({ title: t("teacherDashboard:toasts.graded") }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await apiClient.delete(`/assignments/${id}`); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", user?.id] });
      setSelectedAssignment(null);
      toast({ title: t("teacherDashboard:toasts.assignmentDeleted") });
    },
    onError: (e: Error) => toast({ title: t("teacherDashboard:toasts.error"), description: e.message, variant: "destructive" }),
  });

  /* ── Classroom CRUD ── */
  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    const colorTheme = BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
    try {
      const newClass = await createClassroom({
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
      toast({ title: t("teacherDashboard:toasts.classCreated", { name: newClass.name, code: newClass.code }) });
    } catch (e) {
      toast({
        title: t("teacherDashboard:toasts.failedToCreateClass"),
        description: e instanceof Error ? e.message : t("teacherDashboard:createClass.tryAgain"),
        variant: "destructive",
      });
    }
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
    toast({ title: t("teacherDashboard:toasts.classUpdated") });
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
      toast({ title: t("teacherDashboard:toasts.materialUploaded") });
    } catch (err: any) {
      toast({ title: t("teacherDashboard:toasts.uploadFailed"), description: err.message, variant: "destructive" });
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

  const totalStudents = enrollmentsTotal.length;
  const totalPendingRequests = joinRequests.filter((r) => r.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="w-full flex flex-col space-y-6">
        {/* ── Welcome Header ── */}
        <PageHeader
          title={t("teacherDashboard:header.title", { name: teacherName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") })}
          description={t("teacherDashboard:header.description")}
          action={
            <Button onClick={() => setCreateClassOpen(true)} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("teacherDashboard:header.createClass")}</span>
            </Button>
          }
        />

        {/* ── Stats Overview ── */}
        <StatCardGrid columns={4}>
          <StatCard
            title={t("teacherDashboard:stats.totalClasses")}
            value={classrooms.length}
            description={t("teacherDashboard:stats.activeClassrooms")}
            icon={<BookOpen className="h-6 w-6" />}
            delay={0}
          />
          <StatCard
            title={t("teacherDashboard:stats.studentsEnrolled")}
            value={totalStudents}
            description={t("teacherDashboard:stats.acrossAllClasses")}
            icon={<Users className="h-6 w-6" />}
            delay={0.1}
          />
          <StatCard
            title={t("teacherDashboard:stats.activeAssignments")}
            value={publishedAssignments.length}
            description={t("teacherDashboard:stats.drafts", { count: draftAssignments.length })}
            icon={<FileText className="h-6 w-6" />}
            delay={0.2}
          />
          <StatCard
            title={t("teacherDashboard:stats.pendingRequests")}
            value={totalPendingRequests}
            description={t("teacherDashboard:stats.awaitingApproval")}
            icon={<UserCheck className="h-6 w-6" />}
            delay={0.3}
          />
        </StatCardGrid>

        {/* ── Class Cards Grid ── */}
        <SectionHeader
          title={t("teacherDashboard:classes.sectionTitle")}
          description={t("teacherDashboard:classes.sectionDescription")}
          count={classrooms.length}
          icon={<BookOpen className="h-5 w-5" />}
        />

        {classrooms.length === 0 ? (
          <EmptyState
            title={t("teacherDashboard:classes.emptyTitle")}
            description={t("teacherDashboard:classes.emptyDescription")}
            icon={<Users className="h-10 w-10" />}
            action={
              <Button onClick={() => setCreateClassOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t("teacherDashboard:classes.emptyAction")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {classrooms.map((cls, index) => {
              const pendingCount = joinRequests.filter((r) => r.classroomId === cls.id && r.status === "pending").length;
              const assignmentCount = assignments.filter((a) => a.classroom_id === cls.id).length;
              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -4, boxShadow: "var(--shadow-xl)" }}
                  onClick={() => { setSelectedClassForDetail(cls); setClassDetailOpen(true); setActiveClassTab("announcements"); }}
                  className="group rounded-xl overflow-hidden shadow-sm border border-border bg-card cursor-pointer transition-all duration-200"
                >
                  {/* Banner */}
                  <div
                    className="relative h-24 px-5 pt-4 pb-3 flex flex-col justify-end overflow-hidden"
                    style={{ backgroundColor: cls.bannerColor }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/30 to-transparent" />
                    <div
                      className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20"
                      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)" }}
                    />
                    <div className="relative z-10 text-white">
                      <h3 className="text-base font-bold leading-tight line-clamp-2">
                        {cls.name}
                      </h3>
                      {cls.section && (
                        <p className="text-xs text-white/80 mt-0.5">{cls.section}</p>
                      )}
                    </div>
                    <div
                      className="absolute top-3 right-3 z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cls.code); toast({ title: t("teacherDashboard:toasts.codeCopied") }); }}>
                            <Copy className="h-4 w-4 mr-2" /> {t("teacherDashboard:classActions.copyCode")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditModal(cls); }}>
                            <FileText className="h-4 w-4 mr-2" /> {t("teacherDashboard:classActions.editDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(t("teacherDashboard:toasts.classDeleteFailed", { name: cls.name }))) {
                                try { await deleteClassroom(cls.id); } catch {}
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> {t("teacherDashboard:classActions.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="relative p-4 pt-8">
                    {/* Avatar overlap */}
                    <div className="absolute -top-6 left-4 h-12 w-12 rounded-full bg-card flex items-center justify-center font-bold text-sm text-foreground shadow-md border-2 border-card">
                      {getInitials(cls.teacherName)}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                      {cls.subject || t("teacherDashboard:classes.noSubject")}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded border">
                        {cls.code}
                      </code>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {pendingCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {t("teacherDashboard:classes.pending", { count: pendingCount })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {assignmentCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
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
                    <h2 className="text-2xl font-bold">{selectedClassForDetail.name}</h2>
                    <p className="text-white/80 text-sm">{selectedClassForDetail.section} · {selectedClassForDetail.subject}</p>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                    <span className="text-xs text-white/80 font-mono bg-black/20 px-2 py-1 rounded">
                      {enrollmentsTotal.filter((e) => e.classroomId === selectedClassForDetail.id).length} {t("teacherDashboard:banner.students")} · {t("teacherDashboard:banner.code")}: <strong>{selectedClassForDetail.code}</strong>
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
                    { id: "announcements", label: t("teacherDashboard:tabs.announcements"), icon: <Megaphone className="h-3.5 w-3.5" /> },
                    { id: "assignments", label: t("teacherDashboard:tabs.assignments"), icon: <ClipboardList className="h-3.5 w-3.5" /> },
                    { id: "requests", label: t("teacherDashboard:tabs.requests") + (joinRequests.filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending").length > 0 ? ` (${joinRequests.filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending").length})` : ""), icon: <UserCheck className="h-3.5 w-3.5" /> },
                    { id: "materials", label: t("teacherDashboard:tabs.materials"), icon: <FileText className="h-3.5 w-3.5" /> },
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
                            placeholder={t("teacherDashboard:announcements.titlePlaceholder")}
                            value={announceTitle}
                            onChange={(e) => setAnnounceTitle(e.target.value)}
                          />
                          <Textarea
                            placeholder={t("teacherDashboard:announcements.writeMessage", { name: selectedClassForDetail.name })}
                            value={announceContent}
                            onChange={(e) => setAnnounceContent(e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                          {/* Last sent preview */}
                          {classroomAnnouncements[0] && (
                            <div className="rounded bg-muted px-3 py-2">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                                {t("teacherDashboard:announcements.lastSent")} · {formatDistanceToNow(new Date(classroomAnnouncements[0].created_at), { addSuffix: true })}
                              </p>
                              <p className="text-xs text-foreground line-clamp-2 mt-0.5">{classroomAnnouncements[0].content}</p>
                            </div>
                          )}
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => { setIsAnnouncing(false); setAnnounceClassroomId(null); }}>{t("teacherDashboard:announcements.cancel")}</Button>
                            <Button size="sm" className="gap-1.5"
                              disabled={!announceContent.trim() || sendAnnouncementMutation.isPending}
                              onClick={() => sendAnnouncementMutation.mutate({ title: announceTitle, content: announceContent, classroomId: selectedClassForDetail.id })}
                            >
                              <Send className="h-3.5 w-3.5" /> {t("teacherDashboard:announcements.sendToClass")}
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
                          <span>{t("teacherDashboard:announcements.trigger", { name: selectedClassForDetail.name })}</span>
                        </button>
                      )}

                      {/* Announcement history */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("teacherDashboard:announcements.history")}</p>
                        {classroomAnnouncements.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">{t("teacherDashboard:announcements.emptyForClass")}</p>
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
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{t("teacherDashboard:announcements.latest")}</span>
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
                          <p className="text-sm font-medium">{t("teacherDashboard:assignments.noAssignmentsInClass")}</p>
                          <p className="text-xs mt-1">{t("teacherDashboard:assignments.createInstructions")}</p>
                        </div>
                      ) : (
                        <>
                          {/* Published */}
                          {classroomAssignments.filter((a) => a.status === "published").length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-emerald-500" /> {t("teacherDashboard:assignments.publishedHeader")}
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
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> {t("teacherDashboard:assignments.draftsHeader")}
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
                          <p className="text-sm">{t("teacherDashboard:assignments.noDrafts")}</p>
                        </div>
                      ) : (
                        joinRequests
                          .filter((r) => r.classroomId === selectedClassForDetail.id && r.status === "pending")
                          .map((req) => (
                            <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                              <div>
                                <p className="text-sm font-medium">{req.studentName}</p>
                                <p className="text-xs text-muted-foreground">{t("teacherDashboard:assignments.requestedToJoin")}</p>
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
                        <p className="text-sm font-semibold">{t("teacherDashboard:materials.sectionTitle")}</p>
                        <div className="relative">
                          <input type="file" id="material-upload" accept=".pdf" className="hidden" onChange={handleUploadMaterial} disabled={isUploadingMaterial} />
                          <Label htmlFor="material-upload" className="cursor-pointer">
                            <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md transition ${isUploadingMaterial ? "opacity-50" : "hover:bg-accent"}`}>
                              {isUploadingMaterial ? <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Plus className="h-3 w-3" />}
                              {t("teacherDashboard:materials.upload")}
                            </div>
                          </Label>
                        </div>
                      </div>
                      {materials.filter((m) => m.classroomId === selectedClassForDetail.id).length === 0 ? (
                        <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>{t("teacherDashboard:materials.empty")}</p>
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
        <div className="max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Megaphone className="h-5 w-5 text-primary" /> {t("teacherDashboard:announcements.globalStream")}
            </h2>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setIsAnnouncing(true); setAnnounceClassroomId(null); }}>
              <Megaphone className="h-3.5 w-3.5" /> {t("teacherDashboard:announcements.announceToAll")}
            </Button>
          </div>

          {/* Global announce composer */}
          {isAnnouncing && !announceClassroomId && (
            <Card className="shadow-none border border-slate-200">
              <CardContent className="p-4 space-y-3">
                <Input placeholder={t("teacherDashboard:announcements.globalPlaceholderTitle")} value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} className="bg-muted/30" />
                <Textarea placeholder={t("teacherDashboard:announcements.globalPlaceholder")} value={announceContent} onChange={(e) => setAnnounceContent(e.target.value)} className="min-h-[80px] bg-muted/30" />
                {lastAnnouncement && (
                  <div className="rounded bg-muted px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                      {t("teacherDashboard:announcements.lastSent")} · {formatDistanceToNow(new Date(lastAnnouncement.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-foreground line-clamp-1 mt-0.5">{lastAnnouncement.content}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAnnouncing(false)}>{t("teacherDashboard:announcements.cancel")}</Button>
                  <Button size="sm" className="gap-1.5"
                    disabled={!announceContent.trim() || sendAnnouncementMutation.isPending}
                    onClick={() => sendAnnouncementMutation.mutate({ title: announceTitle, content: announceContent, classroomId: null })}
                  >
                    <Send className="h-3.5 w-3.5" /> {t("teacherDashboard:announcements.sendToAll")}
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
                <p className="text-sm text-muted-foreground">{t("teacherDashboard:announcements.globalTrigger")}</p>
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
                  <p className="text-sm">{t("teacherDashboard:announcements.emptyGlobal")}</p>
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
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 py-0">{t("teacherDashboard:assignments.sentToStudents")}</Badge>
                            ) : (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 py-0">{t("teacherDashboard:assignments.draft")}</Badge>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-semibold truncate">
                            {t("teacherDashboard:assignments.newAssignment", { title: a.title })}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.created_at ? format(new Date(a.created_at), "MMM d, yyyy") : t("teacherDashboard:assignments.posted")}
                            {a.due_date ? ` · ${t("teacherDashboard:assignments.due")} ${format(new Date(a.due_date), "MMM d, yyyy")}` : ""}
                            {a.total_marks ? ` · ${a.total_marks} ${t("teacherDashboard:assignments.marks")}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t("teacherDashboard:toasts.deleteConfirm"))) deleteMutation.mutate(a.id);
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
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("teacherDashboard:grading.title")}</h3>
                <Badge className="bg-primary/10 text-primary border-none ml-1">{submissions.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedAssignment(null)}>
                <X className="h-4 w-4 mr-1" /> {t("teacherDashboard:grading.close")}
              </Button>
            </div>
            {submissions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">{t("teacherDashboard:grading.empty")}</p>
                  <p className="text-xs mt-1">{t("teacherDashboard:grading.emptyDesc")}</p>
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
                                {t("teacherDashboard:grading.submitted")} {s.submitted_at ? format(new Date(s.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {pdfUrl && (
                              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => window.open(pdfUrl, "_blank")}>
                                <FileText className="h-3.5 w-3.5" /> {t("teacherDashboard:grading.viewPdf")}
                              </Button>
                            )}
                            {s.marks != null && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">
                                {s.marks} {t("teacherDashboard:grading.marks")}
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
                            <p className="font-medium text-xs text-muted-foreground">{t("teacherDashboard:grading.ocrTitle")}</p>
                            <p className="whitespace-pre-wrap text-foreground line-clamp-4">{s.extracted_text}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Input type="number" placeholder={t("teacherDashboard:grading.marksPlaceholder")} defaultValue={s.marks ?? ""} className="w-24"
                            onBlur={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              gradeMutation.mutate({ id: s.id, marks: val, grade: s.grade || "", feedback: s.feedback || "" });
                            }}
                          />
                          <Input placeholder={t("teacherDashboard:grading.gradePlaceholder")} defaultValue={s.grade || ""} className="w-24"
                            onBlur={(e) => {
                              if (e.target.value !== (s.grade || "")) gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: e.target.value, feedback: s.feedback || "" });
                            }}
                          />
                          <Input placeholder={t("teacherDashboard:grading.feedbackPlaceholder")} defaultValue={s.feedback || ""} className="flex-1"
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
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("teacherDashboard:createClass.title")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClass(); }} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>{t("teacherDashboard:createClass.nameLabel")}</Label><Input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required autoFocus placeholder={t("teacherDashboard:createClass.namePlaceholder")} /></div>
              <div className="space-y-2"><Label>{t("teacherDashboard:createClass.sectionLabel")}</Label><Input value={newClassSection} onChange={(e) => setNewClassSection(e.target.value)} placeholder={t("teacherDashboard:createClass.sectionPlaceholder")} /></div>
              <div className="space-y-2"><Label>{t("teacherDashboard:createClass.subjectLabel")}</Label><Input value={newClassSubject} onChange={(e) => setNewClassSubject(e.target.value)} placeholder={t("teacherDashboard:createClass.subjectPlaceholder")} /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setCreateClassOpen(false)}>{t("teacherDashboard:createClass.cancel")}</Button>
                <Button type="submit" disabled={!newClassName.trim()}>{t("teacherDashboard:createClass.create")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Edit Class Modal ── */}
        <Dialog open={editClassOpen} onOpenChange={setEditClassOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("teacherDashboard:editClass.title")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleEditClass(); }} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>{t("teacherDashboard:editClass.nameLabel")}</Label><Input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} required autoFocus /></div>
              <div className="space-y-2"><Label>{t("teacherDashboard:editClass.sectionLabel")}</Label><Input value={editClassSection} onChange={(e) => setEditClassSection(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("teacherDashboard:editClass.subjectLabel")}</Label><Input value={editClassSubject} onChange={(e) => setEditClassSubject(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setEditClassOpen(false)}>{t("teacherDashboard:editClass.cancel")}</Button>
                <Button type="submit" disabled={!editClassName.trim()}>{t("teacherDashboard:editClass.save")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Material text viewer ── */}
        <Dialog open={!!viewingMaterialText} onOpenChange={(open) => !open && setViewingMaterialText(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewingMaterialText?.title}</DialogTitle>
              <DialogDescription>{t("teacherDashboard:materials.extractedText")}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-md whitespace-pre-wrap font-mono text-sm">
              {viewingMaterialText?.content}
            </div>
          </DialogContent>
        </Dialog>
      </div>
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
  const { t } = useTranslation("pages");
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
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 py-0">{t("teacherDashboard:assignments.draft")}</Badge>
            ) : (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 py-0">{t("teacherDashboard:assignments.sentToStudents")}</Badge>
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
            {isOverdue && !isDraft ? "Overdue · " : `${t("teacherDashboard:assignments.due")} · `}
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