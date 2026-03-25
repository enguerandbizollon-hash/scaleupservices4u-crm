"use client";

import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { OrgContactPicker } from "./org-contact-picker";
import { unifiedActivityTypeLabels } from "@/lib/crm/labels";

interface Organisation {
  id: string;
  name: string;
}

interface UnifiedActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: UnifiedActivityFormData) => Promise<boolean>;
  dealId?: string;
  contactId?: string;
  organizationId?: string;
  defaultType?: string;
  mode?: "create" | "edit";
  editingActivity?: any;
  organisations?: Organisation[];
}

export interface UnifiedActivityFormData {
  title: string;
  summary?: string;
  activityType: string; // 'todo', 'meeting', 'call', 'deadline', 'recruitment_interview', etc.
  status: 'open' | 'done' | 'cancelled'; // task_status
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  location?: string;
  dealId?: string;
  contactId?: string;
  organizationId?: string;
  organizationIds?: string[]; // Multi-organisation support
  participantContactIds?: string[];
  isAllDay?: boolean;
}

const ACTIVITY_CATEGORIES = {
  "Tasks": ["todo", "follow_up"],
  "Communication": ["call", "meeting", "email_sent", "email_received", "intro"],
  "Documents": ["deck_sent", "nda", "document_sent"],
  "Événements": ["deadline", "delivery", "closing"],
  "Recrutement": ["recruitment_interview", "recruitment_feedback", "recruitment_task"],
  "Advisory": ["cfo_advisory", "investor_meeting", "due_diligence"],
  "Notes": ["note", "other"],
};

const TIME_OPTIONS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"
];

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function UnifiedActivityModal({
  isOpen,
  onClose,
  onSave,
  dealId,
  contactId,
  organizationId,
  defaultType = "meeting",
  mode = "create",
  editingActivity,
  organisations = [],
}: UnifiedActivityModalProps) {
  const [form, setForm] = useState<UnifiedActivityFormData>({
    title: "",
    summary: "",
    activityType: defaultType,
    status: "open",
    dueDate: addDays(0),
    dueTime: "10:00",
    location: "",
    dealId,
    contactId,
    organizationId,
    organizationIds: organizationId ? [organizationId] : [],
    participantContactIds: contactId ? [contactId] : [],
    isAllDay: false,
  });

  const [saving, setSaving] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Initialize form from editingActivity when in edit mode
  useEffect(() => {
    if (isOpen && mode === "edit" && editingActivity) {
      setForm({
        title: editingActivity.title || "",
        summary: editingActivity.summary || "",
        activityType: editingActivity.activity_type || defaultType,
        status: editingActivity.task_status || "open",
        dueDate: editingActivity.due_date || addDays(0),
        dueTime: editingActivity.due_time || "10:00",
        location: editingActivity.location || "",
        dealId: editingActivity.deal_id || dealId,
        contactId: editingActivity.contact_id || contactId,
        organizationId: editingActivity.organization_id || organizationId,
        organizationIds: editingActivity.organization_ids || (editingActivity.organization_id ? [editingActivity.organization_id] : []),
        participantContactIds: editingActivity.participants?.map((p: any) => p.id) || [],
        isAllDay: editingActivity.is_all_day || false,
      });
    } else if (isOpen && mode === "create") {
      setForm({
        title: "",
        summary: "",
        activityType: defaultType,
        status: "open",
        dueDate: addDays(0),
        dueTime: "10:00",
        location: "",
        dealId,
        contactId,
        organizationId,
        organizationIds: organizationId ? [organizationId] : [],
        participantContactIds: contactId ? [contactId] : [],
        isAllDay: false,
      });
    }
  }, [isOpen, mode, editingActivity, dealId, contactId, organizationId, defaultType]);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof UnifiedActivityFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const setField = (field: keyof UnifiedActivityFormData) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    handleFieldChange(field, e.target.value);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const success = await onSave(form);
    setSaving(false);
    if (success) onClose();
  };

  const inpStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface-2)",
    color: "var(--text-1)",
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 600,
    color: "var(--text-4)",
    marginBottom: 5,
    textTransform: "uppercase",
  };

  // Détecter si c'est un type avec date/time
  const hasDateTime = ["deadline", "delivery", "closing", "meeting", "call", "recruitment_interview"].includes(form.activityType);
  const multilineTypes = ["note", "todo", "cfo_advisory"];
  const needsLocation = ["meeting", "call", "recruitment_interview"].includes(form.activityType);
  const needsParticipants = ["meeting", "call", "recruitment_interview"].includes(form.activityType);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            {mode === "edit" ? "Modifier activité" : "Nouvelle activité"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Type d'activité */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Type</label>
          <select
            value={form.activityType}
            onChange={setField("activityType")}
            style={inpStyle}
          >
            {Object.entries(ACTIVITY_CATEGORIES).map(([category, types]) => (
              <optgroup key={category} label={category}>
                {types.map(type => (
                  <option key={type} value={type}>
                    {unifiedActivityTypeLabels[type] || type}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Titre</label>
          <input
            type="text"
            placeholder="ex: Appel avec Jean Dupont"
            value={form.title}
            onChange={setField("title")}
            style={inpStyle}
          />
        </div>

        {/* Organisations */}
        {organisations.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Organisations</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {organisations.map(org => (
                <label key={org.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={(form.organizationIds || []).includes(org.id)}
                    onChange={e => {
                      const orgIds = form.organizationIds || [];
                      if (e.target.checked) {
                        handleFieldChange("organizationIds", [...orgIds, org.id]);
                        // Aussi set la première comme organizationId (singular) pour backward compat
                        if (!form.organizationId) {
                          handleFieldChange("organizationId", org.id);
                        }
                      } else {
                        const filtered = orgIds.filter(id => id !== org.id);
                        handleFieldChange("organizationIds", filtered);
                        // Si on retire la principale, on met la première restante
                        if (form.organizationId === org.id) {
                          handleFieldChange("organizationId", filtered[0] || undefined);
                        }
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  {org.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Résumé/Description */}
        {multilineTypes.includes(form.activityType) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Détails supplémentaires..."
              value={form.summary || ""}
              onChange={e => handleFieldChange("summary", e.target.value)}
              style={{
                ...inpStyle,
                minHeight: 80,
                resize: "vertical",
              } as React.CSSProperties}
            />
          </div>
        )}

        {/* Date & Heure */}
        {hasDateTime && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={form.dueDate || ""}
                onChange={setField("dueDate")}
                style={inpStyle}
              />
            </div>

            {/* Quick date buttons */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { label: "Aujourd'hui", days: 0 },
                { label: "Demain", days: 1 },
                { label: "Cette semaine", days: 7 },
                { label: "Ce mois", days: 30 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => handleFieldChange("dueDate", addDays(days))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${
                      form.dueDate === addDays(days) ? "var(--su-500)" : "var(--border)"
                    }`,
                    background:
                      form.dueDate === addDays(days)
                        ? "var(--su-500)"
                        : "var(--surface-2)",
                    color:
                      form.dueDate === addDays(days)
                        ? "#fff"
                        : "var(--text-3)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Heure */}
            {!form.isAllDay && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Heure</label>
                <select
                  value={form.dueTime || "10:00"}
                  onChange={setField("dueTime")}
                  style={inpStyle}
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* All day toggle */}
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="allday"
                checked={form.isAllDay || false}
                onChange={e => handleFieldChange("isAllDay", e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="allday" style={{ fontSize: 13, cursor: "pointer" }}>
                Journée complète
              </label>
            </div>
          </>
        )}

        {/* Localisation (pour meetings/calls) */}
        {needsLocation && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Lieu</label>
            <input
              type="text"
              placeholder="ex: Salle de réunion / Zoom"
              value={form.location || ""}
              onChange={setField("location")}
              style={inpStyle}
            />
          </div>
        )}

        {/* Participants */}
        {needsParticipants && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--text-2)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Plus size={14} />
              {form.participantContactIds?.length || 0} participant
              {(form.participantContactIds?.length || 0) !== 1 ? "s" : ""}
            </button>

            {showParticipants && (
              <div style={{ marginTop: 12 }}>
                <OrgContactPicker
                  organizationId={form.organizationId}
                  contactIds={form.participantContactIds || []}
                  onContactsChange={contactIds =>
                    handleFieldChange("participantContactIds", contactIds)
                  }
                  multiSelect={true}
                  label="Participants"
                />
              </div>
            )}
          </div>
        )}

        {/* Status */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Statut</label>
          <select
            value={form.status}
            onChange={setField("status")}
            style={inpStyle}
          >
            <option value="open">Ouverte</option>
            <option value="done">Terminée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-3)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || saving}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "var(--su-500)",
              color: "#fff",
              cursor: "pointer",
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              opacity: !form.title.trim() || saving ? 0.5 : 1,
            }}
          >
            {saving ? "Enregistrement..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
