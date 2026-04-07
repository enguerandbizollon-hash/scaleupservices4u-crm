"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createAction, updateAction, generateMeetLinkAction, generateActionSummaryAction, type ActionRow } from "@/actions/actions";
import { getAllContactsSimple } from "@/actions/contacts";
import { getAllOrganisationsSimple } from "@/actions/organisations";

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

type ContactOption = { id: string; first_name: string; last_name: string; email: string | null };
type OrgOption = { id: string; name: string };

interface Participant { contact_id: string; name: string; role: string; attended: boolean }
interface LinkedOrg { organization_id: string; name: string; role: string }

const ACTION_TYPES = [
  { value: "task", label: "Tache", icon: "\uD83D\uDCCB" },
  { value: "call", label: "Appel", icon: "\uD83D\uDCDE" },
  { value: "meeting", label: "Meeting", icon: "\uD83E\uDD1D" },
  { value: "email", label: "Email", icon: "\u2709\uFE0F" },
  { value: "note", label: "Note", icon: "\uD83D\uDCDD" },
  { value: "deadline", label: "Deadline", icon: "\uD83D\uDD34" },
  { value: "document_request", label: "Document", icon: "\uD83D\uDCC4" },
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

  // Base fields
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
  const [documentUrl, setDocumentUrl] = useState("");
  const [dealId, setDealId] = useState(context?.deal_id || "");
  const [organizationId, setOrganizationId] = useState(context?.organization_id || "");
  const [mandateId, setMandateId] = useState(context?.mandate_id || "");

  // Participants (contacts liaison)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  // Linked organizations
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [orgSearch, setOrgSearch] = useState("");

  // Meet & AI
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [summaryAI, setSummaryAI] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load contacts + orgs lists
  const loadOptions = useCallback(async () => {
    const [contacts, orgs] = await Promise.all([
      getAllContactsSimple(),
      getAllOrganisationsSimple(),
    ]);
    setContactOptions(contacts);
    setOrgOptions(orgs);
  }, []);

  useEffect(() => {
    if (open) loadOptions();
  }, [open, loadOptions]);

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
      setDocumentUrl(editingAction.document_url || "");
      setDealId(editingAction.deal_id || "");
      setOrganizationId(editingAction.organization_id || "");
      setMandateId(editingAction.mandate_id || "");
      setSummaryAI(editingAction.summary_ai || null);
      // Load existing participants
      setParticipants(
        (editingAction.action_contacts ?? []).map(ac => ({
          contact_id: ac.contact_id,
          name: `${ac.contacts.first_name} ${ac.contacts.last_name}`,
          role: ac.role ?? "",
          attended: ac.attended,
        }))
      );
      // Load existing linked orgs
      setLinkedOrgs(
        (editingAction.action_organizations ?? []).map(ao => ({
          organization_id: ao.organization_id,
          name: ao.organizations.name,
          role: ao.role ?? "",
        }))
      );
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
      setDocumentUrl("");
      setDealId(context?.deal_id || "");
      setOrganizationId(context?.organization_id || "");
      setMandateId(context?.mandate_id || "");
      setParticipants([]);
      setLinkedOrgs([]);
      setSummaryAI(null);
    }
    setContactSearch("");
    setOrgSearch("");
    setError("");
  }, [open, isEdit, editingAction, defaultType, context]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function addParticipant(c: ContactOption) {
    if (participants.some(p => p.contact_id === c.id)) return;
    setParticipants(prev => [...prev, { contact_id: c.id, name: `${c.first_name} ${c.last_name}`, role: "", attended: true }]);
    setContactSearch("");
  }

  function removeParticipant(contactId: string) {
    setParticipants(prev => prev.filter(p => p.contact_id !== contactId));
  }

  function addLinkedOrg(o: OrgOption) {
    if (linkedOrgs.some(lo => lo.organization_id === o.id)) return;
    setLinkedOrgs(prev => [...prev, { organization_id: o.id, name: o.name, role: "" }]);
    setOrgSearch("");
  }

  function removeLinkedOrg(orgId: string) {
    setLinkedOrgs(prev => prev.filter(lo => lo.organization_id !== orgId));
  }

  async function handleGenerateMeet() {
    setGeneratingMeet(true);
    const res = await generateMeetLinkAction();
    if (res.success && res.meet_link) setMeetLink(res.meet_link);
    else setError(res.error || "Erreur Meet");
    setGeneratingMeet(false);
  }

  async function handleGenerateAI() {
    if (!isEdit || !editingAction) return;
    setGeneratingAI(true);
    const res = await generateActionSummaryAction(editingAction.id);
    if (res.success && res.summary) setSummaryAI(res.summary);
    else setError(res.error || "Erreur IA");
    setGeneratingAI(false);
  }

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
      document_url: documentUrl.trim() || undefined,
      deal_id: dealId || undefined,
      organization_id: organizationId || undefined,
      mandate_id: mandateId || undefined,
      contact_ids: participants.map(p => ({ id: p.contact_id, role: p.role || undefined, attended: p.attended })),
      organization_ids: linkedOrgs.map(o => ({ id: o.organization_id, role: o.role || undefined })),
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
    padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
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
  const btnSmall: React.CSSProperties = {
    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
    fontSize: 12, cursor: "pointer", background: "var(--surface-2)", color: "var(--text-3)",
    fontFamily: "inherit", fontWeight: 500,
  };
  const chipStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
    borderRadius: 8, background: "var(--surface-3)", fontSize: 12.5, color: "var(--text-2)",
  };

  const showMeetingFields = type === "meeting" || type === "call";
  const showParticipants = type === "meeting" || type === "call";

  // Filtered contact options
  const filteredContacts = contactSearch.trim()
    ? contactOptions.filter(c => {
        const q = contactSearch.toLowerCase();
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
          || (c.email ?? "").toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const filteredOrgs = orgSearch.trim()
    ? orgOptions.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
            {isEdit ? "Modifier l'action" : "Nouvelle action"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-4)", fontSize: 18 }}>
            ✕
          </button>
        </div>

        {/* Section 1: Type pills */}
        <div style={mb14}>
          <label style={lbl}>Type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ACTION_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                style={type === t.value ? pillActive : pillBase}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Common fields */}
        <div style={mb14}>
          <label style={lbl}>Titre *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="ex: Appel de suivi avec Jean Dupont" style={inp} autoFocus />
        </div>

        <div style={mb14}>
          <label style={lbl}>Priorite</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div style={mb14}>
          <label style={lbl}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} placeholder="Details de l'action..." style={{ ...inp, resize: "vertical" }} />
        </div>

        {/* Section 3: Date fields — masqué pour meeting/call (qui ont start_datetime) */}
        {!["meeting", "call"].includes(type) && (
          <>
            <div style={mb14}>
              <label style={lbl}>Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
            </div>

            <div style={{ ...mb14, display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)}
                  style={{ accentColor: "var(--su-500)" }} />
                Toute la journee
              </label>
              {!isAllDay && (
                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ ...inp, width: 130 }} />
              )}
            </div>
          </>
        )}

        {/* Meeting/Call specific */}
        {showMeetingFields && (
          <>
            <div style={mb14}>
              <label style={lbl}>Debut (date et heure)</label>
              <input type="datetime-local" value={startDatetime}
                onChange={e => setStartDatetime(e.target.value)} style={inp} />
            </div>
            <div style={mb14}>
              <label style={lbl}>Duree</label>
              <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} style={inp}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </>
        )}

        {type === "meeting" && (
          <>
            <div style={mb14}>
              <label style={lbl}>Lieu</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Bureau, restaurant..." style={inp} />
            </div>
            <div style={mb14}>
              <label style={lbl}>Lien Meet / Zoom</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" value={meetLink} onChange={e => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/..." style={{ ...inp, flex: 1 }} />
                <button type="button" onClick={handleGenerateMeet} disabled={generatingMeet}
                  style={{ ...btnSmall, whiteSpace: "nowrap", opacity: generatingMeet ? 0.6 : 1 }}>
                  {generatingMeet ? "..." : "\uD83D\uDD17 Meet"}
                </button>
              </div>
            </div>
          </>
        )}

        {type === "call" && (
          <div style={mb14}>
            <label style={lbl}>Numero de telephone</label>
            <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+33 6 ..." style={inp} />
          </div>
        )}

        {type === "email" && (
          <>
            <div style={mb14}>
              <label style={lbl}>Direction</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: "sent", l: "Envoye" }, { v: "received", l: "Recu" }].map(d => (
                  <button key={d.v} type="button" onClick={() => setEmailDirection(d.v)}
                    style={emailDirection === d.v ? pillActive : pillBase}>
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={mb14}>
              <label style={lbl}>Objet</label>
              <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                placeholder="Objet de l'email" style={inp} />
            </div>
          </>
        )}

        {/* Section 4: Participants (contacts) — for meeting & call */}
        {showParticipants && (
          <div style={{ ...mb14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <label style={lbl}>Participants</label>
            {participants.map(p => (
              <div key={p.contact_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={chipStyle}>{p.name}</span>
                <input type="text" placeholder="Role (vendeur, avocat...)" value={p.role}
                  onChange={e => setParticipants(prev => prev.map(pp => pp.contact_id === p.contact_id ? { ...pp, role: e.target.value } : pp))}
                  style={{ ...inp, width: 150, padding: "4px 8px", fontSize: 12 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)", cursor: "pointer" }}>
                  <input type="checkbox" checked={p.attended}
                    onChange={e => setParticipants(prev => prev.map(pp => pp.contact_id === p.contact_id ? { ...pp, attended: e.target.checked } : pp))}
                    style={{ accentColor: "var(--su-500)" }} />
                  Present
                </label>
                <button type="button" onClick={() => removeParticipant(p.contact_id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", fontSize: 14 }}>
                  ×
                </button>
              </div>
            ))}
            <div style={{ position: "relative" }}>
              <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                placeholder="+ Ajouter un participant..." style={{ ...inp, fontSize: 12.5 }} />
              {filteredContacts.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                  maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                  {filteredContacts.map(c => (
                    <button key={c.id} type="button" onClick={() => addParticipant(c)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                        border: "none", background: "transparent", cursor: "pointer",
                        fontSize: 13, color: "var(--text-2)", fontFamily: "inherit" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      {c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 4b: Linked organizations */}
        <div style={{ ...mb14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <label style={lbl}>Organisations</label>
          {linkedOrgs.map(o => (
            <div key={o.organization_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={chipStyle}>{o.name}</span>
              <input type="text" placeholder="Role (banque, acquéreur...)" value={o.role}
                onChange={e => setLinkedOrgs(prev => prev.map(oo => oo.organization_id === o.organization_id ? { ...oo, role: e.target.value } : oo))}
                style={{ ...inp, width: 160, padding: "4px 8px", fontSize: 12 }} />
              <button type="button" onClick={() => removeLinkedOrg(o.organization_id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", fontSize: 14 }}>
                ×
              </button>
            </div>
          ))}
          <div style={{ position: "relative" }}>
            <input type="text" value={orgSearch} onChange={e => setOrgSearch(e.target.value)}
              placeholder="+ Ajouter une organisation..." style={{ ...inp, fontSize: 12.5 }} />
            {filteredOrgs.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                {filteredOrgs.map(o => (
                  <button key={o.id} type="button" onClick={() => addLinkedOrg(o)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                      border: "none", background: "transparent", cursor: "pointer",
                      fontSize: 13, color: "var(--text-2)", fontFamily: "inherit" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 4c: Lien / Document (tous types) */}
        <div style={mb14}>
          <label style={lbl}>Lien / Document (optionnel)</label>
          <input
            type="url"
            value={documentUrl}
            onChange={e => setDocumentUrl(e.target.value)}
            placeholder="https://drive.google.com/... ou lien externe"
            style={inp}
          />
        </div>

        {/* Section 5: Context links */}
        {!context?.deal_id && (
          <div style={mb14}>
            <label style={lbl}>Dossier (ID)</label>
            <input type="text" value={dealId} onChange={e => setDealId(e.target.value)}
              placeholder="UUID du dossier" style={inp} />
          </div>
        )}
        {!context?.mandate_id && (
          <div style={mb14}>
            <label style={lbl}>Mandat (ID)</label>
            <input type="text" value={mandateId} onChange={e => setMandateId(e.target.value)}
              placeholder="UUID du mandat" style={inp} />
          </div>
        )}

        {/* AI Summary — for completed meeting/call */}
        {isEdit && (type === "meeting" || type === "call") && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Resume IA</label>
              <button type="button" onClick={handleGenerateAI} disabled={generatingAI}
                style={{ ...btnSmall, opacity: generatingAI ? 0.6 : 1 }}>
                {generatingAI ? "Generation..." : summaryAI ? "\uD83D\uDD04 Regenerer" : "\u2728 Generer resume IA"}
              </button>
            </div>
            {summaryAI && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--surface-3)",
                fontSize: 12.5, color: "var(--text-2)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {summaryAI}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-5)", fontStyle: "italic" }}>
                  Genere par Claude
                </div>
              </div>
            )}
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
