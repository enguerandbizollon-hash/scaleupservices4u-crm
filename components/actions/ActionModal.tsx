"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createAction, updateAction, generateMeetLinkAction, generateActionSummaryAction, type ActionRow } from "@/actions/actions";
import { getAllContactsSimple } from "@/actions/contacts";
import { getAllOrganisationsSimple } from "@/actions/organisations";
import { getAllDealsSimple } from "@/actions/deals";
import { getAllCandidatesSimple } from "@/actions/candidates";

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
    candidate_id?: string;
  };
}

type ContactOption = { id: string; first_name: string; last_name: string; email: string | null };
type OrgOption = { id: string; name: string };
type DealOption = { id: string; name: string };
type CandidateOption = { id: string; first_name: string; last_name: string; email: string | null };

interface Participant { contact_id: string; name: string; role: string; attended: boolean }
interface LinkedOrg { organization_id: string; name: string; role: string }

const ACTION_TYPES = [
  { value: "task", label: "Tache", icon: "\uD83D\uDCCB" },
  { value: "call", label: "Appel", icon: "\uD83D\uDCDE" },
  { value: "meeting", label: "Meeting", icon: "\uD83E\uDD1D" },
  { value: "interview", label: "Entretien", icon: "\uD83D\uDC65" },
  { value: "technical_test", label: "Test technique", icon: "\uD83E\uDDEA" },
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

const STATUS_OPTIONS = [
  { value: "open", label: "Ouvert" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Termine" },
  { value: "cancelled", label: "Annule" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// Reminders : options en jours avant échéance
const REMINDER_DAY_OPTIONS = [0, 1, 3, 7, 14, 30];

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
  const [status, setStatus] = useState("open");
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
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState<string[]>([]);
  const [emailCc, setEmailCc] = useState<string[]>([]);
  const [emailToInput, setEmailToInput] = useState("");
  const [emailCcInput, setEmailCcInput] = useState("");
  const [gmailThreadId, setGmailThreadId] = useState("");
  const [agendaNotes, setAgendaNotes] = useState("");
  const [reminderDays, setReminderDays] = useState<number[]>([]);
  const [documentUrl, setDocumentUrl] = useState("");
  const [dealId, setDealId] = useState(context?.deal_id || "");
  const [organizationId, setOrganizationId] = useState(context?.organization_id || "");
  const [candidateId, setCandidateId] = useState(context?.candidate_id || "");

  // Accordéon "Détails" — fermé par défaut
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Dossier (deal) autocomplete
  const [dealOptions, setDealOptions] = useState<DealOption[]>([]);
  const [dealSearch, setDealSearch] = useState("");
  const [dealSearchFocused, setDealSearchFocused] = useState(false);

  // Candidat autocomplete
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSearchFocused, setCandidateSearchFocused] = useState(false);

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

  // Load contacts + orgs + deals + candidates lists
  const loadOptions = useCallback(async () => {
    const [contacts, orgs, deals, candidates] = await Promise.all([
      getAllContactsSimple(),
      getAllOrganisationsSimple(),
      getAllDealsSimple(),
      getAllCandidatesSimple(),
    ]);
    setContactOptions(contacts);
    setOrgOptions(orgs);
    setDealOptions(deals);
    setCandidateOptions(candidates);
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
      setStatus(editingAction.status || "open");
      setPriority(editingAction.priority || "medium");
      setDescription(editingAction.description || "");
      // En édition : pas de fallback vers "aujourd'hui" / "10:00" pour
      // ne pas écraser silencieusement la valeur réelle stockée en DB.
      setDueDate(editingAction.due_date ?? "");
      setDueTime(editingAction.due_time ?? "");
      setIsAllDay(editingAction.is_all_day);
      // <input type="datetime-local"> attend YYYY-MM-DDTHH:mm (16 chars).
      // Si la DB renvoie un ISO avec secondes ou timezone, le navigateur
      // rejette la valeur et le champ apparaît vide à l'ouverture.
      setStartDatetime(editingAction.start_datetime ? editingAction.start_datetime.slice(0, 16) : "");
      setDurationMinutes(editingAction.duration_minutes || 60);
      setLocation(editingAction.location || "");
      setMeetLink(editingAction.meet_link || "");
      setPhoneNumber(editingAction.phone_number || "");
      setEmailDirection(editingAction.email_direction || "sent");
      setEmailSubject(editingAction.email_subject || "");
      setEmailFrom(editingAction.email_from || "");
      setEmailTo(editingAction.email_to ?? []);
      setEmailCc(editingAction.email_cc ?? []);
      setEmailToInput("");
      setEmailCcInput("");
      setGmailThreadId(editingAction.gmail_thread_id || "");
      setAgendaNotes(editingAction.agenda_notes || "");
      setReminderDays([]); // reminder_days n'est pas dans ActionRow; reload à implémenter si besoin
      setDocumentUrl(editingAction.document_url || "");
      setDealId(editingAction.deal_id || "");
      setOrganizationId(editingAction.organization_id || "");
      setCandidateId(editingAction.candidate_id || "");
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
      setStatus("open");
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
      setEmailFrom("");
      setEmailTo([]);
      setEmailCc([]);
      setEmailToInput("");
      setEmailCcInput("");
      setGmailThreadId("");
      setAgendaNotes("");
      setReminderDays([]);
      setDocumentUrl("");
      setDealId(context?.deal_id || "");
      setOrganizationId(context?.organization_id || "");
      setCandidateId(context?.candidate_id || "");
      setParticipants([]);
      setLinkedOrgs([]);
      setSummaryAI(null);
    }
    setContactSearch("");
    setOrgSearch("");
    setDealSearch("");
    setDealSearchFocused(false);
    setCandidateSearch("");
    setCandidateSearchFocused(false);
    setDetailsOpen(false);
    setError("");
  }, [open, isEdit, editingAction, defaultType, context]);

  // Pré-remplir participants depuis context.contact_id en mode création,
  // dès que contactOptions est chargé.
  useEffect(() => {
    if (!open || isEdit) return;
    if (!context?.contact_id) return;
    if (!contactOptions.length) return;
    const c = contactOptions.find(opt => opt.id === context.contact_id);
    if (!c) return;
    setParticipants(prev => {
      if (prev.some(p => p.contact_id === c.id)) return prev;
      return [...prev, { contact_id: c.id, name: `${c.first_name} ${c.last_name}`, role: "", attended: true }];
    });
  }, [open, isEdit, context?.contact_id, contactOptions]);

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
    // Passer la date, la durée et le titre du meeting en cours pour
    // que l'événement GCal temporaire (qui sert à récupérer le lien
    // Meet) soit posé au bon moment et porte le bon nom.
    const res = await generateMeetLinkAction(
      startDatetime || undefined,
      durationMinutes,
      title.trim() || undefined,
    );
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

  function selectDeal(d: DealOption) {
    setDealId(d.id);
    setDealSearch(d.name);
    setDealSearchFocused(false);
  }

  function clearDeal() {
    setDealId("");
    setDealSearch("");
  }

  function selectCandidate(c: CandidateOption) {
    setCandidateId(c.id);
    setCandidateSearch(`${c.first_name} ${c.last_name}`);
    setCandidateSearchFocused(false);
  }

  function clearCandidate() {
    setCandidateId("");
    setCandidateSearch("");
  }

  function toggleReminder(days: number) {
    setReminderDays(prev => prev.includes(days) ? prev.filter(d => d !== days) : [...prev, days].sort((a, b) => a - b));
  }

  // Tags-input pour destinataires email : ajoute le contenu courant
  // au tableau quand l'utilisateur tape Entrée, virgule ou Tab.
  function commitEmailTag(
    raw: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
  ) {
    const value = raw.trim().replace(/[,;]+$/, "");
    if (!value) { setInput(""); return; }
    if (!list.includes(value)) setList([...list, value]);
    setInput("");
  }

  function removeEmailTag(value: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter(v => v !== value));
  }

  const handleSave = async () => {
    if (!title.trim()) { setError("Le titre est requis"); return; }
    setSaving(true);
    setError("");

    const payload = {
      type,
      title: title.trim(),
      status,
      priority,
      description: description || undefined,
      due_date: dueDate || undefined,
      due_time: !isAllDay ? dueTime : undefined,
      is_all_day: isAllDay,
      start_datetime: isScheduledType && startDatetime ? startDatetime : undefined,
      duration_minutes: isScheduledType ? durationMinutes : undefined,
      location: (type === "meeting" || type === "interview" || type === "technical_test") ? location || undefined : undefined,
      meet_link: (type === "meeting" || type === "interview" || type === "technical_test") ? meetLink || undefined : undefined,
      phone_number: type === "call" ? phoneNumber || undefined : undefined,
      email_direction: type === "email" ? emailDirection : undefined,
      email_subject: type === "email" ? emailSubject || undefined : undefined,
      email_from: type === "email" ? emailFrom.trim() || undefined : undefined,
      email_to: type === "email" && emailTo.length > 0 ? emailTo : undefined,
      email_cc: type === "email" && emailCc.length > 0 ? emailCc : undefined,
      gmail_thread_id: type === "email" ? gmailThreadId || undefined : undefined,
      agenda_notes: (type === "meeting" || type === "interview" || type === "technical_test") ? agendaNotes || undefined : undefined,
      reminder_days: reminderDays.length > 0 ? reminderDays : undefined,
      document_url: documentUrl.trim() || undefined,
      deal_id: dealId || undefined,
      organization_id: organizationId || undefined,
      candidate_id: candidateId || undefined,
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
    ...pillBase, background: "var(--su-500)", color: "#fff", border: "1px solid var(--su-500)",
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

  const isScheduledType = type === "meeting" || type === "call" || type === "interview" || type === "technical_test";
  const showMeetingFields = isScheduledType;
  const showParticipants = isScheduledType;
  // Le sélecteur candidat n'apparaît que pour les types liés au recrutement
  // (interview, technical_test, call). Toujours visible si un candidat
  // est déjà rattaché en édition ou via context.
  const showCandidatePicker =
    type === "interview" || type === "technical_test" || type === "call" ||
    !!candidateId;

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

  const filteredDeals = dealSearch.trim()
    ? dealOptions.filter(d => d.name.toLowerCase().includes(dealSearch.toLowerCase())).slice(0, 8)
    : dealOptions.slice(0, 8);

  const filteredCandidates = candidateSearch.trim()
    ? candidateOptions.filter(c => {
        const q = candidateSearch.toLowerCase();
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
          || (c.email ?? "").toLowerCase().includes(q);
      }).slice(0, 8)
    : candidateOptions.slice(0, 8);

  const selectedDealName = dealId
    ? (dealOptions.find(d => d.id === dealId)?.name ?? "")
    : "";

  const selectedCandidate = candidateId
    ? candidateOptions.find(c => c.id === candidateId)
    : undefined;
  const selectedCandidateName = selectedCandidate
    ? `${selectedCandidate.first_name} ${selectedCandidate.last_name}`
    : "";

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

        {/* ═══ NIVEAU 1 — champs essentiels ═══ */}

        {/* Titre */}
        <div style={mb14}>
          <label style={lbl}>Titre *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="ex: Appel de suivi avec Jean Dupont" style={inp} autoFocus />
        </div>

        {/* Statut + Priorité (2 colonnes) */}
        <div style={{ ...mb14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Priorite</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Date/heure — selon type */}
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

        {/* Candidat lié — autocomplete (interview / technical_test / call recrutement) */}
        {!context?.candidate_id && showCandidatePicker && (
          <div style={mb14}>
            <label style={lbl}>Candidat lie</label>
            {candidateId && selectedCandidateName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...chipStyle, flex: 1 }}>{selectedCandidateName}</span>
                <button type="button" onClick={clearCandidate}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--text-4)", fontSize: 12, fontFamily: "inherit" }}>
                  Retirer
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input type="text" value={candidateSearch}
                  onChange={e => { setCandidateSearch(e.target.value); setCandidateSearchFocused(true); }}
                  onFocus={() => setCandidateSearchFocused(true)}
                  onBlur={() => setTimeout(() => setCandidateSearchFocused(false), 150)}
                  placeholder="Rechercher un candidat..." style={inp} />
                {candidateSearchFocused && filteredCandidates.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                    maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                    {filteredCandidates.map(c => (
                      <button key={c.id} type="button" onClick={() => selectCandidate(c)}
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
            )}
          </div>
        )}

        {/* Dossier lié (optionnel) — autocomplete */}
        {!context?.deal_id && (
          <div style={mb14}>
            <label style={lbl}>Dossier lie (optionnel)</label>
            {dealId && selectedDealName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...chipStyle, flex: 1 }}>{selectedDealName}</span>
                <button type="button" onClick={clearDeal}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--text-4)", fontSize: 12, fontFamily: "inherit" }}>
                  Retirer
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input type="text" value={dealSearch}
                  onChange={e => { setDealSearch(e.target.value); setDealSearchFocused(true); }}
                  onFocus={() => setDealSearchFocused(true)}
                  onBlur={() => setTimeout(() => setDealSearchFocused(false), 150)}
                  placeholder="— Action libre, sans dossier —" style={inp} />
                {dealSearchFocused && filteredDeals.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                    maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                    {filteredDeals.map(d => (
                      <button key={d.id} type="button" onClick={() => selectDeal(d)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                          border: "none", background: "transparent", cursor: "pointer",
                          fontSize: 13, color: "var(--text-2)", fontFamily: "inherit" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ NIVEAU 2 — Accordéon "Détails" ═══ */}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, marginBottom: 14, paddingTop: 10 }}>
          <button type="button" onClick={() => setDetailsOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em", padding: 0 }}>
            <span style={{ fontSize: 14 }}>{detailsOpen ? "▾" : "▸"}</span>
            Details
          </button>
        </div>

        {detailsOpen && (
          <>
            {/* Description */}
            <div style={mb14}>
              <label style={lbl}>Description / Notes</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder="Details de l'action..." style={{ ...inp, resize: "vertical" }} />
            </div>

            {/* Champs spécifiques meeting / interview / technical_test */}
            {(type === "meeting" || type === "interview" || type === "technical_test") && (
              <>
                <div style={mb14}>
                  <label style={lbl}>Lieu</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                    placeholder={type === "technical_test" ? "Bureau, plateforme en ligne..." : "Bureau, restaurant..."} style={inp} />
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
                <div style={mb14}>
                  <label style={lbl}>{type === "technical_test" ? "Consignes / Sujet" : "Ordre du jour"}</label>
                  <textarea value={agendaNotes} onChange={e => setAgendaNotes(e.target.value)}
                    rows={2} placeholder={type === "technical_test" ? "Exercice, livrables attendus..." : "Sujets a aborder..."} style={{ ...inp, resize: "vertical" }} />
                </div>
              </>
            )}

            {/* Champs spécifiques call */}
            {type === "call" && (
              <div style={mb14}>
                <label style={lbl}>Numero de telephone</label>
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+33 6 ..." style={inp} />
              </div>
            )}

            {/* Champs spécifiques email */}
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
                  <label style={lbl}>De / Expediteur</label>
                  <input type="email" value={emailFrom} onChange={e => setEmailFrom(e.target.value)}
                    placeholder="contact@example.com" style={inp} />
                </div>
                <div style={mb14}>
                  <label style={lbl}>A (destinataires)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: emailTo.length > 0 ? 6 : 0 }}>
                    {emailTo.map(v => (
                      <span key={v} style={chipStyle}>
                        {v}
                        <button type="button" onClick={() => removeEmailTag(v, emailTo, setEmailTo)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", fontSize: 13, padding: 0, marginLeft: 2 }}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input type="email" value={emailToInput}
                    onChange={e => setEmailToInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
                        if (emailToInput.trim()) {
                          e.preventDefault();
                          commitEmailTag(emailToInput, emailTo, setEmailTo, setEmailToInput);
                        }
                      } else if (e.key === "Backspace" && !emailToInput && emailTo.length > 0) {
                        setEmailTo(emailTo.slice(0, -1));
                      }
                    }}
                    onBlur={() => emailToInput.trim() && commitEmailTag(emailToInput, emailTo, setEmailTo, setEmailToInput)}
                    placeholder="Ajouter un email puis Entree" style={inp} />
                </div>
                <div style={mb14}>
                  <label style={lbl}>Cc (optionnel)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: emailCc.length > 0 ? 6 : 0 }}>
                    {emailCc.map(v => (
                      <span key={v} style={chipStyle}>
                        {v}
                        <button type="button" onClick={() => removeEmailTag(v, emailCc, setEmailCc)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", fontSize: 13, padding: 0, marginLeft: 2 }}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input type="email" value={emailCcInput}
                    onChange={e => setEmailCcInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
                        if (emailCcInput.trim()) {
                          e.preventDefault();
                          commitEmailTag(emailCcInput, emailCc, setEmailCc, setEmailCcInput);
                        }
                      } else if (e.key === "Backspace" && !emailCcInput && emailCc.length > 0) {
                        setEmailCc(emailCc.slice(0, -1));
                      }
                    }}
                    onBlur={() => emailCcInput.trim() && commitEmailTag(emailCcInput, emailCc, setEmailCc, setEmailCcInput)}
                    placeholder="Ajouter un email puis Entree" style={inp} />
                </div>
                <div style={mb14}>
                  <label style={lbl}>Objet</label>
                  <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                    placeholder="Objet de l'email" style={inp} />
                </div>
                <div style={mb14}>
                  <label style={lbl}>Thread Gmail (ID)</label>
                  <input type="text" value={gmailThreadId} onChange={e => setGmailThreadId(e.target.value)}
                    placeholder="Optionnel — ID du thread Gmail" style={inp} />
                </div>
              </>
            )}

            {/* Participants (meeting/call) */}
            {showParticipants && (
              <div style={mb14}>
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

            {/* Organisations liées */}
            <div style={mb14}>
              <label style={lbl}>Organisations liees</label>
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

            {/* Lien / Document */}
            <div style={mb14}>
              <label style={lbl}>Lien / Document (optionnel)</label>
              <input type="url" value={documentUrl} onChange={e => setDocumentUrl(e.target.value)}
                placeholder="https://drive.google.com/... ou lien externe" style={inp} />
            </div>

            {/* Rappels (reminder_days) */}
            <div style={mb14}>
              <label style={lbl}>Rappels (jours avant l'echeance)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {REMINDER_DAY_OPTIONS.map(d => {
                  const active = reminderDays.includes(d);
                  return (
                    <button key={d} type="button" onClick={() => toggleReminder(d)}
                      style={active ? pillActive : pillBase}>
                      {d === 0 ? "Le jour J" : `J-${d}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* AI Summary — for completed meeting/call */}
        {isEdit && (type === "meeting" || type === "call" || type === "interview" || type === "technical_test") && (
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
