export interface Classroom {
  id: string;
  name: string;
  section: string;
  subject: string;
  teacherName: string;
  code: string;
  bannerColor: string;
  cardColor: string;
}

export interface JoinRequest {
  id: string;
  classroomId: string;
  studentName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export interface Enrollment {
  classroomId: string;
  studentName: string;
}

// Helper to trigger custom events across tabs (and the same tab)
const triggerSync = () => {
  window.dispatchEvent(new Event("classroomSync"));
};

export interface ClassroomMaterial {
  id: string;
  classroomId: string;
  fileName: string;
  fileSize: string;
  extractedText: string;
  uploadedAt: number;
  filePath?: string;
}

export const getClassroomMaterials = (): ClassroomMaterial[] => {
  try {
    return JSON.parse(localStorage.getItem("gc_materials") || "[]");
  } catch {
    return [];
  }
};

export const addClassroomMaterial = (material: Omit<ClassroomMaterial, "id" | "uploadedAt">) => {
  const materials = getClassroomMaterials();
  // Truncate extremely large extracted text to prevent localStorage QuotaExceededError (limit: ~5MB)
  // 500,000 characters is roughly 500KB, giving plenty of context for the chatbot while saving quota
  const truncatedText = material.extractedText.length > 500000 
    ? material.extractedText.substring(0, 500000) + "\n...[Text truncated due to storage limits]..." 
    : material.extractedText;

  const newMaterial: ClassroomMaterial = {
    ...material,
    extractedText: truncatedText,
    id: Math.random().toString(36).substring(2, 9),
    uploadedAt: Date.now(),
  };

  try {
    localStorage.setItem("gc_materials", JSON.stringify([...materials, newMaterial]));
    triggerSync();
  } catch (error) {
    console.error("Failed to save material to localStorage, it may be too large:", error);
    throw new Error("Local storage quota exceeded. The PDF may be too large to save offline.");
  }
  
  return newMaterial;
};

export const deleteClassroomMaterial = (id: string) => {
  const materials = getClassroomMaterials();
  localStorage.setItem("gc_materials", JSON.stringify(materials.filter(m => m.id !== id)));
  triggerSync();
};

// ── GETTERS ──
export const getClassrooms = (): Classroom[] => {
  return JSON.parse(localStorage.getItem("gc_classrooms") || "[]");
};

export const getJoinRequests = (): JoinRequest[] => {
  return JSON.parse(localStorage.getItem("gc_requests") || "[]");
};

export const getEnrollments = (): Enrollment[] => {
  return JSON.parse(localStorage.getItem("gc_enrollments") || "[]");
};

// ── SETTERS ──
export const createClassroom = (classroom: Omit<Classroom, "id" | "code">) => {
  const classrooms = getClassrooms();
  const newClass: Classroom = {
    ...classroom,
    id: Math.random().toString(36).substring(2, 9),
    code: Math.random().toString(36).substring(2, 8).toLowerCase(),
  };
  localStorage.setItem("gc_classrooms", JSON.stringify([...classrooms, newClass]));
  triggerSync();
  return newClass;
};

export const deleteClassroom = (id: string) => {
  const classrooms = getClassrooms();
  localStorage.setItem("gc_classrooms", JSON.stringify(classrooms.filter(c => c.id !== id)));
  // Also clean up requests and enrollments
  localStorage.setItem("gc_requests", JSON.stringify(getJoinRequests().filter(r => r.classroomId !== id)));
  localStorage.setItem("gc_enrollments", JSON.stringify(getEnrollments().filter(e => e.classroomId !== id)));
  triggerSync();
}

export const updateClassroom = (id: string, updates: Partial<Classroom>) => {
  const classrooms = getClassrooms();
  const index = classrooms.findIndex((c) => c.id === id);
  if (index !== -1) {
    classrooms[index] = { ...classrooms[index], ...updates };
    localStorage.setItem("gc_classrooms", JSON.stringify(classrooms));
    triggerSync();
  }
};

export const requestJoinClass = (code: string, studentName: string): { success: boolean; msg: string } => {
  const classrooms = getClassrooms();
  const cls = classrooms.find((c) => c.code === code);
  if (!cls) return { success: false, msg: "Invalid class code." };

  const enrollments = getEnrollments();
  if (enrollments.some(e => e.classroomId === cls.id && e.studentName === studentName)) {
    return { success: false, msg: "You are already enrolled in this class." };
  }

  const requests = getJoinRequests();
  const existingReq = requests.find((r) => r.classroomId === cls.id && r.studentName === studentName);
  
  if (existingReq) {
    if (existingReq.status === "pending") return { success: false, msg: "Request is already pending." };
    if (existingReq.status === "rejected") return { success: false, msg: "Your previous request was rejected." };
  }

  const newReq: JoinRequest = {
    id: Math.random().toString(36).substring(2, 9),
    classroomId: cls.id,
    studentName,
    status: "pending",
    createdAt: Date.now(),
  };

  localStorage.setItem("gc_requests", JSON.stringify([...requests, newReq]));
  triggerSync();
  return { success: true, msg: `Join request sent to teacher for ${cls.name}.` };
};

export const acceptJoinRequest = (requestId: string) => {
  const requests = getJoinRequests();
  const reqIndex = requests.findIndex((r) => r.id === requestId);
  if (reqIndex === -1) return;

  const req = requests[reqIndex];
  requests[reqIndex].status = "accepted";
  localStorage.setItem("gc_requests", JSON.stringify(requests));

  const enrollments = getEnrollments();
  localStorage.setItem("gc_enrollments", JSON.stringify([...enrollments, {
    classroomId: req.classroomId,
    studentName: req.studentName
  }]));
  triggerSync();
};

export const rejectJoinRequest = (requestId: string) => {
  const requests = getJoinRequests();
  const reqIndex = requests.findIndex((r) => r.id === requestId);
  if (reqIndex === -1) return;

  requests[reqIndex].status = "rejected";
  localStorage.setItem("gc_requests", JSON.stringify(requests));
  triggerSync();
};

export const leaveClassroom = (classroomId: string, studentName: string) => {
  const enrollments = getEnrollments();
  const newEnrollments = enrollments.filter(e => !(e.classroomId === classroomId && e.studentName === studentName));
  localStorage.setItem("gc_enrollments", JSON.stringify(newEnrollments));
  triggerSync();
};
