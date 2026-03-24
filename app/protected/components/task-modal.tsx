"use client";
import { useState, useEffect } from "react";
import { X, Check, Trash2, Send, Mail } from "lucide-react";
import { TimeSelect } from "./time-select";

const TASK_TYPES = [
  { value:"todo",            label:"☑️ Tâche",          group:"tâche" },
  { value:"follow_up",      label:"🔔 Relance",         group:"action" },
  { value:"call",           label:"📞 Appel",           group:"action" },
  { value:"meeting",        label:"🤝 Réunion",         group:"action" },
  { value:"email_sent",     label:"✉️ Email envoyé",   group:"action" },
  { value:"email_received", label:"📩 Email reçu",     group:"action" },
  { value:"intro",          label:"👋 Introduction",    group:"action" },
  { value:"deck_sent",      label:"📊 Deck envoyé",    group:"action" },
  { value:"nda",            label:"📋 NDA",             group:"action" },
  { value:"note",           label:"📝 Note",            group:"note" },
  { value:"other",          label:"📌 Autre",           group:"note" },
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
  item?: TaskItem | null;           // null = création
  contacts?: ContactOption[];       // contacts disponibles
  dealId?: string | null;
  onClose: () => void;
  onSave?: (task: TaskItem) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, done: boolean) => void;
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
  const [loading, setLoading] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [mailMode, setMailMode] = useState<"separate"|"grouped">("separate");

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

  async function handleSave() {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const endpoint = item?.id
        ? `/api/deals/${dealId ?? item.deal_id}/tasks`
        : `/api/deals/${dealId}/tasks`;
      const method = item?.id ? "PATCH" : "POST";
      const body = item?.id
        ? { task_id: item.id, ...form }
        : { ...form, deal_id: dealId };

      const res = await fetch(endpoint, {
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
    await fetch(`/api/deals/${dealId ?? item.deal_id}/tasks`, {
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
    await fetch(`/api/deals/${dealId ?? item.deal_id}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: item.id, task_status: done ? "done" : "open" }),
    });
    onToggle?.(item.id, done);
    onClose();
  }

  function handleSendMail() {
    const chosen = contacts.filter(c => form.contact_ids.includes(c.id) && c.email);
    if (!chosen.length) return;
    const subject = encodeURIComponent(`[Action] ${form.title}`);
    const body = encodeURIComponent(`Bonjour,\n\nJe reviens vers vous concernant : ${form.title}.\n\n${form.summary || ""}\n\nCordialement`);
    if (mailMode === "grouped") {
      window.open(`mailto:${chosen.map(c=>c.email).join(",")}?subject=${subject}&body=${body}`);
    } else {
      chosen.forEach((c, i) => setTimeout(() => window.open(`mailto:${c.email}?subject=${subject}&body=${body}`), i*300));
    }
    setShowMail(false);
  }

  const inp: React.CSSProperties = { width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const isDone = item?.task_status === "done";
  const chosenWithEmail = contacts.filter(c => form.contact_ids.includes(c.id) && c.email);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {!isNew && (
              <button onClick={handleToggle} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isDone?"var(--fund-tx)":"var(--border)"}`, background:isDone?"var(--fund-tx)":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {isDone && <Check size={12} color="#fff"/>}
              </button>
            )}
            <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>
              {isNew ? "Nouvelle tâche" : (isDone ? "✅ " : "") + "Tâche"}
            </span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {!isNew && chosenWithEmail.length > 0 && (
              <button onClick={() => setShowMail(p=>!p)} title="Envoyer un email" style={{ width:28, height:28, borderRadius:7, background:showMail?"#eff6ff":"var(--surface-2)", border:`1px solid ${showMail?"#1a56db":"var(--border)"}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:showMail?"#1a56db":"var(--text-4)" }}>
                <Mail size={13}/>
              </button>
            )}
            {!isNew && (
              <button onClick={handleDelete} style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--rec-tx)" }}>
                <Trash2 size={13}/>
              </button>
            )}
            <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)" }}>
              <X size={14}/>
            </button>
          </div>
        </div>

        {/* Mail panel */}
        {showMail && (
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#1a56db", marginBottom:8 }}>Mode d'envoi</div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {(["separate","grouped"] as const).map(m => (
                <button key={m} onClick={()=>setMailMode(m)}
                  style={{ flex:1, padding:"6px 10px", borderRadius:7, border:`1.5px solid ${mailMode===m?"#1a56db":"#bfdbfe"}`, background:mailMode===m?"#1a56db":"#fff", color:mailMode===m?"#fff":"#1a56db", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                  {m==="separate"?"Mails séparés":"Mail groupé"}
                </button>
              ))}
            </div>
            <button onClick={handleSendMail} style={{ width:"100%", padding:"7px", borderRadius:8, background:"#1a56db", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <Send size={12}/> Envoyer à {chosenWithEmail.length} contact{chosenWithEmail.length>1?"s":""}
            </button>
          </div>
        )}

        {/* Titre */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Titre *</label>
          <input style={inp} value={form.title} onChange={setF("title")} placeholder="Titre de la tâche ou de l'action…"/>
        </div>

        {/* Type + Priorité */}
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

        {/* Date + Heure */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Date & Heure</label>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{...inp, flex:2}} type="date" value={form.due_date} onChange={setF("due_date")}/>
            <TimeSelect value={form.due_time} onChange={v=>setForm(p=>({...p,due_time:v}))} style={{ flex:1 }}/>
          </div>
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Contacts associés</label>
            <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:150, overflowY:"auto" }}>
              {contacts.map(c => {
                const sel = form.contact_ids.includes(c.id);
                return (
                  <label key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, border:`1px solid ${sel?"#1a56db":"var(--border)"}`, background:sel?"rgba(26,86,219,.06)":"var(--surface-2)", cursor:"pointer" }}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleContact(c.id)} style={{ accentColor:"#1a56db" }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:13, color:"var(--text-2)", fontWeight:600 }}>{c.first_name} {c.last_name}</span>
                      {c.org_name && <span style={{ fontSize:11.5, color:"var(--text-5)", marginLeft:6 }}>— {c.org_name}</span>}
                    </div>
                    {c.email && <span style={{ fontSize:11, color:"var(--text-5)" }}>✉️</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Résumé */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Notes / Résumé</label>
          <textarea style={{...inp, height:72, resize:"vertical"}} value={form.summary} onChange={setF("summary")} placeholder="Résumé, context, suite à donner…"/>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Annuler</button>
          <button onClick={handleSave} disabled={!form.title.trim() || loading}
            style={{ padding:"8px 20px", borderRadius:8, background:form.title.trim()&&!loading?"#1a56db":"var(--surface-3)", color:form.title.trim()&&!loading?"#fff":"var(--text-5)", border:"none", fontSize:13, fontWeight:600, cursor:form.title.trim()&&!loading?"pointer":"default", fontFamily:"inherit" }}>
            {loading ? "…" : isNew ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
