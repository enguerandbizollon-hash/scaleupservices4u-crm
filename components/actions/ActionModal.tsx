"use client";

import React, { useState, useEffect } from "react";
import { createAction, updateAction, type ActionRow } from "@/actions/actions";

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingAction?: ActionRow;
  defaultType?: string;
  context?: {
    deal_id?: string;
    organization_id?: string;
    contact_id?: string;
    mandate_id?: string;
  };
}

const ACTION_TYPES = [
  { value: "task", label: "Tache", icon: "\uD83D\uDCCB" },
  { value: "call", label: "Appel", icon: "\uD83D\uDCDE" },
  { value: "meeting", label: "Meeting", icon: "\uD83E\uDD1D" },
  { value: "email", label: "Email", icon: "\u2709\uFE0F" },
  { value: "note", label: "Note", icon: "\uD83D\uDCDD" },
  { value: "deadline", label: "Deadline", icon: "\uD83D\uDD34" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActionModal({
  open,
  onClose,
  onSaved,
  editingAction,
  defaultType,
  context,
}: ActionModalProps) {
  const isEdit = !!editingAction;

  const [type, setType] = useState(defaultType || "task");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayStr());
  const [dueTime, setDueTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startDatetime, setStartDatetime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailDirection, setEmailDirection] = useState("sent");
  const [emailSubject, setEmailSubject] = useState("");
  const [dealId, setDealId] = useState(context?.deal_id || "");
  const [organizationId, setOrganizationId] = useState(context?.organization_id || "");
  const [mandateId, setMandateId] = useState(context?.mandate_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    if (isEdit && editingAction) {
      setType(editingAction.type);
      setTitle(editingAction.title);
      setPriority(editingAction.priority || "medium");
      setDescription(editingAction.description || "");
      setDueDate(editingAction.due_date || todayStr());
      setDueTime(editingAction.due_time || "10:00");
      setIsAllDay(editingAction.is_all_day);
      setStartDatetime(editingAction.start_datetime || "");
      setDurationMinutes(editingAction.duration_minutes || 60);
      setLocation(editingAction.location || "");
      setMeetLink(editingAction.meet_link || "");
      setPhoneNumber(editingAction.phone_number || "");
      setEmailDirection(editingAction.email_direction || "sent");
      setEmailSubject(editingAction.email_subject || "");
      setDealId(editingAction.deal_id || "");
      setOrganizationId(editingAction.organization_id || "");
      setMandateId(editingAction.mandate_id || "");
    } else {
      setType(defaultType || "task");
      setTitle("");
      setPriority("medium");
      setDescription("");
      setDueDate(todayStr());
      setDueTime("10:00");
      setIsAllDay(true);
      setStartDatetime("");
      setDurationMinutes(60);
      setLocation("");
      setMeetLink("");
      setPhoneNumber("");
      setEmailDirection("sent");
      setEmailSubject("");
      setDealId(context?.deal_id || "");
      setOrganizationId(context?.organization_id || "");
      setMandateId(context?.mandate_id || "");
    }
    setError("");
  }, [open, isEdit, editingAction, defaultType, context]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Le titre est requis"); return; }
    setSaving(true);
    setError("");

    const payload = {
      type,
      title: title.trim(),
      priority,
      description: description || undefined,
      due_date: dueDate || undefined,
      due_time: !isAllDay ? dueTime : undefined,
      is_all_day: isAllDay,
      start_datetime: (type === "meeting" || type === "call") && startDatetime ? startDatetime : undefined,
      duration_minutes: (type === "meeting" || type === "call") ? durationMinutes : undefined,
      location: type === "meeting" ? location || undefined : undefined,
      meet_link: type === "meeting" ? meetLink || undefined : undefined,
      phone_number: type === "call" ? phoneNumber || undefined : undefined,
      email_direction: type === "email" ? emailDirection : undefined,
      email_subject: type === "email" ? emailSubject || undefined : undefined,
      deal_id: dealId || undefined,
      organization_id: organizationId || undefined,
      mandate_id: mandateId || undefined,
    };

    const result = isEdit
      ? await updateAction(editingAction!.id, payload)
      : await createAction(payload);

    setSaving(false);
    if (result.success) { onSaved(); onClose(); }
    else setError(result.error || "Erreur lors de la sauvegarde");
  };

  if (!open) return null;

  // ── Styles ──────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16,
    padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "1px solid var(--border)",
    borderRadius: 8, background: "var(--surface-2)", color: "var(--text-1)",
    fontSize: 13.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-4)",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em",
  };
  const mb14: React.CSSProperties = { marginBottom: 14 };
  const pillBase: React.CSSProperties = {
    padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12.5,
    fontWeight: 600, cursor: "pointer", transition: "all .15s",
  };
  const pillActive: React.CSSProperties = {
    ...pillBase, background: "var(--su-500)", color: "#fff", borderColor: "var(--su-500)",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "9px 22px", borderRadius: 8, border: "none", fontWeight: 700,
    fontSize: 13.5, cursor: "pointer", background: "var(--su-500)", color: "#fff",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", background: "transparent",
    color: "var(--text-3)",
  };

  const showMeetingFields = type === "meeting" || type === "call";

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
            {isEdit ? "Modifier l'action" : "Nouvelle action"}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-4)", fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: Type pills */}
        <div style={mb14}>
          <label style={lbl}>Type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ACTION_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                style={type === t.value ? pillActive : pillBase}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Common fields */}
        <div style={mb14}>
          <label style={lbl}>Titre *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="ex: Appel de suivi avec Jean Dupont"
            style={inp}
            autoFocus
          />
        </div>

        <div style={mb14}>
          <label style={lbl}>Priorite</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={mb14}>
          <label style={lbl}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Details de l'action..."
            style={{ ...inp, resize: "vertical" }}
          />
        </div>

        {/* Section 3: Date fields */}
        <div style={mb14}>
          <label style={lbl}>Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
        </div>

        <div style={{ ...mb14, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={e => setIsAllDay(e.target.checked)}
              style={{ accentColor: "var(--su-500)" }}
            />
            Toute la journee
          </label>
          {!isAllDay && (
            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ ...inp, width: 130 }} />
          )}
        </div>

        {/* Meeting/Call specific */}
        {showMeetingFields && (
          <>
            <div style={mb14}>
              <label style={lbl}>Debut (date et heure)</label>
              <input
                type="datetime-local"
                value={startDatetime}
                onChange={e => setStartDatetime(e.target.value)}
                style={inp}
              />
            </div>
            <div style={mb14}>
              <label style={lbl}>Duree</label>
              <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} style={inp}>
                {DURATION_OPTIONS.map(d => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </>
        )}

        {type === "meeting" && (
          <>
            <div style={mb14}>
              <label style={lbl}>Lieu</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bureau, restaurant..." style={inp} />
            </div>
            <div style={mb14}>
              <label style={lbl}>Lien Meet / Zoom</label>
              <input type="url" value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." style={inp} />
            </div>
          </>
        )}

        {type === "call" && (
          <div style={mb14}>
            <label style={lbl}>Numero de telephone</label>
            <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+33 6 ..." style={inp} />
          </div>
        )}

        {type === "email" && (
          <>
            <div style={mb14}>
              <label style={lbl}>Direction</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: "sent", l: "Envoye" }, { v: "received", l: "Recu" }].map(d => (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => setEmailDirection(d.v)}
                    style={emailDirection === d.v ? pillActive : pillBase}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={mb14}>
              <label style={lbl}>Objet</label>
              <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Objet de l'email" style={inp} />
            </div>
          </>
        )}

        {/* Section 4: Context links */}
        {!context?.deal_id && (
          <div style={mb14}>
            <label style={lbl}>Dossier (ID)</label>
            <input type="text" value={dealId} onChange={e => setDealId(e.target.value)} placeholder="UUID du dossier" style={inp} />
          </div>
        )}
        {!context?.organization_id && (
          <div style={mb14}>
            <label style={lbl}>Organisation (ID)</label>
            <input type="text" value={organizationId} onChange={e => setOrganizationId(e.target.value)} placeholder="UUID de l'organisation" style={inp} />
          </div>
        )}
        {!context?.mandate_id && (
          <div style={mb14}>
            <label style={lbl}>Mandat (ID)</label>
            <input type="text" value={mandateId} onChange={e => setMandateId(e.target.value)} placeholder="UUID du mandat" style={inp} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Creer"}
          </button>
        </div>
      </div>
    </div>
  );
}
