"use client";
import { useState } from "react";
import { X, Check, Trash2, Send, Mail, CalendarDays, ExternalLink } from "lucide-react";
import { TimeSelect } from "./time-select";

const TASK_TYPES = [
  { value:"todo",            label:"☑️ Tâche" },
  { value:"follow_up",      label:"🔔 Relance" },
  { value:"call",           label:"📞 Appel" },
  { value:"meeting",        label:"🤝 Réunion" },
  { value:"email_sent",     label:"✉️ Email envoyé" },
  { value:"email_received", label:"📩 Email reçu" },
  { value:"intro",          label:"👋 Introduction" },
  { value:"deck_sent",      label:"📊 Deck envoyé" },
  { value:"nda",            label:"📋 NDA" },
  { value:"note",           label:"📝 Note" },
  { value:"other",          label:"📌 Autre" },
];

const PRIO = [
  { value:"high",   label:"🔴 Haute" },
  { value:"medium", label:"🟡 Moyenne" },
  { value:"low",    label:"⚪ Basse" },
];

export interface TaskItem {
  id?: string;
  title: string;
  task_type: string;
  task_status: string;
  priority_level: string;
  due_date?: string | null;
  due_time?: string | null;
  summary?: string | null;
  description?: string | null;
  deal_id?: string | null;
  contact_ids?: string[];
  contact_names?: string[];
}

export interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  org_name?: string | null;
}

interface TaskModalProps {
  item?: TaskItem | null;
  contacts?: ContactOption[];
  dealId?: string | null;
  onClose: () => void;
  onSave?: (task: TaskItem) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, done: boolean) => void;
}


// ── Composant de sélection de contacts par organisation ──────────────
export function ContactPicker({ contacts, selected, onToggle }: {
  contacts: ContactOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [orgFilter, setOrgFilter] = useState("all");
  const [search, setSearch]       = useState("");

  // Extraire les orgs uniques
  const orgs = Array.from(new Set(contacts.map(c => c.org_name).filter(Boolean))) as string[];

  const filtered = contacts.filter(c => {
    const matchOrg = orgFilter === "all" || c.org_name === orgFilter;
    const matchSearch = !search ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase());
    return matchOrg && matchSearch;
  });

  const inp2: React.CSSProperties = { width:"100%", padding:"6px 10px", border:"1px solid var(--border)", borderRadius:7, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>
        Contacts associés
        {selected.length > 0 && <span style={{ marginLeft:6, fontWeight:700, color:"#1a56db" }}>{selected.length} sélectionné{selected.length>1?"s":""}</span>}
      </label>

      {contacts.length === 0 ? (
        <div style={{ fontSize:12.5, color:"var(--text-5)", padding:"8px 12px", background:"var(--surface-2)", borderRadius:8, border:"1px solid var(--border)" }}>
          Aucun contact disponible pour ce dossier.
        </div>
      ) : (
        <>
          {/* Filtres rapides */}
          <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
            {orgs.length > 1 && (
              <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
                style={{ ...inp2, flex:"none", width:"auto", fontSize:12 }}>
                <option value="all">Toutes les orgs</option>
                {orgs.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un contact…"
              style={{ ...inp2, flex:1, minWidth:140 }}/>
          </div>

          {/* Liste */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto", border:"1px solid var(--border)", borderRadius:8, padding:"6px 8px" }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize:12.5, color:"var(--text-5)", padding:"6px 4px" }}>Aucun résultat</div>
            ) : filtered.map(c => {
              const sel = selected.includes(c.id);
              return (
                <label key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:`1px solid ${sel?"#1a56db":"transparent"}`, background:sel?"rgba(26,86,219,.06)":"transparent", cursor:"pointer" }}>
                  <input type="checkbox" checked={sel} onChange={() => onToggle(c.id)} style={{ accentColor:"#1a56db", flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontSize:13, color:"var(--text-1)", fontWeight:600 }}>{c.first_name} {c.last_name}</span>
                    {c.org_name && <span style={{ fontSize:11.5, color:"var(--text-5)", marginLeft:6 }}>— {c.org_name}</span>}
                  </div>
                  {c.email && <span style={{ fontSize:11, color:"var(--text-5)", flexShrink:0 }}>✉️</span>}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function TaskModal({ item, contacts = [], dealId, onClose, onSave, onDelete, onToggle }: TaskModalProps) {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    title:          item?.title ?? "",
    task_type:      item?.task_type ?? "todo",
    priority_level: item?.priority_level ?? "medium",
    due_date:       item?.due_date ?? "",
    due_time:       item?.due_time ?? "",
    summary:        item?.summary ?? item?.description ?? "",
    contact_ids:    item?.contact_ids ?? [] as string[],
  });
  const [loading, setLoading]     = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalLink, setGcalLink]   = useState<string|null>(null);
  const [gcalError, setGcalError] = useState<string|null>(null);
  const [showMail, setShowMail]   = useState(false);
  const [mailMode, setMailMode]   = useState<"separate"|"grouped">("separate");

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  function toggleContact(id: string) {
    setForm(p => ({
      ...p,
      contact_ids: p.contact_ids.includes(id)
        ? p.contact_ids.filter(x => x !== id)
        : [...p.contact_ids, id],
    }));
  }

  const effectiveDealId = dealId ?? item?.deal_id;

  async function handleSave() {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      if (!effectiveDealId) {
        alert("Pour créer une tâche depuis le dashboard, ouvre d'abord un dossier et crée la tâche depuis la fiche dossier.");
        setLoading(false);
        return;
      }
      const method = item?.id ? "PATCH" : "POST";
      const body   = item?.id
        ? { task_id: item.id, ...form }
        : { ...form, deal_id: effectiveDealId };

      const res = await fetch(`/api/deals/${effectiveDealId}/tasks`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      onSave?.({ ...data, contact_ids: form.contact_ids });
      onClose();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!item?.id || !confirm("Supprimer cette tâche ?")) return;
    await fetch(`/api/deals/${effectiveDealId}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: item.id }),
    });
    onDelete?.(item.id);
    onClose();
  }

  async function handleToggle() {
    if (!item?.id) return;
    const done = item.task_status !== "done";
    await fetch(`/api/deals/${effectiveDealId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: item.id, task_status: done ? "done" : "open" }),
    });
    onToggle?.(item.id, done);
    onClose();
  }

  async function handleAddToGcal() {
    if (!form.title.trim() || !form.due_date) {
      alert("Titre et date requis pour ajouter à Google Calendar");
      return;
    }
    setGcalLoading(true);
    setGcalError(null);
    try {
      const chosenEmails = contacts
        .filter(c => form.contact_ids.includes(c.id) && c.email)
        .map(c => c.email!);

      const res = await fetch("/api/gcal/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:            form.title,
          date:             form.due_date,
          time:             form.due_time || "09:00",
          summary:          form.summary,
          attendee_emails:  chosenEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.connect_url) {
          // Google Calendar pas encore connecté
          if (confirm("Google Calendar n'est pas connecté. Connecter maintenant ?")) {
            window.location.href = data.connect_url;
          }
          return;
        }
        throw new Error(data.error || "Erreur Google Calendar");
      }
      setGcalLink(data.html_link);
    } catch(e: any) { setGcalError(e.message); }
    finally { setGcalLoading(false); }
  }

  function handleSendMail() {
    const chosen = contacts.filter(c => form.contact_ids.includes(c.id) && c.email);
    if (!chosen.length) return;
    const subject = encodeURIComponent(`[Action] ${form.title}`);
    const body    = encodeURIComponent(`Bonjour,\n\nJe reviens vers vous concernant : ${form.title}.\n\n${form.summary || ""}\n\nCordialement`);
    if (mailMode === "grouped") {
      window.open(`mailto:${chosen.map(c=>c.email).join(",")}?subject=${subject}&body=${body}`);
    } else {
      chosen.forEach((c,i) => setTimeout(() => window.open(`mailto:${c.email}?subject=${subject}&body=${body}`), i*400));
    }
    setShowMail(false);
  }

  const inp: React.CSSProperties = { width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const isDone = item?.task_status === "done";
  const chosenWithEmail = contacts.filter(c => form.contact_ids.includes(c.id) && c.email);

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:500, maxHeight:"92vh", overflowY:"auto" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {!isNew && (
              <button onClick={handleToggle}
                style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isDone?"#16a34a":"var(--border)"}`, background:isDone?"#16a34a":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {isDone && <Check size={12} color="#fff"/>}
              </button>
            )}
            <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>
              {isNew ? "Nouvelle tâche" : isDone ? "✅ Tâche terminée" : "Tâche"}
            </span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {!isNew && onDelete && (
              <button onClick={handleDelete}
                style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--rec-tx)" }}>
                <Trash2 size={13}/>
              </button>
            )}
            <button onClick={onClose}
              style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)" }}>
              <X size={14}/>
            </button>
          </div>
        </div>

        {/* ── Titre ── */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Titre *</label>
          <input style={inp} value={form.title} onChange={setF("title")} placeholder="Titre de la tâche ou de l'action…"/>
        </div>

        {/* ── Type + Priorité ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <div>
            <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Type</label>
            <select style={inp} value={form.task_type} onChange={setF("task_type")}>
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Priorité</label>
            <select style={inp} value={form.priority_level} onChange={setF("priority_level")}>
              {PRIO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Date + Heure ── */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Date & Heure</label>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{...inp, flex:2}} type="date" value={form.due_date} onChange={setF("due_date")}/>
            <TimeSelect value={form.due_time} onChange={v=>setForm(p=>({...p,due_time:v}))} style={{ flex:1 }}/>
          </div>
        </div>

        {/* ── Contacts avec recherche par org ── */}
        <ContactPicker contacts={contacts} selected={form.contact_ids} onToggle={toggleContact}/>

        {/* ── Notes ── */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Notes / Résumé</label>
          <textarea style={{...inp, height:72, resize:"vertical"}} value={form.summary} onChange={setF("summary")} placeholder="Contexte, suite à donner…"/>
        </div>

        {/* ── Panneau Mail ── */}
        {showMail && (
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:"#1d4ed8", marginBottom:10 }}>📧 Envoi email</div>
            {chosenWithEmail.length === 0 ? (
              <div style={{ fontSize:12.5, color:"#6b7280" }}>Sélectionne des contacts avec email ci-dessus.</div>
            ) : (
              <>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {(["separate","grouped"] as const).map(m => (
                    <button key={m} onClick={() => setMailMode(m)}
                      style={{ flex:1, padding:"6px 10px", borderRadius:7, border:`1.5px solid ${mailMode===m?"#1a56db":"#bfdbfe"}`, background:mailMode===m?"#1a56db":"#fff", color:mailMode===m?"#fff":"#1a56db", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                      {m==="separate" ? "Mails séparés" : "Mail groupé"}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>
                  {mailMode==="separate" ? `${chosenWithEmail.length} mail(s) individuel(s)` : `1 mail groupé à ${chosenWithEmail.length} destinataire(s)`}
                  {" : "}{chosenWithEmail.map(c=>`${c.first_name} ${c.last_name}`).join(", ")}
                </div>
                <button onClick={handleSendMail}
                  style={{ width:"100%", padding:"8px", borderRadius:8, background:"#1a56db", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <Send size={13}/> Ouvrir {mailMode==="separate" && chosenWithEmail.length>1 ? `${chosenWithEmail.length} mails` : "le mail"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Google Calendar feedback ── */}
        {gcalLink && (
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, color:"#15803d", fontWeight:600 }}>✅ Ajouté à Google Calendar</span>
            <a href={gcalLink} target="_blank" rel="noreferrer" style={{ fontSize:12.5, color:"#15803d", display:"flex", alignItems:"center", gap:4, textDecoration:"none" }}>
              Ouvrir <ExternalLink size={11}/>
            </a>
          </div>
        )}
        {gcalError && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#dc2626" }}>
            ❌ {gcalError}
          </div>
        )}

        {/* ── Barre d'actions ── */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, display:"flex", alignItems:"center", gap:8 }}>
          {/* Mail */}
          <button onClick={() => setShowMail(p=>!p)} title="Envoyer un email aux contacts"
            style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8, border:`1px solid ${showMail?"#1a56db":"var(--border)"}`, background:showMail?"#eff6ff":"var(--surface-2)", color:showMail?"#1a56db":"var(--text-3)", cursor:"pointer", fontFamily:"inherit", fontSize:12.5 }}>
            <Mail size={13}/> Mail
          </button>

          {/* Google Calendar */}
          <button onClick={handleAddToGcal} disabled={!form.due_date || gcalLoading} title="Ajouter à Google Calendar"
            style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8, border:`1px solid ${gcalLink?"#16a34a":"var(--border)"}`, background:gcalLink?"#f0fdf4":"var(--surface-2)", color:gcalLink?"#16a34a":"var(--text-3)", cursor:form.due_date&&!gcalLoading?"pointer":"default", fontFamily:"inherit", fontSize:12.5, opacity:!form.due_date?.5:1 }}>
            <CalendarDays size={13}/> {gcalLoading ? "…" : gcalLink ? "Ajouté ✓" : "Google Cal"}
          </button>

          <div style={{ flex:1 }}/>

          <button onClick={onClose}
            style={{ padding:"8px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={!form.title.trim()||loading}
            style={{ padding:"8px 20px", borderRadius:8, background:form.title.trim()&&!loading?"#1a56db":"var(--surface-3)", color:form.title.trim()&&!loading?"#fff":"var(--text-5)", border:"none", fontSize:13, fontWeight:600, cursor:form.title.trim()&&!loading?"pointer":"default", fontFamily:"inherit" }}>
            {loading ? "…" : isNew ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
