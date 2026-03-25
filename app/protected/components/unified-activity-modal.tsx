"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Search } from "lucide-react";
import { unifiedActivityTypeLabels } from "@/lib/crm/labels";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UnifiedActivityFormData {
  title: string;
  summary?: string;
  activityType: string;
  status: "open" | "done" | "cancelled";
  dueDate?: string;
  dueTime?: string;
  reminderDate?: string;
  location?: string;
  dealId?: string;
  contactId?: string;
  organizationId?: string;
  organizationIds?: string[];
  participantContactIds?: string[];
  isAllDay?: boolean;
}

interface Deal   { id: string; name: string }
interface Org    { id: string; name: string }
interface ContactItem { contactId: string; firstName: string; lastName: string; email?: string }

interface UnifiedActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: UnifiedActivityFormData) => Promise<boolean>;
  /** Pré-sélectionne et verrouille le dossier */
  dealId?: string;
  contactId?: string;
  organizationId?: string;
  defaultType?: string;
  mode?: "create" | "edit";
  editingActivity?: any;
  /** @deprecated — le modal charge ses propres orgs */
  organisations?: { id: string; name: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_CATEGORIES: Record<string, string[]> = {
  "Tasks":         ["todo", "follow_up"],
  "Communication": ["call", "meeting", "email_sent", "email_received", "intro"],
  "Documents":     ["deck_sent", "nda", "document_sent"],
  "Événements":    ["deadline", "delivery", "closing"],
  "Recrutement":   ["recruitment_interview", "recruitment_feedback", "recruitment_task"],
  "Advisory":      ["cfo_advisory", "investor_meeting", "due_diligence"],
  "Notes":         ["note", "other"],
};

const TIME_OPTIONS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00",
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Component ────────────────────────────────────────────────────────────────

export function UnifiedActivityModal({
  isOpen,
  onClose,
  onSave,
  dealId: dealIdProp,
  contactId,
  organizationId,
  defaultType = "meeting",
  mode = "create",
  editingActivity,
}: UnifiedActivityModalProps) {

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState<UnifiedActivityFormData>({
    title: "",
    summary: "",
    activityType: defaultType,
    status: "open",
    dueDate: addDays(0),
    dueTime: "10:00",
    location: "",
    dealId: dealIdProp,
    contactId,
    organizationId,
    organizationIds: organizationId ? [organizationId] : [],
    participantContactIds: contactId ? [contactId] : [],
    isAllDay: false,
  });
  const [saving, setSaving] = useState(false);

  // ── Remote data ─────────────────────────────────────────────────────────
  const [deals,       setDeals]       = useState<Deal[]>([]);
  const [orgs,        setOrgs]        = useState<Org[]>([]);
  const [orgContacts, setOrgContacts] = useState<ContactItem[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [globalContacts, setGlobalContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load deals + orgs once when modal opens ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/deals/list").then(r => r.json()).then(d => setDeals(d.deals ?? []));
    fetch("/api/organisations").then(r => r.json()).then(d => setOrgs(d.organisations ?? []));
  }, [isOpen]);

  // ── Init form on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && editingActivity) {
      setForm({
        title:                editingActivity.title || "",
        summary:              editingActivity.summary || "",
        activityType:         editingActivity.activity_type || defaultType,
        status:               editingActivity.task_status || "open",
        dueDate:              editingActivity.due_date || addDays(0),
        dueTime:              editingActivity.due_time || "10:00",
        location:             editingActivity.location || "",
        dealId:               editingActivity.deal_id || dealIdProp,
        contactId:            editingActivity.contact_id || contactId,
        organizationId:       editingActivity.organization_id || organizationId,
        organizationIds:      editingActivity.organization_ids ||
                              (editingActivity.organization_id ? [editingActivity.organization_id] : []),
        participantContactIds: editingActivity.participants?.map((p: any) => p.id) || [],
        isAllDay:             editingActivity.is_all_day || false,
      });
    } else {
      setForm({
        title: "", summary: "", activityType: defaultType, status: "open",
        dueDate: addDays(0), dueTime: "10:00", location: "",
        dealId: dealIdProp, contactId, organizationId,
        organizationIds: organizationId ? [organizationId] : [],
        participantContactIds: contactId ? [contactId] : [],
        isAllDay: false,
      });
      setContactSearch("");
      setGlobalContacts([]);
    }
  }, [isOpen, mode, editingActivity, dealIdProp, contactId, organizationId, defaultType]);

  // ── Fetch contacts when org changes ────────────────────────────────────
  const selectedOrgId = form.organizationIds?.[0] || null;
  useEffect(() => {
    if (!selectedOrgId) { setOrgContacts([]); return; }
    setLoadingContacts(true);
    fetch(`/api/search/contacts-by-org?org_id=${selectedOrgId}&query=${encodeURIComponent(contactSearch || "")}`)
      .then(r => r.json())
      .then(d => setOrgContacts(d.contacts ?? []))
      .catch(() => setOrgContacts([]))
      .finally(() => setLoadingContacts(false));
  }, [selectedOrgId, contactSearch]);

  // ── Fallback global contact search (no org selected) ───────────────────
  useEffect(() => {
    if (selectedOrgId || contactSearch.length < 2) { setGlobalContacts([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(contactSearch)}`)
        .then(r => r.json())
        .then(d => setGlobalContacts(
          (d.contacts ?? []).map((c: any) => ({
            contactId:  c.id,
            firstName:  c.name?.split(" ")[0] || "",
            lastName:   c.name?.split(" ").slice(1).join(" ") || "",
            email:      c.sub,
          }))
        ));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [selectedOrgId, contactSearch]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const set = (field: keyof UnifiedActivityFormData) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const setV = (field: keyof UnifiedActivityFormData, value: any) =>
    setForm(p => ({ ...p, [field]: value }));

  const toggleContact = (contactId: string) => {
    const cur = form.participantContactIds ?? [];
    const next = cur.includes(contactId)
      ? cur.filter(id => id !== contactId)
      : [...cur, contactId];
    setForm(p => ({
      ...p,
      participantContactIds: next,
      contactId: next[0] ?? undefined,
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const success = await onSave(form);
    setSaving(false);
    if (success) onClose();
  };

  if (!isOpen) return null;

  // ── Derived ──────────────────────────────────────────────────────────────
  const hasDateTime    = ["deadline","delivery","closing","meeting","call","recruitment_interview","follow_up"].includes(form.activityType);
  const hasDescription = ["note","todo","cfo_advisory","other","follow_up","email_sent","email_received"].includes(form.activityType);
  const hasLocation    = ["meeting","call","recruitment_interview"].includes(form.activityType);
  const displayedContacts = selectedOrgId ? orgContacts : globalContacts;

  // ── Styles ───────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width:"100%", padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)",
    fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box",
  };
  const lbl: React.CSSProperties = {
    display:"block", fontSize:"11px", fontWeight:700, color:"var(--text-4)",
    marginBottom:5, textTransform:"uppercase", letterSpacing:".05em",
  };
  const section = (mb = 14): React.CSSProperties => ({ marginBottom: mb });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:400,
               display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16,
                 padding:24, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>
            {mode === "edit" ? "Modifier l'activité" : "Nouvelle activité"}
          </span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--text-4)" }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Type ── */}
        <div style={section()}>
          <label style={lbl}>Type</label>
          <select value={form.activityType} onChange={set("activityType")} style={inp}>
            {Object.entries(ACTIVITY_CATEGORIES).map(([cat, types]) => (
              <optgroup key={cat} label={cat}>
                {types.map(t => (
                  <option key={t} value={t}>{unifiedActivityTypeLabels[t] || t}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* ── Titre ── */}
        <div style={section()}>
          <label style={lbl}>Titre *</label>
          <input
            type="text"
            placeholder="ex: Appel de suivi avec Jean Dupont"
            value={form.title}
            onChange={set("title")}
            style={inp}
            autoFocus
          />
        </div>

        {/* ── Dossier (seulement si non verrouillé par prop) ── */}
        {!dealIdProp && (
          <div style={section()}>
            <label style={lbl}>Dossier</label>
            <select value={form.dealId || ""} onChange={set("dealId")} style={inp}>
              <option value="">— Aucun dossier</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Organisation ── */}
        <div style={section()}>
          <label style={lbl}>Organisation</label>
          <select
            value={form.organizationIds?.[0] || ""}
            onChange={e => {
              const id = e.target.value;
              setV("organizationIds", id ? [id] : []);
              setV("organizationId", id || undefined);
              setContactSearch("");
              // Reset contacts quand on change d'org
              setForm(p => ({ ...p, participantContactIds: [], contactId: undefined,
                organizationIds: id ? [id] : [], organizationId: id || undefined }));
            }}
            style={inp}
          >
            <option value="">— Aucune organisation</option>
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* ── Contacts (filtrés par org ou recherche globale) ── */}
        <div style={section()}>
          <label style={lbl}>
            Contacts
            {form.participantContactIds?.length ? (
              <span style={{ marginLeft:6, fontWeight:400, color:"var(--su-500)" }}>
                ({form.participantContactIds.length} sélectionné{form.participantContactIds.length > 1 ? "s" : ""})
              </span>
            ) : null}
          </label>

          {/* Search input */}
          <div style={{ position:"relative", marginBottom:6 }}>
            <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }} />
            <input
              type="text"
              placeholder={selectedOrgId ? "Filtrer les contacts de l'org…" : "Chercher un contact (min 2 car.)…"}
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              style={{ ...inp, paddingLeft:32 }}
            />
          </div>

          {/* Contact list */}
          {(displayedContacts.length > 0 || loadingContacts) && (
            <div style={{ border:"1px solid var(--border)", borderRadius:8, maxHeight:180, overflowY:"auto", background:"var(--surface-2)" }}>
              {loadingContacts ? (
                <div style={{ padding:"12px 14px", color:"var(--text-5)", fontSize:12.5 }}>Chargement…</div>
              ) : (
                displayedContacts.map(c => {
                  const selected = (form.participantContactIds ?? []).includes(c.contactId);
                  return (
                    <div
                      key={c.contactId}
                      onClick={() => toggleContact(c.contactId)}
                      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 12px",
                               borderBottom:"1px solid var(--border)", cursor:"pointer",
                               background: selected ? "rgba(var(--su-500-rgb),.1)" : "transparent" }}
                    >
                      <input type="checkbox" checked={selected} onChange={() => {}}
                             style={{ cursor:"pointer", accentColor:"var(--su-500)", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:selected ? 600 : 400, color:"var(--text-1)" }}>
                          {c.firstName} {c.lastName}
                        </div>
                        {c.email && (
                          <div style={{ fontSize:11, color:"var(--text-5)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {c.email}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Selected contact chips */}
          {(form.participantContactIds ?? []).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
              {(form.participantContactIds ?? []).map(id => {
                const c = [...orgContacts, ...globalContacts].find(x => x.contactId === id);
                if (!c) return null;
                return (
                  <span key={id} style={{ display:"inline-flex", alignItems:"center", gap:5,
                    padding:"3px 8px", background:"var(--su-500)", color:"#fff",
                    borderRadius:5, fontSize:11.5, fontWeight:500 }}>
                    {c.firstName} {c.lastName}
                    <button onClick={() => toggleContact(id)}
                      style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", padding:0, lineHeight:1, fontSize:14 }}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Date & Heure ── */}
        {hasDateTime && (
          <div style={section()}>
            <label style={lbl}>Date</label>
            <input type="date" value={form.dueDate || ""} onChange={set("dueDate")} style={inp} />

            {/* Quick date buttons */}
            <div style={{ display:"flex", gap:5, marginTop:6, marginBottom:6, flexWrap:"wrap" }}>
              {[{ label:"Auj.", days:0 }, { label:"+1j", days:1 }, { label:"+7j", days:7 }, { label:"+30j", days:30 }].map(({ label, days }) => {
                const target = addDays(days);
                const active = form.dueDate === target;
                return (
                  <button key={label} onClick={() => setV("dueDate", target)}
                    style={{ padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:500, cursor:"pointer",
                      border:`1px solid ${active ? "var(--su-500)" : "var(--border)"}`,
                      background: active ? "var(--su-500)" : "var(--surface-2)",
                      color: active ? "#fff" : "var(--text-3)" }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {!form.isAllDay && (
              <select value={form.dueTime || "10:00"} onChange={set("dueTime")} style={{ ...inp, marginTop:4 }}>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            <label style={{ display:"flex", alignItems:"center", gap:7, fontSize:12.5, marginTop:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.isAllDay || false}
                     onChange={e => setV("isAllDay", e.target.checked)} style={{ cursor:"pointer" }} />
              Journée complète
            </label>
          </div>
        )}

        {/* ── Lieu ── */}
        {hasLocation && (
          <div style={section()}>
            <label style={lbl}>Lieu</label>
            <input type="text" placeholder="Salle de réunion, Zoom, adresse…"
                   value={form.location || ""} onChange={set("location")} style={inp} />
          </div>
        )}

        {/* ── Description ── */}
        {hasDescription && (
          <div style={section()}>
            <label style={lbl}>Description</label>
            <textarea
              placeholder="Détails, notes…"
              value={form.summary || ""}
              onChange={set("summary")}
              style={{ ...inp, minHeight:72, resize:"vertical" } as React.CSSProperties}
            />
          </div>
        )}

        {/* ── Statut ── */}
        <div style={section(20)}>
          <label style={lbl}>Statut</label>
          <select value={form.status} onChange={set("status")} style={inp}>
            <option value="open">Ouverte</option>
            <option value="done">Terminée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </div>

        {/* ── Actions ── */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose}
            style={{ padding:"8px 18px", borderRadius:8, border:"1px solid var(--border)",
                     background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            style={{ padding:"8px 18px", borderRadius:8, background:"var(--su-500)", color:"#fff",
                     border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
                     opacity: !form.title.trim() || saving ? 0.5 : 1 }}>
            {saving ? "Enregistrement…" : mode === "edit" ? "Mettre à jour" : "Créer"}
          </button>
        </div>

      </div>
    </div>
  );
}
