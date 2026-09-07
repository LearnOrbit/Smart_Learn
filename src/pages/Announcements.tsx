import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { apiClient } from "@/integrations/api/client"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import { loadPageNamespace } from "@/i18n"

// ── Types ─────────────────────────────────────────────────────

interface Announcement {
  id: string
  teacher_name: string
  subject_name?: string | null
  title: string
  message: string
  pinned: boolean
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string, t: (k: string, o?: object) => string, locale: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return t("announcements:card.timeAgo.today")
  if (diff === 1) return t("announcements:card.timeAgo.yesterday")
  if (diff < 7)  return t("announcements:card.timeAgo.daysAgo", { count: diff })
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
}

function Avatar({ name, size = 40 }: { name?: string; size?: number }) {
  const colors = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c3aed"]
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Single Announcement Card ──────────────────────────────────
function AnnouncementCard({
  ann,
  isTeacher,
  onDelete,
  onPin,
}: {
  ann: Announcement
  isTeacher: boolean
  onDelete: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
}) {
  const { t, i18n } = useTranslation("pages")
  const locale = i18n.language === "hi" ? "hi-IN" : i18n.language === "mr" ? "mr-IN" : "en-IN"
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(ann.pinned)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuOpen])

  return (
    <div style={{
      ...s.card,
      borderLeft: ann.pinned ? "3px solid #4f46e5" : "1px solid #e5e7eb",
    }}>
      {/* Header */}
      <div style={s.cardHead}>
        <Avatar name={ann.teacher_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={s.teacherName}>{ann.teacher_name}</span>
            {ann.subject_name && (
              <span style={s.subjectPill}>{ann.subject_name}</span>
            )}
            {ann.pinned && (
              <span style={s.pinnedPill}>{t("announcements:card.pinned")}</span>
            )}
          </div>
          <div style={s.dateLine}>{timeAgo(ann.created_at, t, locale)}</div>
        </div>

        {/* Three-dot menu (teacher only) */}
        {isTeacher && (
          <div style={{ position: "relative", flexShrink: 0 }} ref={menuRef}>
            <button
              style={s.iconBtn}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ⋮
            </button>
            {menuOpen && (
              <div style={s.menu}>
                <button style={s.menuItem} onClick={() => { onPin(ann.id, !ann.pinned); setMenuOpen(false) }}>
                  {ann.pinned ? t("announcements:card.unpin") : t("announcements:card.pinToTop")}
                </button>
                <button style={{ ...s.menuItem, color: "#dc2626" }} onClick={() => { onDelete(ann.id); setMenuOpen(false) }}>
                  {t("announcements:card.delete")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title if present */}
      {ann.title && <p style={s.annTitle}>{ann.title}</p>}

      {/* Message */}
      <p style={{
        ...s.annMessage,
        WebkitLineClamp: expanded ? "unset" : 2,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        overflow: expanded ? "visible" : "hidden",
      }}>
        {ann.message}
      </p>

      {/* Expand / collapse if long */}
      {ann.message.length > 120 && (
        <button style={s.readMore} onClick={() => setExpanded(!expanded)}>
          {expanded ? t("announcements:card.showLess") : t("announcements:card.readMore")}
        </button>
      )}

      <div style={s.divider} />
      <button style={s.addCommentBtn}>{t("announcements:card.addComment")}</button>
    </div>
  )
}

// ── Post Announcement Form ────────────────────────────────────
function PostForm({ onPost }: { onPost: (data: { message: string; title: string }) => Promise<void> }) {
  const { t } = useTranslation("pages")
  const [message, setMessage] = useState("")
  const [title,   setTitle]   = useState("")
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setLoading(true)
    try {
      await onPost({ message: message.trim(), title: title.trim() })
      setMessage("")
      setTitle("")
      setFocused(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.postForm}>
      <Avatar name="You" size={36} />
      <div style={{ flex: 1 }}>
        {focused && (
          <input
            placeholder={t("announcements:form.titlePlaceholder")}
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={s.titleInput}
          />
        )}
        <textarea
          placeholder={t("announcements:form.messagePlaceholder")}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onFocus={() => setFocused(true)}
          rows={focused ? 3 : 1}
          style={{ ...s.textarea, height: focused ? 80 : 40 }}
        />
        {focused && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button style={s.cancelBtn} onClick={() => { setFocused(false); setMessage(""); setTitle("") }}>
              {t("announcements:form.cancel")}
            </button>
            <button
              style={{ ...s.postBtn, opacity: message.trim() ? 1 : 0.5 }}
              onClick={handleSubmit}
              disabled={!message.trim() || loading}
            >
              {loading ? t("announcements:form.posting") : t("announcements:form.post")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { t } = useTranslation("pages")
  const queryClient = useQueryClient()

  useEffect(() => { void loadPageNamespace("announcements"); }, [])

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiClient.get("/announcements/"),
  })
  const announcements: Announcement[] = data?.data?.announcements ?? []

  const postMutation = useMutation({
    mutationFn: (payload: { message: string; title: string }) =>
      apiClient.post("/announcements/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] })
      toast({ title: t("announcements:toasts.posted") })
    },
    onError: (err: Error) => {
      toast({ title: t("announcements:toasts.postFailed"), description: err.message || t("announcements:toasts.unknownError"), variant: "destructive" })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/announcements/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (err: Error) => {
      toast({ title: t("announcements:toasts.deleteFailed"), description: err.message || t("announcements:toasts.unknownError"), variant: "destructive" })
    }
  })

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      apiClient.put(`/announcements/${id}`, { pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (err: Error) => {
      toast({ title: t("announcements:toasts.updateFailed"), description: err.message || t("announcements:toasts.unknownError"), variant: "destructive" })
    }
  })

  const isTeacher = user?.role === "teacher"

  const pinned   = announcements.filter(a => a.pinned)
  const rest     = announcements.filter(a => !a.pinned)

  if (isLoading) {
    return (
      <div style={{ background: "#f8f9fa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9ca3af" }}>{t("announcements:loading")}</p>
      </div>
    )
  }

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={s.page}>

        {/* Page header */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>{t("announcements:header.title")}</h1>
            <p style={s.pageSub}>
              {isTeacher ? t("announcements:header.teacherSub") : t("announcements:header.studentSub")}
            </p>
          </div>
          <span style={s.countBadge}>{announcements.length}</span>
        </div>

        {/* Post form — teacher only */}
        {isTeacher && (
          <PostForm onPost={async (data) => { await postMutation.mutateAsync(data) }} />
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <div>
            <p style={s.sectionLabel}>{t("announcements:sections.pinned")}</p>
            {pinned.map(a => (
              <AnnouncementCard
                key={a.id} ann={a}
                isTeacher={isTeacher}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPin={(id, pinned) => pinMutation.mutate({ id, pinned })}
              />
            ))}
          </div>
        )}

        {/* All announcements */}
        {rest.length > 0 && (
          <div>
            {pinned.length > 0 && <p style={s.sectionLabel}>{t("announcements:sections.recent")}</p>}
            {rest.map(a => (
              <AnnouncementCard
                key={a.id} ann={a}
                isTeacher={isTeacher}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPin={(id, pinned) => pinMutation.mutate({ id, pinned })}
              />
            ))}
          </div>
        )}

        {announcements.length === 0 && (
          <div style={s.empty}>
            <span style={{ fontSize: 40 }}>📢</span>
            <p style={{ color: "#9ca3af", marginTop: 12, fontSize: 14 }}>{t("announcements:empty.noAnnouncements")}</p>
            {isTeacher && <p style={{ color: "#d1d5db", fontSize: 13 }}>{t("announcements:empty.teacherHint")}</p>}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  page:         { maxWidth: 680, margin: "0 auto", padding: "24px 16px 48px", display: "flex", flexDirection: "column", gap: 12 },
  pageHeader:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  pageTitle:    { fontSize: 22, fontWeight: 600, color: "#111827", margin: 0 },
  pageSub:      { fontSize: 13, color: "#9ca3af", marginTop: 3 },
  countBadge:   { fontSize: 12, fontWeight: 600, background: "#e0e7ff", color: "#4f46e5", borderRadius: 99, padding: "3px 10px", marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 8px" },

  // Post form
  postForm:     { display: "flex", gap: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", alignItems: "flex-start" },
  titleInput:   { width: "100%", border: "none", borderBottom: "1px solid #e5e7eb", outline: "none", fontSize: 14, fontWeight: 500, color: "#111827", padding: "4px 0 8px", marginBottom: 6, background: "transparent" },
  textarea:     { width: "100%", border: "none", outline: "none", resize: "none", fontSize: 14, color: "#374151", background: "transparent", transition: "height 0.2s", fontFamily: "inherit", lineHeight: 1.5 },
  cancelBtn:    { background: "none", border: "none", fontSize: 13, color: "#6b7280", cursor: "pointer", padding: "6px 12px", borderRadius: 6 },
  postBtn:      { background: "#4f46e5", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "6px 18px", borderRadius: 6 },

  // Card
  card:         { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px", overflow: "hidden" },
  cardHead:     { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  teacherName:  { fontSize: 14, fontWeight: 600, color: "#111827" },
  subjectPill:  { fontSize: 11, background: "#f3f4f6", color: "#4b5563", borderRadius: 4, padding: "1px 7px", fontWeight: 500 },
  pinnedPill:   { fontSize: 11, background: "#e0e7ff", color: "#4f46e5", borderRadius: 4, padding: "1px 7px", fontWeight: 500 },
  dateLine:     { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  iconBtn:      { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af", padding: "0 4px", lineHeight: 1 },
  menu:         { position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.1)", zIndex: 50, minWidth: 150, overflow: "hidden" },
  menuItem:     { display: "block", width: "100%", padding: "9px 16px", fontSize: 13, color: "#374151", background: "none", border: "none", textAlign: "left", cursor: "pointer" },
  annTitle:     { fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 },
  annMessage:   { fontSize: 14, color: "#1f2937", lineHeight: 1.65, marginBottom: 10, fontWeight: 400 },
  readMore:     { background: "none", border: "none", color: "#4f46e5", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 10 },
  divider:      { height: 1, background: "#f3f4f6", margin: "8px 0 10px" },
  addCommentBtn:{ background: "none", border: "none", color: "#4f46e5", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 },
  empty:        { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 4 },
} as const
