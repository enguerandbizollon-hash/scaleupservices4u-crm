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
  sent:        { bg: "#dcfce7", color: "#166534", label: "Envoye" },
  open:        { bg: "#dbeafe", color: "#1e40af", label: "Ouvert" },
  in_progress: { bg: "#ffedd5", color: "#9a3412", label: "En cours" },
  cancelled:   { bg: "#f3f4f6", color: "#6b7280", label: "Annule" },
};

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

  const displayed = compactMode ? actions.slice(0, 5) : actions;

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

      {/* Timeline items */}
      {!loading && displayed.map(action => {
        const overdue = isOverdue(action.due_date, action.status);
        const today = isToday(action.due_date);
        const doneStatuses = ["done", "completed", "met", "sent"];
        const isDone = doneStatuses.includes(action.status);
        const statusInfo = STATUS_COLORS[action.status] || STATUS_COLORS.open;
        const participants = participantNames(action);
        const orgName = action.organizations?.name;

        let itemBg = "var(--surface)";
        if (overdue) itemBg = "#fef2f2";
        else if (today && !isDone) itemBg = "#fffbeb";

        return (
          <div key={action.id} style={{ ...itemBase, background: itemBg }}>
            {/* Icon */}
            <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>
              {TYPE_ICONS[action.type] || "\uD83D\uDCCB"}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title line */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                <span style={{
                  fontSize: 13.5, fontWeight: 600, color: isDone ? "var(--text-4)" : "var(--text-1)",
                  textDecoration: isDone ? "line-through" : "none",
                }}>
                  {action.title}
                </span>
                <span style={badge(statusInfo.bg, statusInfo.color)}>{statusInfo.label}</span>
                {overdue && <span style={badge("#fee2e2", "#b91c1c")}>En retard</span>}
                {today && !isDone && <span style={badge("#fef3c7", "#92400e")}>Aujourd&apos;hui</span>}
              </div>

              {/* Date */}
              {action.due_date && (
                <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 3 }}>
                  {formatDate(action.due_date, action.due_time, action.is_all_day)}
                </div>
              )}

              {/* Participants */}
              {participants && (
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 3 }}>
                  {participants}
                </div>
              )}

              {/* Org name */}
              {orgName && (
                <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 3 }}>
                  {orgName}
                </div>
              )}

              {/* AI summary */}
              {action.summary_ai && (
                <div style={{
                  fontSize: 12, color: "var(--text-4)", marginTop: 4,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {action.summary_ai}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {!isDone && (
                  <button type="button" onClick={() => handleComplete(action.id)} style={actionBtn} title="Terminer">
                    ✓
                  </button>
                )}
                <button type="button" onClick={() => handleEdit(action)} style={actionBtn} title="Modifier">
                  ✏️
                </button>
                <button type="button" onClick={() => handleDelete(action.id)} style={{ ...actionBtn, color: "#b91c1c" }} title="Supprimer">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        );
      })}

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
          deal_id: filters.deal_id,
          organization_id: filters.organization_id,
        }}
      />
    </div>
  );
}
