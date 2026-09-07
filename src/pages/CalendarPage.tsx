import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatCardGrid } from "@/components/ui/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/ui/AnimatedPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  FileText,
  ChevronRight,
  Sparkles,
  Bell,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getEnrollments, getClassrooms, Classroom } from "@/utils/mockClassrooms";

/* ── Event types ── */
interface CalendarEvent {
  id: string;
  title: string;
  type: "assignment" | "announcement" | "class" | "exam";
  date: string; // YYYY-MM-DD
  time?: string;
  description?: string;
  subject?: string;
}

const STORAGE_KEY = "gc_calendar_events";

const loadEvents = (): CalendarEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveEvents = (events: CalendarEvent[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

/* ── Helpers ── */
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/* ── Quick add modal ── */
function QuickAddEvent({
  open,
  onClose,
  selectedDate,
  onAdd,
  t,
  locale,
  formatPretty,
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  onAdd: (e: Omit<CalendarEvent, "id">) => void;
  t: (k: string, o?: object) => string;
  locale: string;
  formatPretty: (d: Date) => string;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEvent["type"]>("assignment");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setType("assignment");
      setTime("");
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), type, date: formatDateKey(selectedDate), time: time || undefined });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        >
          <div>
            <h3 className="text-lg font-semibold">{t("calendar:modal.title")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatPretty(selectedDate)}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("calendar:modal.titleField")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("calendar:modal.titlePlaceholder")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("calendar:modal.typeField")}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CalendarEvent["type"])}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="assignment">{t("calendar:eventTypes.assignment")}</option>
                  <option value="announcement">{t("calendar:eventTypes.announcement")}</option>
                  <option value="class">{t("calendar:eventTypes.class")}</option>
                  <option value="exam">{t("calendar:eventTypes.exam")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("calendar:modal.timeField")}</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t("calendar:modal.cancel")}</Button>
            <Button onClick={submit} disabled={!title.trim()}>{t("calendar:modal.addEvent")}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main page ── */
export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("pages");
  const locale = i18n.language === "hi" ? "hi-IN" : i18n.language === "mr" ? "mr-IN" : "en-IN";
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { void loadPageNamespace("calendar"); }, []);

  const eventTypeMeta = useMemo(
    () => ({
      assignment: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: FileText },
      announcement: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Bell },
      class: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: BookOpen },
      exam: { color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", icon: Sparkles },
    }),
    []
  );

  const formatPretty = (d: Date) =>
    d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  /* Seed a few sample events on first load (per-user) */
  useEffect(() => {
    const userKey = `gc_calendar_seeded_${user?.id || "anon"}`;
    if (localStorage.getItem(userKey)) return;

    const today = new Date();
    const inDays = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return formatDateKey(d);
    };

    const seed: CalendarEvent[] = [
      { id: "seed-1", title: "Math homework due", type: "assignment", date: inDays(1), time: "23:59", subject: "Mathematics" },
      { id: "seed-2", title: "Physics lab report", type: "assignment", date: inDays(3), subject: "Physics" },
      { id: "seed-3", title: "Mid-semester exam", type: "exam", date: inDays(7), time: "10:00", subject: "Chemistry" },
      { id: "seed-4", title: "Class project kickoff", type: "class", date: formatDateKey(today) },
      { id: "seed-5", title: "Holiday notice", type: "announcement", date: inDays(5) },
    ];

    setEvents((prev) => [...prev, ...seed]);
    saveEvents([...events, ...seed]);
    localStorage.setItem(userKey, "1");
  }, [user?.id]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter((e) => new Date(e.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [events]);

  const eventsOnSelected = useMemo(
    () =>
      events
        .filter((e) => isSameDay(new Date(e.date), selectedDate))
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [events, selectedDate]
  );

  const eventDates = useMemo(() => events.map((e) => new Date(e.date)), [events]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const thisWeek = events.filter((e) => {
      const d = new Date(e.date);
      return d >= today && d <= weekFromNow;
    }).length;
    return {
      total: events.length,
      thisWeek,
      assignments: events.filter((e) => e.type === "assignment").length,
      exams: events.filter((e) => e.type === "exam").length,
    };
  }, [events]);

  const handleAddEvent = (newEvent: Omit<CalendarEvent, "id">) => {
    const ev: CalendarEvent = { ...newEvent, id: Math.random().toString(36).slice(2, 9) };
    const next = [...events, ev];
    setEvents(next);
    saveEvents(next);
    toast({ title: t("calendar:toasts.eventAdded"), description: t("calendar:toasts.eventAddedDesc", { title: ev.title, date: formatPretty(new Date(ev.date)) }) });
  };

  const toggleEventDone = (id: string) => {
    const next = events.map((e) =>
      e.id === id ? { ...e, done: !e.done } as any : e
    );
    setEvents(next);
    saveEvents(next);
  };

  const deleteEvent = (id: string) => {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    saveEvents(next);
    toast({ title: t("calendar:toasts.eventRemoved") });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("calendar:header.title")}
          description={t("calendar:header.description")}
          action={
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4" /> {t("calendar:header.addEvent")}
            </Button>
          }
        />

        <StatCardGrid columns={4}>
          <StatCard
            title={t("calendar:stats.totalTitle")}
            value={stats.total}
            description={t("calendar:stats.totalDesc")}
            icon={<CalendarIcon className="h-5 w-5" />}
            iconBg="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          />
          <StatCard
            title={t("calendar:stats.weekTitle")}
            value={stats.thisWeek}
            description={t("calendar:stats.weekDesc")}
            icon={<Clock className="h-5 w-5" />}
            iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
          />
          <StatCard
            title={t("calendar:stats.assignmentsTitle")}
            value={stats.assignments}
            description={t("calendar:stats.assignmentsDesc")}
            icon={<FileText className="h-5 w-5" />}
            iconBg="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
          />
          <StatCard
            title={t("calendar:stats.examsTitle")}
            value={stats.exams}
            description={t("calendar:stats.examsDesc")}
            icon={<Sparkles className="h-5 w-5" />}
            iconBg="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
          />
        </StatCardGrid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar widget */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> {t("calendar:schedule.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <div className="rounded-xl border border-border/50 bg-background p-2">
                <CalendarWidget
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersClassNames={{
                    hasEvent: "relative font-bold text-primary",
                  }}
                  className="rounded-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Selected day panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {formatPretty(selectedDate)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsOnSelected.length === 0 ? (
                <EmptyState
                  title={t("calendar:selectedDay.nothingScheduled")}
                  description={t("calendar:selectedDay.nothingScheduledDesc")}
                  variant="minimal"
                  icon={<CalendarIcon className="h-6 w-6" />}
                />
              ) : (
                <StaggerContainer className="space-y-2">
                  {eventsOnSelected.map((ev) => {
                    const meta = eventTypeMeta[ev.type];
                    const Icon = meta.icon;
                    return (
                      <StaggerItem key={ev.id}>
                        <motion.div
                          whileHover={{ x: 2 }}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <button
                            onClick={() => toggleEventDone(ev.id)}
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                            aria-label="Toggle done"
                          >
                            {ev.done ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                ev.done ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {ev.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge variant="secondary" className={`${meta.color} text-[10px] gap-1`}>
                                <Icon className="h-3 w-3" />
                                {t(`calendar:eventTypes.${ev.type}`)}
                              </Badge>
                              {ev.time && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {ev.time}
                                </span>
                              )}
                              {ev.subject && (
                                <span className="text-[11px] text-muted-foreground">
                                  · {ev.subject}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteEvent(ev.id)}
                            className="text-xs text-muted-foreground hover:text-rose-500 transition-colors"
                            aria-label="Delete event"
                          >
                            ✕
                          </button>
                        </motion.div>
                      </StaggerItem>
                    );
                  })}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {t("calendar:upcoming.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <EmptyState
                title={t("calendar:upcoming.noEvents")}
                description={t("calendar:upcoming.noEventsDesc")}
                variant="minimal"
                icon={<CalendarIcon className="h-6 w-6" />}
              />
            ) : (
              <StaggerContainer className="space-y-2">
                {upcomingEvents.map((ev) => {
                  const meta = eventTypeMeta[ev.type];
                  const Icon = meta.icon;
                  const daysUntil = Math.ceil(
                    (new Date(ev.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                      86400000
                  );
                  return (
                    <StaggerItem key={ev.id}>
                      <motion.div
                        whileHover={{ x: 2 }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedDate(new Date(ev.date))}
                      >
                        <div className="flex flex-col items-center justify-center w-14 shrink-0">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                            {new Date(ev.date).toLocaleDateString(locale, { month: "short" })}
                          </span>
                          <span className="text-xl font-bold leading-none">
                            {new Date(ev.date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className={`${meta.color} text-[10px] gap-1`}>
                              <Icon className="h-3 w-3" />
                              {t(`calendar:eventTypes.${ev.type}`)}
                            </Badge>
                            {daysUntil === 0 && (
                              <span className="text-[11px] font-semibold text-rose-500">{t("calendar:upcoming.today")}</span>
                            )}
                            {daysUntil === 1 && (
                              <span className="text-[11px] font-semibold text-amber-500">{t("calendar:upcoming.tomorrow")}</span>
                            )}
                            {daysUntil > 1 && (
                              <span className="text-[11px] text-muted-foreground">{t("calendar:upcoming.inDays", { count: daysUntil })}</span>
                            )}
                            {ev.time && (
                              <span className="text-[11px] text-muted-foreground">· {ev.time}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>

        <QuickAddEvent
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedDate={selectedDate}
          onAdd={handleAddEvent}
          t={t}
          locale={locale}
          formatPretty={formatPretty}
        />
      </div>
    </DashboardLayout>
  );
}
