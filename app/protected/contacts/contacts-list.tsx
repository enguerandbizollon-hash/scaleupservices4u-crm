"use client";

import { useState } from "react";
import { Search, Mail, Linkedin, Edit, Phone, Plus, X, Loader2, CheckCircle } from "lucide-react";

type Contact = {
  id: string; fullName: string; firstName: string; lastName: string;
  title: string; email: string; phone: string; linkedinUrl: string | null;
  sector: string; ticket: string; organisation: string; status: string; notes: string;
};

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg:"var(--deal-fundraising-bg)",  text:"var(--deal-fundraising-text)",  label:"Actif" },
  priority:  { bg:"var(--deal-recruitment-bg)",  text:"var(--deal-recruitment-text)",  label:"Prioritaire" },
  qualified: { bg:"var(--deal-ma-sell-bg)",       text:"var(--deal-ma-sell-text)",      label:"Qualifié" },
  to_qualify:{ bg:"var(--surface-2)",             text:"var(--text-4)",                 label:"À qualifier" },
  dormant:   { bg:"var(--deal-ma-buy-bg)",        text:"var(--deal-ma-buy-text)",       label:"Dormant" },
  inactive:  { bg:"var(--surface-2)",             text:"var(--text-4)",                 label:"Inactif" },
  excluded:  { bg:"var(--deal-recruitment-bg)",   text:"var(--deal-recruitment-text)",  label:"Exclu" },
};

const inp = { width:"100%", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"9px 12px", fontSize:13, color:"var(--text-1)", outline:"none", boxSizing:"border-box" } as React.CSSProperties;
const lbl = { display:"block", fontSize:11, fontWeight:700, color:"var(--text-3)", marginBottom:5, letterSpacing:"0.04em" } as React.CSSProperties;

function EditModal({ contact, onClose, onSaved }: { contact: Contact; onClose: () => void; onSaved: (updated: Partial<Contact>) => void }) {
  const [form, setForm] = useState({
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    sector: contact.sector,
    linkedin_url: contact.linkedinUrl ?? "",
    base_status: contact.status,
    notes: contact.notes,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    const fd = new FormData();
    fd.append("contact_id", contact.id);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, contact_id: contact.id }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Erreur"); setSaving(false); return; }
      setSaved(true);
      onSaved({ fullName: `${form.first_name} ${form.last_name}`.trim(), firstName: form.first_name, lastName: form.last_name, email: form.email, phone: form.phone, title: form.title, sector: form.sector, linkedinUrl: form.linkedin_url, status: form.base_status, notes: form.notes });
      setTimeout(onClose, 800);
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(13,31,53,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"white", borderRadius:18, padding:28, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:"var(--text-1)", margin:0 }}>Modifier le contact</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-3)", padding:4 }}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {[
            { key:"first_name", label:"PRÉNOM *" },
            { key:"last_name",  label:"NOM *" },
            { key:"email",      label:"EMAIL" },
            { key:"phone",      label:"TÉLÉPHONE" },
            { key:"title",      label:"FONCTION" },
            { key:"sector",     label:"SECTEUR" },
            { key:"linkedin_url", label:"LINKEDIN" },
          ].map(f => (
            <div key={f.key} style={f.key === "linkedin_url" ? { gridColumn:"1/-1" } : {}}>
              <label style={lbl}>{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} style={inp}/>
            </div>
          ))}
          <div>
            <label style={lbl}>STATUT</label>
            <select value={form.base_status} onChange={e => setForm(p => ({...p, base_status: e.target.value}))}
              style={{ ...inp, background:"var(--surface-2)" }}>
              {Object.entries(statusStyle).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={lbl}>NOTES</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
              rows={3} style={{ ...inp, resize:"none" }}/>
          </div>
        </div>

        {error && <p style={{ fontSize:12, color:"var(--deal-recruitment-text)", marginTop:10 }}>{error}</p>}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:13, cursor:"pointer" }}>Annuler</button>
          <button onClick={save} disabled={saving || saved}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 22px", borderRadius:9, background: saved?"var(--deal-fundraising-dot)":"var(--su-700)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", border:"none" }}>
            {saving ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/> : saved ? <CheckCircle size={14}/> : null}
            {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactsList({ contacts: initial, stats }: { contacts: Contact[]; stats: { total: number; active: number } }) {
  const [contacts, setContacts] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Contact | null>(null);

  const filtered = contacts.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = !s || c.fullName.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.organisation.toLowerCase().includes(s) || c.sector.toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleSaved(id: string, updated: Partial<Contact>) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  }

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      {editing && (
        <EditModal
          contact={editing}
          onClose={() => setEditing(null)}
          onSaved={(upd) => { handleSaved(editing.id, upd); }}
        />
      )}

      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>MODULE CRM</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Contacts</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:4 }}>{stats.total} contacts · {stats.active} actifs</p>
        </div>
        <a href="/protected/contacts/nouveau"
          style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600 }}>
          <Plus size={14}/> Nouveau contact
        </a>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-4)" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher nom, email, organisation…"
            style={{ width:"100%", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 12px 9px 36px", fontSize:13, color:"var(--text-1)", outline:"none", boxSizing:"border-box" }}/>
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{ borderRadius:10, border:"1px solid var(--border)", background:"var(--surface)", padding:"9px 14px", fontSize:13, color:"var(--text-1)", outline:"none" }}>
          <option value="all">Tous les statuts</option>
          {Object.entries(statusStyle).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <p style={{ fontSize:12, color:"var(--text-4)", marginBottom:10 }}>{filtered.length} résultat{filtered.length>1?"s":""}</p>

      {filtered.length === 0 ? (
        <div style={{ borderRadius:16, border:"2px dashed var(--border)", padding:48, textAlign:"center" }}>
          <p style={{ fontSize:13, color:"var(--text-4)" }}>Aucun contact trouvé.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {filtered.map(c => {
            const ss = statusStyle[c.status] ?? statusStyle.to_qualify;
            return (
              <div key={c.id} className="su-card" style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>{c.fullName}</span>
                    <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"2px 7px", background:ss.bg, color:ss.text }}>{ss.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:1 }}>
                    {c.title && <span>{c.title}</span>}
                    {c.title && c.organisation && <span style={{ margin:"0 4px", color:"var(--border-2)" }}>·</span>}
                    {c.organisation && <span style={{ color:"var(--su-600)", fontWeight:500 }}>{c.organisation}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                  {c.email && c.email !== "—" && (
                    <a href={`mailto:${c.email}`} title={c.email}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--su-600)" }}>
                      <Mail size={12}/>
                    </a>
                  )}
                  {c.phone && c.phone !== "—" && (
                    <a href={`tel:${c.phone}`} title={c.phone}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--deal-fundraising-dot)" }}>
                      <Phone size={12}/>
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer"
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"#0A66C2" }}>
                      <Linkedin size={12}/>
                    </a>
                  )}
                  <button onClick={() => setEditing(c)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-3)", cursor:"pointer" }}>
                    <Edit size={12}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
