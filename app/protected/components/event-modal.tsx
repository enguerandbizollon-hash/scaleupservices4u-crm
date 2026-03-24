"use client";
import { useState } from "react";
import { TimeSelect } from "./time-select";
import { ContactPicker, type ContactOption } from "./task-modal";
import { X, CalendarDays, Bell } from "lucide-react";

const EVENT_TYPES = [
  { value:"follow_up", label:"🔔 Relance" },
  { value:"meeting",   label:"🤝 Meeting" },
  { value:"call",      label:"📞 Appel" },
  { value:"email",     label:"✉️ Email" },
  { value:"deadline",  label:"⚠️ Deadline" },
  { value:"other",     label:"📌 Autre" },
];

const QUICK_DELAYS = [
  { label:"+3j",  days:3 },
  { label:"+7j",  days:7 },
  { label:"+14j", days:14 },
  { label:"+30j", days:30 },
];

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

interface EventModalProps {
  dealId?:    string;
  contactId?: string;
  orgId?:     string;
  contactName?: string;
  orgName?:   string;
  dealName?:  string;
  contacts?:  ContactOption[];
  onClose:    () => void;
  onCreated?: (event: any) => void;
}

export function EventModal({ dealId, contactId, orgId, contactName, orgName, dealName, contacts = [], onClose, onCreated }: EventModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title:         contactName ? `Relancer ${contactName}` : orgName ? `Relancer ${orgName}` : "",
    event_type:    "follow_up",
    due_date:      addDays(7),
    due_time:      "",
    reminder_date: "",
    notes:         "",
  });
  const [contactIds, setContactIds] = useState<string[]>(contactId ? [contactId] : []);
  const [loading, setLoading] = useState(false);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!form.title || !form.due_date) return;
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deal_id:         dealId || null,
          organization_id: orgId  || null,
          contact_id:      contactIds[0] || contactId || null,
          contact_ids:     contactIds,
          reminder_date:   form.reminder_date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated?.(data);
      onClose();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = { width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:440 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <CalendarDays size={16} color="var(--text-3)"/>
            <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Nouvel événement</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", padding:4 }}><X size={16}/></button>
        </div>

        {/* Contexte */}
        {(contactName || orgName || dealName) && (
          <div style={{ fontSize:12, color:"var(--text-4)", background:"var(--surface-2)", borderRadius:8, padding:"6px 10px", marginBottom:14 }}>
            {[contactName, orgName, dealName].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Type */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Type</label>
          <select style={inp} value={form.event_type} onChange={setF("event_type")}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Titre */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Titre *</label>
          <input style={inp} value={form.title} onChange={setF("title")} placeholder="ex: Relancer Paul Dupont"/>
        </div>

        {/* Date rapide */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Échéance *</label>
          <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
            {QUICK_DELAYS.map(({ label, days }) => (
              <button key={label} onClick={() => setForm(p => ({ ...p, due_date: addDays(days) }))}
                style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${form.due_date === addDays(days) ? "var(--accent,#1a56db)" : "var(--border)"}`, background: form.due_date === addDays(days) ? "var(--accent,#1a56db)" : "var(--surface-2)", color: form.due_date === addDays(days) ? "#fff" : "var(--text-3)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <input style={{...inp, flex:2}} type="date" value={form.due_date} onChange={setF("due_date")} min={today}/>
            <TimeSelect value={form.due_time} onChange={v=>setForm(p=>({...p,due_time:v}))} style={{ flex:1 }}/>
          </div>
        </div>

        {/* Rappel */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>
            <Bell size={11} style={{ marginRight:4, verticalAlign:"middle" }}/>Rappel (optionnel)
          </label>
          <input style={inp} type="date" value={form.reminder_date} onChange={setF("reminder_date")} max={form.due_date}/>
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <ContactPicker
            contacts={contacts}
            selected={contactIds}
            onToggle={id => setContactIds(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])}
          />
        )}

        {/* Notes */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Notes</label>
          <textarea style={{ ...inp, height:60, resize:"vertical" }} value={form.notes} onChange={setF("notes")} placeholder="Contexte, suite à donner…"/>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Annuler</button>
          <button onClick={handleSave} disabled={!form.title || !form.due_date || loading}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", background:"var(--accent,#1a56db)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit", opacity: (!form.title || !form.due_date || loading) ? .5 : 1 }}>
            {loading ? "…" : "Créer l'événement"}
          </button>
        </div>
      </div>
    </div>
  );
}
