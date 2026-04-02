"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  List,
  Filter,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Trash2,
  Pencil,
} from "lucide-react";
import { UnifiedActivityModal } from "../components/unified-activity-modal";
import {
  getActivitiesAgendaAction,
  getAgendaFiltersMetaAction,
} from "../actions/get-activities-agenda";
import {
  deleteUnifiedActivityAction,
  updateUnifiedActivityAction,
} from "../actions/unified-activity-actions";
import { getGCalStatus } from "../actions/gcal-status";

// ─────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────
interface Activity {
  id: string;
  title: string;
  summary?: string;
  activity_type: string;
  activity_date?: string;
  due_date?: string;
  due_time?: string;
  location?: string;
  is_all_day?: boolean;
  task_status: "open" | "done" | "cancelled";
  deal_id?: string;
  contact_id?: string;
  organization_id?: string;
  created_at: string;
  deals?: { id: string; name: string; deal_type: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  organisations?: { id: string; name: string } | null;
  participants?: Array<{ id: string; first_name: string; last_name: string }>;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
}

interface Deal {
  id: string;
  name: string;
  deal_type: string;
}

interface ActivityType {
  id: string;
  label: string;
  category: string;
}

interface Organisation {
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function fmt(d?: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(d));
}

function fmtTime(t?: string) {
  if (!t) return "—";
  return t.substring(0, 5);
}

function toYYYYMMDD(d: Date) {
  return d.toISOString().split("T")[0];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const ACTIVITY_TYPE_COLORS: Record<string, { bg: string; tx: string }> = {
  todo: { bg: "#EEF2FF", tx: "#3B82F6" },
  follow_up: { bg: "#FEF3C7", tx: "#D97706" },
  call: { bg: "#DBEAFE", tx: "#0284C7" },
  meeting: { bg: "#F0FDFA", tx: "#0D9488" },
  email_sent: { bg: "#E0E7FF", tx: "#4F46E5" },
  email_received: { bg: "#E0E7FF", tx: "#6366F1" },
  intro: { bg: "#F5E6E8", tx: "#DC2626" },
  deck_sent: { bg: "#FCE7F3", tx: "#BE185D" },
  nda: { bg: "#FECACA", tx: "#991B1B" },
  document_sent: { bg: "#FED7AA", tx: "#92400E" },
  deadline: { bg: "#FECDD3", tx: "#BE185D" },
  delivery: { bg: "#F1E2FF", tx: "#7C3AED" },
  closing: { bg: "#D1FAE5", tx: "#065F46" },
  recruitment_interview: { bg: "#CCE5FF", tx: "#1E40AF" },
  recruitment_feedback: { bg: "#DBEAFE", tx: "#0284C7" },
  recruitment_task: { bg: "#E0E7FF", tx: "#4F46E5" },
  cfo_advisory: { bg: "#F5D0A9", tx: "#92400E" },
  investor_meeting: { bg: "#F0FDFA", tx: "#0D9488" },
  due_diligence: { bg: "#E0E7FF", tx: "#3B82F6" },
  note: { bg: "#F3F4F6", tx: "#6B7280" },
  other: { bg: "#F3F4F6", tx: "#9CA3AF" },
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [view, setView] = useState<"calendar" | "list">("list");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    activityType: "",
    contactId: "",
    dealId: "",
    status: "",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | undefined>();
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

  // Charger les données au montage
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [filterMeta, allActivities, gcalStatus] = await Promise.all([
        getAgendaFiltersMetaAction(),
        getActivitiesAgendaAction(),
        getGCalStatus(),
      ]);
      setGcalConnected(gcalStatus.connected);
      setGcalEmail(gcalStatus.email);

      if (filterMeta.success) {
        setContacts(filterMeta.contacts);
        setDeals(filterMeta.deals);
        setOrganisations(filterMeta.organisations);
        setActivityTypes(filterMeta.activityTypes);
      }

      if (allActivities.success) {
        setActivities(allActivities.activities);
      }
    } finally {
      setLoading(false);
    }
  }

  // Appliquer les filtres
  const filteredActivities = activities.filter((a) => {
    if (filters.activityType && a.activity_type !== filters.activityType)
      return false;
    if (filters.contactId && a.contact_id !== filters.contactId) return false;
    if (filters.dealId && a.deal_id !== filters.dealId) return false;
    if (filters.status && a.task_status !== filters.status) return false;
    return true;
  });

  async function handleDeleteActivity(id: string) {
    if (!confirm("Supprimer cette activité ?")) return;
    await deleteUnifiedActivityAction(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSaveActivity(formData: any) {
    try {
      if (selectedActivity) {
        const result = await updateUnifiedActivityAction(selectedActivity.id, {
          title: formData.title,
          summary: formData.summary,
          activityType: formData.activityType,
          status: formData.status,
          dueDate: formData.dueDate,
          dueTime: formData.dueTime,
          location: formData.location,
          isAllDay: formData.isAllDay,
        });

        if (result.success) {
          setActivities((prev) =>
            prev.map((a) => (a.id === selectedActivity.id ? result.activity : a))
          );
          return true;
        }
      } else {
        // Create new activity - use createUnifiedActivityAction if available
        // For now, we'll just return false since the modal should handle new creations
        return false;
      }
      return false;
    } catch (err) {
      console.error("Error saving activity:", err);
      return false;
    }
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthName = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);

  // ═════════════════════════════════════════════════════════════
  // RENDER CALENDAR VIEW
  // ═════════════════════════════════════════════════════════════
  function renderCalendarView() {
    const days = [];
    const weekDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    // Header semaine
    days.push(
      <div
        key="weekheader"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {weekDays.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-4)",
              padding: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>
    );

    // Empty cells before month starts
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(
        <div
          key={`empty-${i}`}
          style={{
            background: "var(--surface-2)",
            borderRadius: 8,
            height: 100,
            border: "1px solid var(--border)",
          }}
        />
      );
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toYYYYMMDD(new Date(year, month, day));
      const dayActivities = filteredActivities.filter((a) => {
        const aDate = a.due_date || a.activity_date;
        return aDate && aDate.startsWith(dateStr);
      });

      cells.push(
        <div
          key={day}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            minHeight: 100,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Date header */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-2)",
              marginBottom: 6,
              paddingBottom: 6,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {day}
          </div>

          {/* Activities in this day */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
            {dayActivities.slice(0, 3).map((a) => {
              const colors =
                ACTIVITY_TYPE_COLORS[a.activity_type] ||
                ACTIVITY_TYPE_COLORS.other;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedActivity(a);
                    setModalOpen(true);
                  }}
                  style={{
                    background: colors.bg,
                    border: "none",
                    borderRadius: 5,
                    padding: "4px 6px",
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.tx,
                    textAlign: "left",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={a.title}
                >
                  {a.title}
                </button>
              );
            })}
            {dayActivities.length > 3 && (
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-4)",
                  fontWeight: 600,
                  padding: "2px 4px",
                }}
              >
                +{dayActivities.length - 3} plus
              </div>
            )}
          </div>
        </div>
      );
    }

    days.push(
      <div
        key="calendar-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
        }}
      >
        {cells}
      </div>
    );

    return days;
  }

  // ═════════════════════════════════════════════════════════════
  // RENDER LIST VIEW
  // ═════════════════════════════════════════════════════════════
  function renderListView() {
    const grouped = new Map<string, Activity[]>();

    // Grouper par date
    filteredActivities.forEach((a) => {
      const date = a.due_date || a.activity_date || "";
      const key = date || "no-date";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    });

    const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sortedDates.map((dateStr) => {
          const items = grouped.get(dateStr)!;
          const isNoDate = dateStr === "no-date";

          return (
            <div key={dateStr}>
              {/* Date header */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  padding: "8px 0",
                  marginBottom: 8,
                  borderBottom: "2px solid var(--border)",
                }}
              >
                {isNoDate ? "Sans date" : fmt(dateStr)}
              </div>

              {/* Activities for this date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((a) => {
                  const colors =
                    ACTIVITY_TYPE_COLORS[a.activity_type] ||
                    ACTIVITY_TYPE_COLORS.other;

                  return (
                    <div
                      key={a.id}
                      style={{
                        background: "var(--surface)",
                        border: `1px solid ${colors.tx}33`,
                        borderRadius: 9,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {/* Status indicator */}
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: colors.tx,
                          flexShrink: 0,
                          opacity: a.task_status === "done" ? 0.4 : 1,
                        }}
                      />

                      {/* Main content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Type badge */}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: colors.bg,
                              color: colors.tx,
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                            }}
                          >
                            {activityTypes.find((at) => at.id === a.activity_type)
                              ?.label || a.activity_type}
                          </span>

                          {/* Status badge */}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background:
                                a.task_status === "done"
                                  ? "var(--fund-bg)"
                                  : "var(--surface-2)",
                              color:
                                a.task_status === "done"
                                  ? "var(--fund-tx)"
                                  : "var(--text-4)",
                            }}
                          >
                            {a.task_status === "done" ? "✓ Done" : "Ouvert"}
                          </span>
                        </div>

                        {/* Title */}
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--text-1)",
                            marginTop: 6,
                            marginBottom: 4,
                          }}
                        >
                          {a.title}
                        </div>

                        {/* Details line */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            fontSize: 12,
                            color: "var(--text-4)",
                          }}
                        >
                          {a.location && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={12} />
                              {a.location}
                            </div>
                          )}

                          {a.due_time && !a.is_all_day && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={12} />
                              {fmtTime(a.due_time)}
                            </div>
                          )}

                          {a.participants && a.participants.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Users size={12} />
                              {a.participants.length} participant
                              {a.participants.length > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>

                        {/* Summary if exists */}
                        {a.summary && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-4)",
                              marginTop: 6,
                              fontStyle: "italic",
                            }}
                          >
                            {a.summary}
                          </div>
                        )}

                        {/* Context links */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {a.deals && (
                            <Link
                              href={`/protected/dossiers/${a.deal_id}`}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "var(--fund-bg)",
                                color: "var(--fund-tx)",
                                textDecoration: "none",
                                fontWeight: 600,
                              }}
                            >
                              📋 {a.deals.name}
                            </Link>
                          )}

                          {a.contacts && (
                            <Link
                              href={`/protected/contacts/${a.contact_id}`}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "var(--sell-bg)",
                                color: "var(--sell-tx)",
                                textDecoration: "none",
                                fontWeight: 600,
                              }}
                            >
                              👤 {a.contacts.first_name} {a.contacts.last_name}
                            </Link>
                          )}

                          {a.organisations && (
                            <Link
                              href={`/protected/organisations/${a.organization_id}`}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "var(--cfo-bg)",
                                color: "var(--cfo-tx)",
                                textDecoration: "none",
                                fontWeight: 600,
                              }}
                            >
                              🏢 {a.organisations.name}
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedActivity(a);
                            setModalOpen(true);
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "var(--surface-2)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-4)",
                          }}
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(a.id)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "var(--surface-2)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--rec-tx)",
                          }}
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredActivities.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              fontSize: 14,
              color: "var(--text-5)",
            }}
          >
            Aucune activité trouvée
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: "24px 20px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/protected"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              color: "var(--text-4)",
              textDecoration: "none",
              marginBottom: 12,
            }}
          >
            <ArrowLeft size={13} /> Dashboard
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 800,
                  color: "var(--text-1)",
                }}
              >
                Agenda
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "var(--text-5)",
                }}
              >
                Gérez toutes vos activités, tâches et événements en un seul endroit
              </p>
              {/* Badge GCal */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                {gcalConnected ? (
                  <>
                    <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: "#D1FAE5", color: "#065F46", fontWeight: 600 }}>
                      Google Agenda connecté
                    </span>
                    {gcalEmail && <span style={{ fontSize: 11, color: "var(--text-5)" }}>{gcalEmail}</span>}
                    <button
                      disabled={gcalDisconnecting}
                      onClick={async () => {
                        setGcalDisconnecting(true);
                        await fetch("/api/gcal/disconnect", { method: "DELETE" });
                        setGcalConnected(false);
                        setGcalEmail(undefined);
                        setGcalDisconnecting(false);
                      }}
                      style={{ fontSize: 11, color: "var(--text-5)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                    >
                      {gcalDisconnecting ? "…" : "Déconnecter"}
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-5)", fontWeight: 600 }}>
                      Google Agenda non connecté
                    </span>
                    <a
                      href="/api/gcal"
                      style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: "#1a56db", color: "#fff", fontWeight: 600, textDecoration: "none" }}
                    >
                      Connecter
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Top right buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* View toggle */}
              <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 7 }}>
                <button
                  onClick={() => setView("list")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 5,
                    border: view === "list" ? "1px solid var(--text-4)" : "1px solid transparent",
                    background: view === "list" ? "var(--surface)" : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <List size={13} /> Liste
                </button>
                <button
                  onClick={() => setView("calendar")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 5,
                    border: view === "calendar" ? "1px solid var(--text-4)" : "1px solid transparent",
                    background: view === "calendar" ? "var(--surface)" : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Calendar size={13} /> Calendrier
                </button>
              </div>

              {/* New activity */}
              <button
                onClick={() => {
                  setSelectedActivity(null);
                  setModalOpen(true);
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "var(--accent, #1a56db)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Plus size={14} /> Nouvelle activité
              </button>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: showFilters ? "var(--surface-2)" : "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-3)",
            }}
          >
            <Filter size={13} /> Filtres
          </button>

          {/* Active filters display */}
          {(filters.activityType ||
            filters.contactId ||
            filters.dealId ||
            filters.status) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {filters.activityType && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {activityTypes.find((at) => at.id === filters.activityType)?.label}
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, activityType: "" }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {filters.contactId && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {`${
                    contacts.find((c) => c.id === filters.contactId)?.first_name
                  } ${
                    contacts.find((c) => c.id === filters.contactId)?.last_name
                  }`}
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, contactId: "" }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {filters.dealId && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {deals.find((d) => d.id === filters.dealId)?.name}
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, dealId: "" }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {filters.status && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {filters.status === "open" ? "Ouvert" : "Fait"}
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, status: "" }))
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Type d'activité
              </label>
              <select
                value={filters.activityType}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, activityType: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                  fontSize: 12,
                }}
              >
                <option value="">— Tous les types —</option>
                {activityTypes.map((at) => (
                  <option key={at.id} value={at.id}>
                    {at.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Contact
              </label>
              <select
                value={filters.contactId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, contactId: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                  fontSize: 12,
                }}
              >
                <option value="">— Tous les contacts —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Dossier
              </label>
              <select
                value={filters.dealId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dealId: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                  fontSize: 12,
                }}
              >
                <option value="">— Tous les dossiers —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Statut
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-1)",
                  fontSize: 12,
                }}
              >
                <option value="">— Tous les statuts —</option>
                <option value="open">Ouvert</option>
                <option value="done">Fait</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-5)" }}>
            Chargement...
          </div>
        ) : view === "calendar" ? (
          <>
            {/* Calendar month header */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(year, month - 1, 1)
                  )
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-2)",
                  textTransform: "capitalize",
                }}
              >
                {monthName}
              </span>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(year, month + 1, 1)
                  )
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendar grid */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 16,
              }}
            >
              {renderCalendarView()}
            </div>
          </>
        ) : (
          /* List view */
          renderListView()
        )}
      </div>

      {/* Unified activity modal */}
      <UnifiedActivityModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedActivity(null);
        }}
        onSave={handleSaveActivity}
        mode={selectedActivity ? "edit" : "create"}
        editingActivity={selectedActivity}
        organisations={organisations}
      />
    </div>
  );
}
