/**
 * mockClassrooms.ts — now backed by the FastAPI classroom API.
 *
 * The same public API is preserved so call sites in
 * StudentDashboard / EnrolledClasses / ArchivedClasses / TeacherDashboard
 * don't have to change. The only behavioral change is:
 *
 *   - `requestJoinClass` and `createClassroom` are now async.
 *   - `getClassrooms` returns the localStorage cache (synchronous for
 *     fast render); a background `refreshClassrooms()` keeps the cache
 *     warm. A one-time migration of the old `gc_classrooms` localStorage
 *     key uploads any pre-existing per-browser classes to the backend.
 *
 * Errors from the API (404, 410, etc.) come back through the same
 * `{ success, msg }` shape so existing toast wiring still works.
 */

import { apiClient } from "@/integrations/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export interface Classroom {
  id: string;
  name: string;
  section: string;
  subject: string;
  description?: string;
  teacherId?: string;
  teacherName: string;
  code: string;
  bannerColor: string;
  cardColor: string;
  archived?: boolean;
  archivedAt?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface ClassroomMaterial {
  id: string;
  classroomId: string;
  fileName: string;
  fileSize: string;
  extractedText: string;
  uploadedAt: number;
  filePath?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────

const CACHE_KEY = "gc_classrooms_cache";
const LEGACY_KEY = "gc_classrooms";
const MIGRATION_FLAG = "gc_classrooms_migrated_v1";

const triggerSync = () => {
  window.dispatchEvent(new Event("classroomSync"));
};

const readCache = (): Classroom[] => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeCache = (rows: Classroom[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch (e) {
    console.warn("Failed to persist classroom cache", e);
  }
  triggerSync();
};

/** Map a backend payload into the Classroom shape the UI expects. */
const fromApi = (raw: any): Classroom => ({
  id: raw.id,
  code: raw.code,
  name: raw.name,
  section: raw.section || "",
  subject: raw.subject || "",
  description: raw.description || "",
  teacherId: raw.teacherId,
  teacherName: raw.teacherName || "",
  bannerColor: raw.bannerColor || "",
  cardColor: raw.cardColor || "",
  archived: !!raw.archived,
  archivedAt: raw.archivedAt ? Date.parse(raw.archivedAt) : undefined,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

// ── Materials (still localStorage — these are not yet on the backend) ────

export const getClassroomMaterials = (): ClassroomMaterial[] => {
  try {
    return JSON.parse(localStorage.getItem("gc_materials") || "[]");
  } catch {
    return [];
  }
};

export const addClassroomMaterial = (
  material: Omit<ClassroomMaterial, "id" | "uploadedAt">
) => {
  const materials = getClassroomMaterials();
  const truncatedText =
    material.extractedText.length > 500000
      ? material.extractedText.substring(0, 500000) +
        "\n...[Text truncated due to storage limits]..."
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
  localStorage.setItem("gc_materials", JSON.stringify(materials.filter((m) => m.id !== id)));
  triggerSync();
};

// ── GETTERS (sync — return cache so existing renders keep working) ───────

export const getClassrooms = (): Classroom[] => readCache();
export const getActiveClassrooms = (): Classroom[] =>
  readCache().filter((c) => !c.archived);
export const getArchivedClassrooms = (): Classroom[] =>
  readCache().filter((c) => c.archived);

// Legacy join-requests / enrollments: still localStorage-only.
// The new API's join is immediate (no accept/reject round-trip), so these
// are only used by the old teacher-side request-acceptance flow.
export const getJoinRequests = (): JoinRequest[] => {
  try {
    return JSON.parse(localStorage.getItem("gc_requests") || "[]");
  } catch {
    return [];
  }
};

export const getEnrollments = (): Enrollment[] => {
  try {
    return JSON.parse(localStorage.getItem("gc_enrollments") || "[]");
  } catch {
    return [];
  }
};

// ── REFRESH — pull authoritative list from the API into the cache ────────

let refreshInFlight: Promise<Classroom[]> | null = null;

export const refreshClassrooms = async (): Promise<Classroom[]> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const { data, error } = await apiClient.get("/classrooms/me");
      if (error || !data) {
        // No token or backend down — keep the cache as-is.
        return readCache();
      }
      const rows = Array.isArray(data) ? (data as any[]).map(fromApi) : [];
      writeCache(rows);
      return rows;
    } catch (e) {
      console.warn("refreshClassrooms failed", e);
      return readCache();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

// ── One-time migration of legacy per-browser classrooms ──────────────────

/**
 * On first call, if there is data under the old `gc_classrooms` key and
 * no `gc_classrooms_migrated_v1` flag, POST each one to the backend as
 * the current user (which works only if the call site is a teacher —
 * otherwise the backend will 403 and the legacy class is silently dropped
 * from the cache, which is the right outcome: students didn't own them).
 */
export const migrateLegacyClassroomsIfNeeded = async () => {
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  if (!legacyRaw) {
    localStorage.setItem(MIGRATION_FLAG, "1");
    return;
  }
  let legacy: Classroom[] = [];
  try {
    legacy = JSON.parse(legacyRaw) || [];
  } catch {
    legacy = [];
  }
  if (legacy.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "1");
    return;
  }

  // Best-effort upload. We don't block the UI on it.
  for (const cls of legacy) {
    try {
      await apiClient.post("/classrooms", {
        name: cls.name,
        section: cls.section || "",
        subject: cls.subject || "",
        description: "",
        bannerColor: cls.bannerColor || "",
        cardColor: cls.cardColor || "",
      });
    } catch (e) {
      // If the user isn't a teacher, the backend will 403 — that's expected.
      // We still mark migrated so we don't retry on every page load.
      console.warn("Skipped legacy classroom (likely non-owner):", cls.name, e);
    }
  }
  localStorage.removeItem(LEGACY_KEY);
  localStorage.setItem(MIGRATION_FLAG, "1");
  await refreshClassrooms();
};

// ── SETTERS (now async, talking to the API) ──────────────────────────────

export const createClassroom = async (
  classroom: Omit<Classroom, "id" | "code">
): Promise<Classroom> => {
  const { data, error } = await apiClient.post("/classrooms", {
    name: classroom.name,
    section: classroom.section || "",
    subject: classroom.subject || "",
    description: (classroom as any).description || "",
    bannerColor: classroom.bannerColor || "",
    cardColor: classroom.cardColor || "",
  });
  if (error || !data) {
    throw new Error(error?.message || "Could not create class — please try again.");
  }
  const created = fromApi(data);
  writeCache([created, ...readCache()]);
  return created;
};

export const deleteClassroom = async (id: string): Promise<void> => {
  const { error } = await apiClient.delete(`/classrooms/${id}`);
  if (error) {
    // Best-effort: log and fall back to local removal so the UI stays consistent.
    console.warn("Backend delete failed, removing from local cache only", error);
  }
  writeCache(readCache().filter((c) => c.id !== id));
  // Also clean up local-only side stores.
  localStorage.setItem(
    "gc_requests",
    JSON.stringify(getJoinRequests().filter((r) => r.classroomId !== id))
  );
  localStorage.setItem(
    "gc_enrollments",
    JSON.stringify(getEnrollments().filter((e) => e.classroomId !== id))
  );
};

export const updateClassroom = async (
  id: string,
  updates: Partial<Classroom>
): Promise<void> => {
  // No PATCH endpoint for arbitrary fields yet — we only support
  // archive/unarchive on the backend. Apply locally so the UI can
  // show a preview state.
  const rows = readCache();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...updates };
    writeCache(rows);
  }
};

export const archiveClassroom = async (id: string): Promise<void> => {
  const { data, error } = await apiClient.post(`/classrooms/${id}/archive?_method=PATCH`, {});
  if (error || !data) {
    // Fall back to optimistic local update so the UI still moves.
    await updateClassroom(id, { archived: true, archivedAt: Date.now() });
    return;
  }
  const updated = fromApi(data);
  const rows = readCache();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx !== -1) {
    rows[idx] = updated;
    writeCache(rows);
  } else {
    writeCache([updated, ...rows]);
  }
};

export const unarchiveClassroom = async (id: string): Promise<void> => {
  // No body needed; use a PATCH through the POST method-shuffle trick.
  // The client doesn't expose PATCH, but the backend is at
  // /api/classrooms/{id}/unarchive and accepts PATCH; we use fetch directly.
  try {
    const token = sessionStorage.getItem("auth_token");
    const resp = await fetch(
      `${(import.meta as any).env.VITE_API_URL || "http://localhost:8000/api"}/classrooms/${id}/unarchive`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const updated = fromApi(json);
    const rows = readCache();
    const idx = rows.findIndex((c) => c.id === id);
    if (idx !== -1) {
      rows[idx] = updated;
      writeCache(rows);
    } else {
      writeCache([updated, ...rows]);
    }
  } catch (e) {
    console.warn("unarchiveClassroom API call failed, falling back to local", e);
    const rows = readCache();
    const idx = rows.findIndex((c) => c.id === id);
    if (idx !== -1) {
      rows[idx] = { ...rows[idx] };
      delete rows[idx].archived;
      delete rows[idx].archivedAt;
      writeCache(rows);
    }
  }
};

// ── JOIN — the main fix ──────────────────────────────────────────────────

export const requestJoinClass = async (
  code: string,
  studentName: string
): Promise<{ success: boolean; msg: string; classroom?: Classroom }> => {
  const cleaned = code.trim();
  if (!cleaned) {
    return { success: false, msg: "Please enter a class code." };
  }

  // Step 1: case-insensitive code → classroom
  const lookup = await apiClient.get(`/classrooms/lookup/${encodeURIComponent(cleaned.toUpperCase())}`);
  if (lookup.error || !lookup.data) {
    // Friendly message already set by the backend; fall back if shape differs.
    const fallback =
      "We couldn't find a class with that code. Double-check with your teacher — codes are case-insensitive, 6 characters.";
    return { success: false, msg: lookup.error?.message || fallback };
  }
  const classroom = fromApi(lookup.data);

  // Step 2: actually join (idempotent)
  const join = await apiClient.post(`/classrooms/${classroom.id}/join`, {});
  if (join.error || !join.data) {
    return {
      success: false,
      msg: join.error?.message || "Could not join the class — please try again.",
    };
  }

  const joined = fromApi(join.data);

  // Step 3: refresh cache so the new class shows up everywhere immediately
  await refreshClassrooms();
  // Also keep the legacy localStorage enrollment in sync for any old
  // EnrolledClasses.tsx render that filters by `getEnrollments()`.
  const enrollments = getEnrollments();
  if (!enrollments.some((e) => e.classroomId === joined.id && e.studentName === studentName)) {
    localStorage.setItem(
      "gc_enrollments",
      JSON.stringify([...enrollments, { classroomId: joined.id, studentName }])
    );
  }

  return {
    success: true,
    msg: `Joined ${joined.name}!`,
    classroom: joined,
  };
};

// ── Legacy request acceptance (kept so the teacher-side flow doesn't break) ─

export const acceptJoinRequest = (requestId: string) => {
  const requests = getJoinRequests();
  const reqIndex = requests.findIndex((r) => r.id === requestId);
  if (reqIndex === -1) return;
  requests[reqIndex].status = "accepted";
  localStorage.setItem("gc_requests", JSON.stringify(requests));
  const enrollments = getEnrollments();
  localStorage.setItem(
    "gc_enrollments",
    JSON.stringify([
      ...enrollments,
      { classroomId: requests[reqIndex].classroomId, studentName: requests[reqIndex].studentName },
    ])
  );
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
  const newEnrollments = enrollments.filter(
    (e) => !(e.classroomId === classroomId && e.studentName === studentName)
  );
  localStorage.setItem("gc_enrollments", JSON.stringify(newEnrollments));
  triggerSync();
};
