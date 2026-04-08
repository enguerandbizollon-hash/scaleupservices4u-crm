"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getActions, completeAction, deleteAction, type ActionRow } from "@/actions/actions";
import ActionModal from "./ActionModal";

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionTimelineProps {
  filters: {
    deal_id?: string;
    organization_id?: string;
    contact_id?: string;
  };
  showCreateButton?: boolean;
  compactMode?: boolean;
}

type FilterType = "all" | "task" | "meeting" | "call" | "email" | "note" | "deadline";

const TYPE_ICONS: Record<string, string> = {
  task: "\uD83D\uDCCB",
  call: "\uD83D\uDCDE",
  meeting: "\uD83E\uDD1D",
  email: "\u2709\uFE0F",
  note: "\uD83D\uDCDD",
  deadline: "\uD83D\uDD34",
};

const FILTER_PILLS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "task", label: "Taches" },
  { value: "meeting", label: "Meetings" },
  { value: "call", label: "Appels" },
  { value: "email", label: "Emails" },
  { value: "note", label: "Notes" },
  { value: "deadline", label: "Deadlines" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  done:        { bg: "#dcfce7", color: "#166534", label: "Termine" },
  completed:   { bg: "#dcfce7", color: "#166534", label: "Termine" },
  met:         { bg: "#dcfce7", color: "#166534", label: "Atteint" },
  missed:      { bg: "#fee2e2", color: "#991b1b", label: "Manque" },
  sent:        { bg: "#dcfce7", color: "#166534", label: "Envoye" },
  received:    { bg: "#dcfce7", color: "#166534", label: "Recu" },
  no_show:     { bg: "#fef3c7", color: "#92400e", label: "Absent" },
  open:        { bg: "#dbeafe", color: "#1e40af", label: "Ouvert" },
  in_progress: { bg: "#ffedd5", color: "#9a3412", label: "En cours" },
  planned:     { bg: "#dbeafe", color: "#1e40af", label: "Prevu" },
  upcoming:    { bg: "#dbeafe", color: "#1e40af", label: "A venir" },
  draft:       { bg: "#f3f4f6", color: "#4b5563", label: "Brouillon" },
  cancelled:   { bg: "#f3f4f6", color: "#6b7280", label: "Annule" },
};

// Groupement des statuts pour sections en cours / terminées
const ACTIVE_STATUSES = ["open", "in_progress", "planned", "upcoming", "draft"];
const DONE_STATUSES   = ["done", "completed", "cancelled", "met", "missed", "sent", "received", "no_show"];

function formatDate(dateStr: string | null, timeStr: string | null, allDay: boolean): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const months = ["jan", "fev", "mar", "avr", "mai", "jun", "jul", "aou", "sep", "oct", "nov", "dec"];
  const day = d.getDate().toString().padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let result = `${day} ${month} ${year}`;
  if (!allDay && timeStr) result += ` ${timeStr}`;
  return result;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === new Date().toISOString().split("T")[0];
}

function isOverdue(dateStr: string | null, status: string): boolean {
  if (!dateStr) return false;
  const doneStatuses = ["done", "completed", "met", "sent", "cancelled"];
  if (doneStatuses.includes(status)) return false;
  return dateStr < new Date().toISOString().split("T")[0];
}

function participantNames(action: ActionRow): string {
  const contacts = action.action_contacts ?? [];
  if (contacts.length === 0) return "";
  const names = contacts.slice(0, 3).map(c => `${c.contacts.first_name} ${c.contacts.last_name}`);
  const suffix = contacts.length > 3 ? ` +${contacts.length - 3}` : "";
  return names.join(", ") + suffix;
}

// ── Render helper ────────────────────────────────────────────────────────────
function renderAction(action: ActionRow, ctx: {
  isDone: boolean;
  itemBase: React.CSSProperties;
  badge: (bg: string, color: string) => React.CSSProperties;
  actionBtn: React.CSSProperties;
  onComplete: (id: string) => void;
  onEdit: (a: ActionRow) => void;
  onDelete: (id: string) => void;
}) {
  const overdue = isOverdue(action.due_date, action.status);
  const today = isToday(action.due_date);
  const statusInfo = STATUS_COLORS[action.status] || STATUS_COLORS.open;
  const participants = participantNames(action);
  const orgName = action.organizations?.name;
  const isDone = ctx.isDone;

  let itemBg = "var(--surface)";
  if (!isDone && overdue) itemBg = "#fef2f2";
  else if (!isDone && today) itemBg = "#fffbeb";

  return (
    <div key={action.id} style={{ ...ctx.itemBase, background: itemBg, opacity: isDone ? 0.75 : 1 }}>
      {/* Icon */}
      <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>
        {TYPE_ICONS[action.type] || "\uD83D\uDCCB"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          <span style={{
            fontSize: 13.5, fontWeight: 600, color: isDone ? "var(--text-4)" : "var(--text-1)",
            textDecoration: isDone ? "line-through" : "none",
          }}>
            {action.title}
          </span>
          <span style={ctx.badge(statusInfo.bg, statusInfo.color)}>{statusInfo.label}</span>
          {!isDone && overdue && <span style={ctx.badge("#fee2e2", "#b91c1c")}>En retard</span>}
          {!isDone && today && <span style={ctx.badge("#fef3c7", "#92400e")}>Aujourd&apos;hui</span>}
        </div>

        {action.due_date && (
          <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 3 }}>
            {formatDate(action.due_date, action.due_time, action.is_all_day)}
          </div>
        )}

        {participants && (
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 3 }}>
            {participants}
          </div>
        )}

        {/* Phone — action de type call, affiché depuis le premier participant ou action.phone_number */}
        {action.type === "call" && (() => {
          const contactPhone = action.action_contacts?.[0]?.contacts?.phone;
          const displayPhone = action.phone_number || contactPhone;
          return displayPhone ? (
            <a
              href={`tel:${displayPhone}`}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: "var(--su-500)", textDecoration: "none", marginBottom: 3, display: "inline-block" }}>
              📞 {displayPhone}
            </a>
          ) : null;
        })()}

        {/* Email destinataires — action de type email */}
        {action.type === "email" && action.email_to && action.email_to.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 3 }}>
            → {action.email_to.join(", ")}
            {action.email_cc && action.email_cc.length > 0 && (
              <span style={{ color: "var(--text-4)" }}> · cc {action.email_cc.join(", ")}</span>
            )}
          </div>
        )}

        {/* Meet link — action de type meeting */}
        {action.type === "meeting" && action.meet_link && (
          <a
            href={action.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 12, color: "var(--su-500)", textDecoration: "none", marginBottom: 3, display: "inline-block" }}>
            🎥 Rejoindre Meet
          </a>
        )}

        {orgName && (
          <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 3 }}>
            {orgName}
          </div>
        )}

        {action.summary_ai && (
          <div style={{
            fontSize: 12, color: "var(--text-4)", marginTop: 4,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {action.summary_ai}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {!isDone && (
            <button type="button" onClick={() => ctx.onComplete(action.id)} style={ctx.actionBtn} title="Terminer">
              ✓
            </button>
          )}
          <button type="button" onClick={() => ctx.onEdit(action)} style={ctx.actionBtn} title="Modifier">
            ✏️
          </button>
          <button type="button" onClick={() => ctx.onDelete(action.id)} style={{ ...ctx.actionBtn, color: "#b91c1c" }} title="Supprimer">
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActionTimeline({
  filters,
  showCreateButton = true,
  compactMode = false,
}: ActionTimelineProps) {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionRow | undefined>(undefined);
  const [doneOpen, setDoneOpen] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const loadActions = useCallback(async () => {
    setLoading(true);
    const typeFilter = activeFilter !== "all" ? [activeFilter] : undefined;
    const data = await getActions({
      deal_id: filters.deal_id,
      organization_id: filters.organization_id,
      contact_id: filters.contact_id,
      type: typeFilter,
    });
    setActions(data);
    setLoading(false);
  }, [filters.deal_id, filters.organization_id, filters.contact_id, activeFilter]);

  useEffect(() => { loadActions(); }, [loadActions]);

  const handleComplete = async (id: string) => {
    await completeAction(id);
    loadActions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette action ?")) return;
    await deleteAction(id);
    loadActions();
  };

  const handleEdit = (action: ActionRow) => {
    setEditingAction(action);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingAction(undefined);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setEditingAction(undefined);
    loadActions();
  };

  // Séparer actif / terminé
  const activeList = actions.filter(a => ACTIVE_STATUSES.includes(a.status));
  const doneList = [...actions]
    .filter(a => DONE_STATUSES.includes(a.status))
    .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""));

  // Compact mode : uniquement les 5 premières actives
  const displayedActive = compactMode ? activeList.slice(0, 5) : activeList;
  const displayedDone = showAllDone ? doneList : doneList.slice(0, 10);

  // ── Styles ──────────────────────────────────────────────────────────────
  const pillBase: React.CSSProperties = {
    padding: "5px 12px", borderRadius: 16, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12,
    fontWeight: 600, cursor: "pointer", transition: "all .15s",
  };
  const pillActive: React.CSSProperties = {
    ...pillBase, background: "var(--su-500)", color: "#fff", border: "1px solid var(--su-500)",
  };
  const btnCreate: React.CSSProperties = {
    padding: "7px 16px", borderRadius: 8, border: "none", fontWeight: 700,
    fontSize: 13, cursor: "pointer", background: "var(--su-500)", color: "#fff",
    display: "inline-flex", alignItems: "center", gap: 5,
  };
  const itemBase: React.CSSProperties = {
    display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--surface)",
    marginBottom: 8, transition: "background .15s",
  };
  const badge = (bg: string, color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 10,
    fontSize: 11, fontWeight: 700, background: bg, color, marginLeft: 6,
  });
  const actionBtn: React.CSSProperties = {
    background: "none", border: "1px solid var(--border)", borderRadius: 6,
    padding: "3px 8px", fontSize: 13, cursor: "pointer", color: "var(--text-3)",
    transition: "background .15s",
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Actions</span>
        {showCreateButton && (
          <button type="button" onClick={handleCreate} style={btnCreate}>+ Action</button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {FILTER_PILLS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveFilter(f.value)}
            style={activeFilter === f.value ? pillActive : pillBase}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>
          Chargement...
        </div>
      )}

      {/* Empty state */}
      {!loading && actions.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)", fontSize: 13.5 }}>
          <div style={{ marginBottom: 10 }}>Aucune action</div>
          {showCreateButton && (
            <button type="button" onClick={handleCreate} style={btnCreate}>+ Creer une action</button>
          )}
        </div>
      )}

      {/* ═══ Section EN COURS ═══ */}
      {!loading && displayedActive.map(action => renderAction(action, {
        isDone: false, itemBase, badge, actionBtn,
        onComplete: handleComplete, onEdit: handleEdit, onDelete: handleDelete,
      }))}

      {/* Empty active state */}
      {!loading && activeList.length === 0 && doneList.length > 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-5)", fontSize: 12.5, fontStyle: "italic" }}>
          Aucune action en cours
        </div>
      )}

      {/* ═══ Séparateur + Section TERMINÉES (full mode seulement) ═══ */}
      {!loading && !compactMode && doneList.length > 0 && (
        <>
          <button type="button" onClick={() => setDoneOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "10px 12px", marginTop: 14, marginBottom: 8,
              background: "none", border: "none", borderTop: "1px solid var(--border)",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, color: "var(--text-4)",
              textTransform: "uppercase", letterSpacing: ".05em",
            }}>
            <span style={{ fontSize: 14 }}>{doneOpen ? "▾" : "▸"}</span>
            Terminees ({doneList.length})
          </button>

          {doneOpen && displayedDone.map(action => renderAction(action, {
            isDone: true, itemBase, badge, actionBtn,
            onComplete: handleComplete, onEdit: handleEdit, onDelete: handleDelete,
          }))}

          {doneOpen && doneList.length > 10 && !showAllDone && (
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button type="button" onClick={() => setShowAllDone(true)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6,
                  padding: "5px 14px", fontSize: 12, cursor: "pointer", color: "var(--text-3)", fontFamily: "inherit" }}>
                Voir plus ({doneList.length - 10})
              </button>
            </div>
          )}
        </>
      )}

      {/* Compact mode: show more link */}
      {compactMode && actions.length > 5 && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a
            href="/protected/agenda"
            style={{ fontSize: 13, color: "var(--su-500)", textDecoration: "none", fontWeight: 600 }}
          >
            Voir tout ({actions.length} actions)
          </a>
        </div>
      )}

      {/* ActionModal */}
      <ActionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAction(undefined); }}
        onSaved={handleSaved}
        editingAction={editingAction}
        context={{
          deal_id:         filters.deal_id,
          organization_id: filters.organization_id,
          contact_id:      filters.contact_id,
        }}
      />
    </div>
  );
}
