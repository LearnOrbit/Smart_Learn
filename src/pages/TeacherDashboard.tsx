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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, FileText, Users, Lightbulb, Trash2, MoreVertical, Copy, UserCheck, Check, X, Megaphone, Pin } from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getClassrooms, createClassroom, deleteClassroom, updateClassroom, getJoinRequests, acceptJoinRequest, rejectJoinRequest, getEnrollments, Classroom, JoinRequest, ClassroomMaterial, getClassroomMaterials, addClassroomMaterial, deleteClassroomMaterial } from "@/utils/mockClassrooms";

const BANNER_COLORS = [
  { bannerColor: "#1e7e6e", cardColor: "#e0f2f1" }, // teal
  { bannerColor: "#1565c0", cardColor: "#e3f2fd" }, // blue
  { bannerColor: "#6a1b9a", cardColor: "#f3e5f5" }, // purple
  { bannerColor: "#ad1457", cardColor: "#fce4ec" }, // pink-red
  { bannerColor: "#f57f17", cardColor: "#fff8e1" }, // amber
  { bannerColor: "#2e7d32", cardColor: "#e8f5e9" }, // green
];

const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

interface LearningOutcomeItem {
  id: string;
  code: string;
  description: string;
  course_outcome_id: string | null;
}

interface AssignmentItem {
  id: string;
  teacher_id: string;
  title: string;
  description: string;
  due_date: string | null;
  created_at: string;
}


interface SubmissionItem {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string;
  marks: number | null;
  grade: string | null;
  feedback: string | null;
  image_path: string | null;
  extracted_text: string | null;
  submitted_at: string;
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

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSection, setNewClassSection] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");
  
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassSection, setEditClassSection] = useState("");
  const [editClassSubject, setEditClassSubject] = useState("");
  
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState<any[]>([]);
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);

  useEffect(() => {
    const loadClassrooms = () => {
      setClassrooms(getClassrooms());
      setJoinRequests(getJoinRequests());
      setEnrollmentsTotal(getEnrollments());
      setMaterials(getClassroomMaterials());
    };
    loadClassrooms();
    window.addEventListener("classroomSync", loadClassrooms);
    window.addEventListener("storage", loadClassrooms); // Cross-tab native sync
    return () => {
      window.removeEventListener("classroomSync", loadClassrooms);
      window.removeEventListener("storage", loadClassrooms);
    };
  }, []);

  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;
    
    setIsUploadingMaterial(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await apiClient.postFormData("/extract-text/pdf", formData);
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error.message || "Failed to extract text");
      
      addClassroomMaterial({
        classroomId: selectedClass.id,
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        extractedText: res.data.extracted_text || "",
      });
      toast({ title: "Material uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingMaterial(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCreateClass = () => {
    if (!newClassName.trim()) return;
    const colorTheme = BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
    const newClass = createClassroom({
      name: newClassName,
      section: newClassSection,
      subject: newClassSubject,
      teacherName: user?.email?.split("@")[0]?.replace(/\./g, " ") || "Teacher",
      bannerColor: colorTheme.bannerColor,
      cardColor: colorTheme.cardColor
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
    updateClassroom(editingClassId, {
      name: editClassName,
      section: editClassSection,
      subject: editClassSubject,
    });
    setEditClassOpen(false);
    toast({ title: `Class updated!` });
  };

  // Fetch learning outcomes for the dropdown
  const { data: learningOutcomes = [] } = useQuery({
    queryKey: ["learning_outcomes"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/learning-outcomes");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await apiClient.get("/assignments");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", selectedAssignment],
    queryFn: async () => {
      const { data, error } = await apiClient.get(`/submissions?assignment_id=${selectedAssignment}`);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAssignment,
  });

  const { data: announcementsData } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiClient.get("/announcements/"),
  });
  const allAnnouncements: Announcement[] = announcementsData?.data?.announcements || [];

  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post("/announcements/", {
        title: announceTitle,
        message: announceContent,
        subject_id: null,
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

  const teacherName = user?.email?.split("@")[0]?.replace(/\./g, " ") || "Teacher";

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.post("/assignments", {
        title,
        description,
        due_date: dueDate || null,
        learning_outcome_ids: selectedLOs,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment_lo_mapping"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedLOs([]);
      toast({ title: "Assignment created!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ id, marks, grade, feedback }: { id: string; marks: number | null; grade: string; feedback: string }) => {
      const { error } = await apiClient.put(`/submissions/${id}`, { marks, grade, feedback });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      toast({ title: "Graded!" });
    },
  });

  const toggleLO = (loId: string) => {
    setSelectedLOs((prev) =>
      prev.includes(loId) ? prev.filter((id) => id !== loId) : [...prev, loId]
    );
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.delete(`/assignments/${id}`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment_lo_mapping"] });
      setSelectedAssignment(null);
      toast({ title: "Assignment deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });



  return (
    <DashboardLayout>
      <div className="gc-page w-full flex flex-col pt-4">

        {/* ── Top bar ── */}
        <div className="gc-topbar">
          <div>
            <h1 className="gc-greeting">Welcome back, <span className="gc-name">{user?.email?.split("@")[0] || "Teacher"}</span> 👋</h1>
            <p className="gc-sub">Manage your classrooms and pending requests</p>
          </div>
          <Button className="gc-join-btn" onClick={() => setCreateClassOpen(true)}>
            <Plus className="gc-btn-icon" /> Create Class
          </Button>
        </div>

        {/* ── Class Cards Grid ── */}
        {classrooms.length === 0 ? (
          <Card className="mb-12 border-none shadow-sm"><CardContent className="py-12 flex flex-col items-center"><Users className="h-10 w-10 text-muted-foreground mb-4 opacity-50"/><p className="text-muted-foreground text-sm">No classes created yet. Create one to get an invite code for your students!</p></CardContent></Card>
        ) : (
          <div className="gc-grid mb-12">
            {classrooms.map((cls) => (
              <div key={cls.id} className="gc-card" onClick={() => setSelectedClass(cls)}>
                <div className="gc-card-banner" style={{ backgroundColor: cls.bannerColor }}>
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
                        <DropdownMenuItem className="gc-dd-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cls.code); toast({title: "Code copied!"}); }}>
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
                  <div className="gc-teacher-avatar">
                    <span>{getInitials(cls.teacherName)}</span>
                  </div>
                </div>
                <div className="gc-card-body pb-4">
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-mono bg-muted px-2 py-1 rounded border">Code: <strong>{cls.code}</strong></p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {joinRequests.filter(r => r.classroomId === cls.id && r.status === "pending").length} requests
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Class Detail Modal ── */}
        <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
          <DialogContent className="gc-modal max-w-2xl max-h-[85vh] overflow-y-auto p-0 border-none gap-0">
            {selectedClass && (
              <>
                <div className="relative h-28 px-6 pt-6 overflow-hidden flex flex-col justify-end pb-4" style={{ backgroundColor: selectedClass.bannerColor }}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                  <div className="relative z-10 text-white">
                    <h2 className="text-2xl font-bold">{selectedClass.name}</h2>
                    <p className="text-white/80 text-sm mt-1">{selectedClass.section} • {selectedClass.subject}</p>
                  </div>
                  <button className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition z-10" onClick={() => setSelectedClass(null)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-6 bg-card">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Left col: Join Requests */}
                    <div className="flex-1 space-y-4">
                      <h3 className="font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /> Pending Requests</h3>
                      {joinRequests.filter(r => r.classroomId === selectedClass.id && r.status === "pending").length === 0 ? (
                        <p className="text-sm text-muted-foreground italic border rounded p-4 text-center">No students are awaiting approval.</p>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                          {joinRequests.filter(r => r.classroomId === selectedClass.id && r.status === "pending").map(req => (
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
                          ))}
                        </div>
                      )}
                      
                      {/* Course Materials */}
                      <div className="mt-8 border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Chapter PDFs / Materials</h3>
                          <div className="relative">
                            <input type="file" id="material-upload" accept=".pdf" className="hidden" onChange={handleUploadMaterial} disabled={isUploadingMaterial} />
                            <Label htmlFor="material-upload" className="cursor-pointer">
                              <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-md transition ${isUploadingMaterial ? 'opacity-50' : 'hover:bg-accent'}`}>
                                {isUploadingMaterial ? <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Plus className="h-4 w-4" />}
                                Upload Material
                              </div>
                            </Label>
                          </div>
                        </div>
                        
                        {materials.filter(m => m.classroomId === selectedClass.id).length === 0 ? (
                          <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>No materials uploaded yet</p>
                            <p className="text-xs opacity-70">Upload PDFs to make them available to your students for NotebookLM-style chat.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {materials.filter(m => m.classroomId === selectedClass.id).map(mat => (
                              <div key={mat.id} className="flex items-center justify-between p-3 border rounded-lg bg-background group">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold">
                                    PDF
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium truncate max-w-[200px]">{mat.fileName}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(mat.uploadedAt).toLocaleDateString()} • {mat.fileSize}</p>
                                  </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteClassroomMaterial(mat.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Right col: Enrolled count */}
                    <div className="w-full sm:w-48 space-y-4">
                      <div className="bg-muted border rounded-lg p-4 text-center">
                        <Users className="h-8 w-8 mx-auto text-primary mb-2 opacity-80" />
                        <p className="text-2xl font-bold">{enrollmentsTotal.filter(e => e.classroomId === selectedClass.id).length}</p>
                        <p className="text-sm text-muted-foreground">Enrolled Students</p>
                      </div>
                      <div className="bg-muted border rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Class Code</p>
                        <p className="font-mono font-bold text-lg">{selectedClass.code}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Create Class Modal ── */}
        <Dialog open={createClassOpen} onOpenChange={setCreateClassOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create class</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClass(); }} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Class name (required)</Label>
                <Input value={newClassName} onChange={e => setNewClassName(e.target.value)} required autoFocus placeholder="e.g. Science 101" />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Input value={newClassSection} onChange={e => setNewClassSection(e.target.value)} placeholder="e.g. Morning Batch" />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={newClassSubject} onChange={e => setNewClassSubject(e.target.value)} placeholder="e.g. Physics" />
              </div>
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
              <div className="space-y-2">
                <Label>Class name (required)</Label>
                <Input value={editClassName} onChange={e => setEditClassName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Input value={editClassSection} onChange={e => setEditClassSection(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={editClassSubject} onChange={e => setEditClassSubject(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setEditClassOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!editClassName.trim()}>Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Main Activity Stream ── */}
        <div className="max-w-4xl mb-12 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Global Stream
          </h2>

          {/* Share with your class box */}
          {isAnnouncing ? (
            <Card className="shadow-none border border-slate-200">
              <CardContent className="p-4 space-y-4">
                <Input placeholder="Announcement Title (optional)" value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} className="bg-muted/30" />
                <Textarea placeholder="Announce something to your classes" value={announceContent} onChange={e => setAnnounceContent(e.target.value)} className="min-h-[100px] bg-muted/30" />
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
                  {getInitials(teacherName)}
                </div>
                <p className="text-sm text-muted-foreground">Announce something to your classes</p>
              </CardContent>
            </Card>
          )}

          {/* Unified Feed */}
          {(() => {
            const feedItems = [
              ...assignments.map(a => ({ type: 'assignment' as const, data: a as any, dateMs: a.created_at ? new Date(a.created_at).getTime() : 0 })),
              ...allAnnouncements.map(a => ({ type: 'announcement' as const, data: a as any, dateMs: new Date(a.created_at).getTime() }))
            ].sort((a, b) => b.dateMs - a.dateMs);

            if (feedItems.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed text-muted-foreground">
                  <Megaphone className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">The global stream is quiet.</p>
                </div>
              );
            }

            return feedItems.map((item, index) => {
              if (item.type === 'announcement') {
                const ann = item.data as Announcement;
                return (
                  <Card key={`ann-${ann.id || index}`} className="shadow-none border-slate-200 hover:shadow-sm transition-all">
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
                <Card key={`assg-${a.id}`} className="shadow-none border-slate-200 hover:shadow-sm transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
                  <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center h-12">
                      <div className="w-full">
                        <h4 className="text-sm sm:text-base font-semibold truncate hover:underline cursor-pointer" onClick={() => { setSelectedAssignment(a.id); setViewingEval(true); }}>
                          You posted a new assignment: {a.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.created_at ? format(new Date(a.created_at), "MMM d, yyyy") : "Posted"} 
                          {a.due_date ? ` · Due ${format(new Date(a.due_date), "MMM d, yyyy")}` : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>

        {/* ── Separator for Legacy UI ── */}
        <div className="border-t pb-6"></div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>General Assignments</h2>
              <p className="text-muted-foreground">Create and manage your assignments</p>
            </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Assignment</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Assignment title" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for students..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" />
                    Learning Outcomes
                  </Label>
                  {learningOutcomes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No LOs defined yet. Go to Outcomes to create some.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {learningOutcomes.map((lo: LearningOutcomeItem) => (
                        <button
                          key={lo.id}
                          type="button"
                          onClick={() => toggleLO(lo.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            selectedLOs.includes(lo.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/50"
                          }`}
                        >
                          {lo.code}
                          {lo.course_outcome_id && <span className="opacity-60">(CO)</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Assignment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No assignments yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(assignments ?? []).map((a: AssignmentItem) => {
              return (
                <Card
                  key={a.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedAssignment === a.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-lg">{a.title}</CardTitle>
                        <CardDescription>{a.description}</CardDescription>

                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(a.due_date), "MMM d, yyyy")}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this assignment?")) deleteMutation.mutate(a.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {selectedAssignment && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Submissions</h3>
            </div>
            {submissions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No submissions yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {submissions.map((s: SubmissionItem) => (
                  <Card key={s.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.student_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(s.submitted_at), "MMM d, yyyy h:mm a")}</p>
                      </div>
                      <p className="text-sm bg-muted p-3 rounded-md">{s.content}</p>
                      {s.image_path && (
                        <img
                          src={`${import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:8002"}/uploads/${s.image_path}`}
                          alt="Submission image"
                          className="rounded-md max-h-48 object-contain border"
                        />
                      )}
                      {s.extracted_text && (
                        <div className="rounded-md bg-accent/30 border border-accent p-3 text-sm space-y-1">
                          <p className="font-medium text-xs text-muted-foreground">OCR Extracted Text</p>
                          <p className="whitespace-pre-wrap text-foreground">{s.extracted_text}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Marks"
                          defaultValue={s.marks ?? ""}
                          className="w-24"
                          onBlur={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            gradeMutation.mutate({ id: s.id, marks: val, grade: s.grade || "", feedback: s.feedback || "" });
                          }}
                        />
                        <Input
                          placeholder="Grade (e.g. A+)"
                          defaultValue={s.grade || ""}
                          className="w-24"
                          onBlur={(e) => {
                            if (e.target.value !== (s.grade || "")) {
                              gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: e.target.value, feedback: s.feedback || "" });
                            }
                          }}
                        />
                        <Input
                          placeholder="Feedback"
                          defaultValue={s.feedback || ""}
                          className="flex-1"
                          onBlur={(e) => {
                            if (e.target.value !== (s.feedback || "")) {
                              gradeMutation.mutate({ id: s.id, marks: s.marks ?? null, grade: s.grade || "", feedback: e.target.value });
                            }
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ══════════════ SCOPED STYLES ══════════════ */}
      <style>{`
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

        .gc-card-banner {
          position: relative;
          height: 100px;
          padding: 16px;
          overflow: hidden;
        }
        .gc-card-banner-content { position: relative; z-index: 1; }
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
        .gc-card-section { font-size: 0.78rem; color: rgba(255,255,255,.85); margin: 0; }
        .gc-card-teacher { font-size: 0.82rem; color: rgba(255,255,255,.9); margin: 2px 0 0; font-weight: 600; text-transform: uppercase; }

        .gc-card-menu { position: absolute; top: 8px; right: 8px; z-index: 10; }
        .gc-more-btn {
          width: 36px; height: 36px; border-radius: 50%; border: none;
          background: rgba(255,255,255,.2); color: #fff;
          display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s;
        }
        .gc-more-btn:hover { background: rgba(255,255,255,.3); }

        .gc-teacher-avatar {
          position: absolute; bottom: -20px; left: 16px;
          width: 48px; height: 48px; border-radius: 50%;
          background: hsl(var(--card)); display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.9rem; color: hsl(var(--foreground));
          box-shadow: 0 2px 6px rgba(0,0,0,.15); border: 3px solid hsl(var(--card)); z-index: 2;
        }

        .gc-card-body { padding: 32px 16px 12px; background: hsl(var(--card)); }

        .gc-dropdown { background: hsl(var(--popover)); border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 4px; }
        .gc-dd-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.875rem; color: hsl(var(--foreground)); cursor: pointer; border-radius: 4px; }
        .gc-dd-item:hover { background: hsl(var(--muted)); }
      `}</style>
    </DashboardLayout>
  );
}
