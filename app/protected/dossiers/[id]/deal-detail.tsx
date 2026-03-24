"use client";
import { useState, useCallback } from "react";
import { TimeSelect } from "../../components/time-select";
import { EventModal } from "../../components/event-modal";
import { TaskModal } from "../../components/task-modal";
import { LossReasonModal } from "../../components/loss-reason-modal";
import { MailTaskModal } from "../../components/mail-task-modal";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp,
  Mail, Phone, Linkedin, Users, Building2, TrendingUp, CheckSquare,
  Activity, FileText, ExternalLink, AlertTriangle, CalendarDays, Send
} from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";

// ── Types ────────────────────────────────────────────────────
type Org = { id:string; name:string; organization_type:string; base_status:string; location?:string; investment_ticket?:string; contacts: Contact[] };
type Contact = { id:string; first_name:string; last_name:string; email?:string; phone?:string; title?:string; linkedin_url?:string; base_status:string; last_contact_date?:string; role_label?:string; org_id?:string; org_name?:string };
type Commitment = { id:string; amount?:number; currency:string; status:string; committed_at?:string; notes?:string; organization_id?:string; org_name?:string };
type Task = { id:string; title:string; task_type?:string; task_status:string; priority_level:string; due_date?:string; due_time?:string; description?:string; summary?:string; contact_id?:string; contact_name?:string; contact_ids?:string[] };
type Act = { id:string; title:string; activity_type:string; activity_date:string; summary?:string; contact_ids?:string[]; contact_names?:string[] };
type Doc = { id:string; name:string; document_type:string; document_status:string; document_url?:string; version_label?:string; added_at:string };

// ── Helpers ──────────────────────────────────────────────────
const DT: Record<string,{bg:string;tx:string;border:string}> = {
  fundraising:{bg:"var(--fund-bg)",tx:"var(--fund-tx)",border:"var(--fund-mid)"},
  ma_sell:{bg:"var(--sell-bg)",tx:"var(--sell-tx)",border:"var(--sell-mid)"},
  ma_buy:{bg:"var(--buy-bg)",tx:"var(--buy-tx)",border:"var(--buy-mid)"},
  cfo_advisor:{bg:"var(--cfo-bg)",tx:"var(--cfo-tx)",border:"var(--cfo-mid)"},
  recruitment:{bg:"var(--rec-bg)",tx:"var(--rec-tx)",border:"var(--rec-mid)"},
};
const TYPE_LABELS: Record<string,string> = { fundraising:"Fundraising", ma_sell:"M&A Sell", ma_buy:"M&A Buy", cfo_advisor:"CFO Advisor", recruitment:"Recrutement" };
const STAGE_LABELS: Record<string,string> = { kickoff:"Kickoff", preparation:"Préparation", outreach:"Prospection", management_meetings:"Meetings mgt", dd:"Due diligence", negotiation:"Négociation", closing:"Closing", post_closing:"Post-closing", ongoing_support:"Suivi", search:"Recherche" };
const STATUS_SC: Record<string,{bg:string,tx:string}> = {
  active:{bg:"var(--fund-bg)",tx:"var(--fund-tx)"}, priority:{bg:"var(--rec-bg)",tx:"var(--rec-tx)"},
  qualified:{bg:"var(--sell-bg)",tx:"var(--sell-tx)"}, to_qualify:{bg:"var(--surface-3)",tx:"var(--text-4)"},
  dormant:{bg:"var(--surface-3)",tx:"var(--text-4)"}, inactive:{bg:"var(--surface-3)",tx:"var(--text-5)"},
  excluded:{bg:"var(--rec-bg)",tx:"var(--rec-tx)"},
};
const STATUS_L: Record<string,string> = { active:"Actif", priority:"Prioritaire", qualified:"Qualifié", to_qualify:"À qualifier", dormant:"Dormant", inactive:"Inactif", excluded:"Exclu" };
const COMM_S: Record<string,{label:string,bg:string,tx:string}> = {
  indication:{label:"Indication",bg:"var(--surface-3)",tx:"var(--text-4)"},
  soft:{label:"Soft",bg:"#FEF3C7",tx:"#92400E"},
  hard:{label:"Hard",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  signed:{label:"Signé",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  transferred:{label:"Transféré",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  cancelled:{label:"Annulé",bg:"var(--rec-bg)",tx:"var(--rec-tx)"},
};
const ACT_ICON: Record<string,string> = { email:"✉️", call:"📞", meeting:"🤝", note:"📝", other:"📌" };
const PRIO_C: Record<string,string> = { high:"var(--rec-tx)", medium:"var(--sell-tx)", low:"var(--text-5)" };

function fmt(d?:string|null){ if(!d) return "—"; return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short"}).format(new Date(d)); }
function fmtA(n?:number,c="EUR"){ if(!n) return "—"; return n>=1e6?`${(n/1e6).toFixed(1)}M ${c}`:n>=1e3?`${(n/1e3).toFixed(0)}k ${c}`:`${n} ${c}`; }
function daysSince(d?:string){ if(!d) return null; return Math.floor((Date.now()-new Date(d).getTime())/86400000); }
function toDateStr(d?:string){ return d?d.split("T")[0]:""; }

// ── Mini modale inline ───────────────────────────────────────
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", padding:4 }}><X size={16}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>{label}</label>
      {children}
    </div>
  );
}
const inp: React.CSSProperties = { width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const sel: React.CSSProperties = { ...inp };
function BtnPrimary({ onClick, loading, children }: { onClick:()=>void; loading?:boolean; children:React.ReactNode }) {
  return <button onClick={onClick} disabled={!!loading} style={{ padding:"9px 18px", background:"var(--accent,#1a56db)", color:"#fff", border:"none", borderRadius:9, fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:loading?.6:1 }}>{loading?"…":children}</button>;
}

// ── Section header réutilisable ──────────────────────────────
function SectionHeader({ icon:Icon, title, count, expanded, onToggle, onAdd, addLabel }:{
  icon:any; title:string; count:number; expanded:boolean; onToggle:()=>void; onAdd?:()=>void; addLabel?:string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer" }} onClick={onToggle}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Icon size={14} color="var(--text-4)"/>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:".06em" }}>{title}</span>
        <span style={{ fontSize:11.5, background:"var(--surface-3)", color:"var(--text-4)", borderRadius:20, padding:"1px 7px", fontWeight:600 }}>{count}</span>
      </div>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        {onAdd && (
          <button onClick={e=>{e.stopPropagation();onAdd();}} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", border:"1px solid var(--border)", borderRadius:7, background:"var(--surface-2)", color:"var(--text-3)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            <Plus size={11}/>{addLabel||"Ajouter"}
          </button>
        )}
        {expanded ? <ChevronUp size={14} color="var(--text-5)"/> : <ChevronDown size={14} color="var(--text-5)"/>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export function DealDetail({ deal, initialOrgs, initialContacts, initialCommitments, initialTasks, initialActivities, initialDocs }: {
  deal: any;
  initialOrgs: Org[];
  initialContacts: Contact[];
  initialCommitments: Commitment[];
  initialTasks: Task[];
  initialActivities: Act[];
  initialDocs: Doc[];
}) {
  // State sections
  const [orgs] = useState<Org[]>(initialOrgs);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activities, setActivities] = useState<Act[]>(initialActivities);
  const [docs, setDocs] = useState<Doc[]>(initialDocs);

  // Expanded sections
  const [expOrgs, setExpOrgs] = useState(true);
  const [expOrg, setExpOrg] = useState<Record<string,boolean>>({});
  const [expPipeline, setExpPipeline] = useState(true);
  const [expTasks, setExpTasks] = useState(true);
  const [expActs, setExpActs] = useState(true);
  const [expDocs, setExpDocs] = useState(true);

  // Modals
  const [modal, setModal] = useState<string|null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [mailTask, setMailTask] = useState<Task|null>(null);
  const [taskModal, setTaskModal] = useState<Task|Act|null|"new">(null);
  const [eventContext, setEventContext] = useState<{contactId?:string;contactName?:string;orgId?:string;orgName?:string}>({});
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({});

  const dt = DT[deal.deal_type] ?? DT.fundraising;
  const isFundraising = deal.deal_type === "fundraising";
  const target = deal.target_amount ?? 0;
  const hard = commitments.filter(c=>["hard","signed","transferred"].includes(c.status)).reduce((s,c)=>s+(c.amount??0),0);
  const soft = commitments.filter(c=>["soft","hard","signed","transferred"].includes(c.status)).reduce((s,c)=>s+(c.amount??0),0);
  const pct = target > 0 ? Math.min(100, Math.round(hard/target*100)) : 0;
  const openTasks = tasks.filter(t=>t.task_status==="open").length;

  const setF = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p=>({...p,[k]:e.target.value}));
  const openModal = (name:string, data?:any) => { setModal(name); setEditing(data??null); setForm(data ? {...data, amount:data.amount??"", committed_at:toDateStr(data.committed_at), due_date:toDateStr(data.due_date), activity_date:toDateStr(data.activity_date) } : {}); };
  const closeModal = () => { setModal(null); setEditing(null); setForm({}); };

  async function api(path:string, method:string, body:any) {
    const res = await fetch(`/api/deals/${deal.id}/${path}`, { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Erreur");
    return d;
  }

  // ── PIPELINE CRUD ──────────────────────────────────────────
  async function saveCommitment() {
    setLoading(true);
    try {
      const payload = { ...form, organization_id: orgs.find(o=>o.name===form.org_name)?.id || form.organization_id };
      if (editing) {
        const d = await api("pipeline","PATCH",{commitment_id:editing.id,...payload});
        const orgName = Array.isArray(d.organizations)?d.organizations[0]?.name:d.organizations?.name;
        setCommitments(p=>p.map(c=>c.id===editing.id?{...d,org_name:orgName}:c));
      } else {
        const d = await api("pipeline","POST",payload);
        const orgName = Array.isArray(d.organizations)?d.organizations[0]?.name:d.organizations?.name;
        setCommitments(p=>[...p,{...d,org_name:orgName}]);
      }
      closeModal();
    } catch(e:any){ alert(e.message); } finally { setLoading(false); }
  }
  async function deleteCommitment(id:string) {
    if (!confirm("Supprimer cet engagement ?")) return;
    await api("pipeline","DELETE",{commitment_id:id});
    setCommitments(p=>p.filter(c=>c.id!==id));
  }

  // ── TASKS CRUD ────────────────────────────────────────────
  async function saveTask() {
    setLoading(true);
    try {
      const contactId = contacts.find(c=>`${c.first_name} ${c.last_name}`===form.contact_name)?.id || form.contact_id || null;
      const payload = {...form, contact_id:contactId};
      if (editing) {
        const d = await api("tasks","PATCH",{task_id:editing.id,...payload});
        const cn = contacts.find(c=>c.id===d.contact_id);
        setTasks(p=>p.map(t=>t.id===editing.id?{...d,contact_name:cn?`${cn.first_name} ${cn.last_name}`:undefined}:t));
      } else {
        const d = await api("tasks","POST",payload);
        const cn = contacts.find(c=>c.id===d.contact_id);
        setTasks(p=>[...p,{...d,contact_name:cn?`${cn.first_name} ${cn.last_name}`:undefined}]);
      }
      closeModal();
    } catch(e:any){ alert(e.message); } finally { setLoading(false); }
  }
  async function toggleTask(t:Task) {
    const newStatus = t.task_status==="open"?"done":"open";
    const d = await api("tasks","PATCH",{task_id:t.id,task_status:newStatus});
    setTasks(p=>p.map(x=>x.id===t.id?{...x,task_status:d.task_status}:x));
  }
  async function deleteTask(id:string) {
    if(!confirm("Supprimer cette tâche ?")) return;
    await api("tasks","DELETE",{task_id:id});
    setTasks(p=>p.filter(t=>t.id!==id));
  }

  // ── ACTIVITIES CRUD ───────────────────────────────────────
  async function saveActivity() {
    setLoading(true);
    try {
      const contactIds: string[] = Array.isArray(form.contact_ids_arr) ? form.contact_ids_arr as unknown as string[] : [];
      const payload = {
        title: form.title,
        activity_type: form.activity_type || "email_sent",
        activity_date: form.activity_date || new Date().toISOString().split("T")[0],
        summary: form.summary || null,
        contact_ids: contactIds,
      };
      if (editing) {
        const d = await api("activities-crud","PATCH",{activity_id:editing.id,...payload});
        setActivities(p=>p.map(a=>a.id===editing.id?{...d}:a));
      } else {
        const d = await api("activities-crud","POST",payload);
        setActivities(p=>[{...d},...p]);
      }
      closeModal();
    } catch(e:any){ alert(e.message); } finally { setLoading(false); }
  }
  async function deleteActivity(id:string) {
    if(!confirm("Supprimer cette activité ?")) return;
    await api("activities-crud","DELETE",{activity_id:id});
    setActivities(p=>p.filter(a=>a.id!==id));
  }

  async function saveDocument() {
    if (!form.doc_name) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.doc_name,
          document_url: form.doc_url || null,
          version_label: form.doc_version || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      setDocs(p => [...p, d]);
      closeModal();
    } catch(e:any) { alert(e.message); } finally { setLoading(false); }
  }

  async function deleteDoc(id:string) {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch(`/api/deals/${deal.id}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: id }),
    });
    setDocs(p => p.filter(d => d.id !== id));
  }

  const cardStyle: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", marginBottom:10 };
  const rowStyle: React.CSSProperties = { display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"1px solid var(--border)" };
  const actionBtn: React.CSSProperties = { width:26, height:26, borderRadius:7, background:"none", border:"1px solid var(--border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)", flexShrink:0 };

  return (
    <div style={{ padding:"24px 20px", minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:1120, margin:"0 auto" }}>

        {/* Breadcrumb + titre */}
        <div style={{ marginBottom:16 }}>
          <Link href="/protected/dossiers" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-4)", textDecoration:"none", marginBottom:10 }}>
            <ArrowLeft size={13}/> Dossiers
          </Link>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ display:"flex", gap:7, marginBottom:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:11.5, fontWeight:700, borderRadius:7, padding:"3px 10px", background:dt.bg, color:dt.tx, border:`1px solid ${dt.border}` }}>{TYPE_LABELS[deal.deal_type]??deal.deal_type}</span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>{STAGE_LABELS[deal.deal_stage]??deal.deal_stage}</span>
                {deal.target_date && <span style={{ fontSize:11.5, color:"var(--text-5)", padding:"3px 8px" }}>🎯 {fmt(deal.target_date)}</span>}
              </div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--text-1)" }}>{deal.name}</h1>
              {deal.description && <p style={{ margin:"6px 0 0", fontSize:13, color:"var(--text-4)", lineHeight:1.5, maxWidth:600 }}>{deal.description}</p>}
            </div>
            <Link href={`/protected/dossiers/${deal.id}/modifier`} style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500, whiteSpace:"nowrap" }}>Modifier</Link>
          </div>
        </div>

        {/* Layout 2 colonnes */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>

          {/* ── Colonne gauche ── */}
          <div>

            {/* ORGANISATIONS + CONTACTS */}
            <div style={cardStyle}>
              <SectionHeader icon={Building2} title="Organisations & Contacts" count={orgs.length} expanded={expOrgs} onToggle={()=>setExpOrgs(p=>!p)} onAdd={()=>openModal("add_contact")} addLabel="Contact"/>
              {expOrgs && orgs.map(org => {
                const orgContacts = contacts.filter(c=>c.org_id===org.id);
                const isExp = expOrg[org.id] !== false;
                const sc = STATUS_SC[org.base_status]??STATUS_SC.to_qualify;
                return (
                  <div key={org.id} style={{ borderTop:"1px solid var(--border)" }}>
                    {/* Org row */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", cursor:"pointer", background:"var(--surface-2)" }}
                      onClick={()=>setExpOrg(p=>({...p,[org.id]:!isExp}))}>
                      <Building2 size={13} color="var(--text-4)"/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <Link href={`/protected/organisations/${org.id}`} onClick={e=>e.stopPropagation()} style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", textDecoration:"none" }}>{org.name}</Link>
                          <span style={{ fontSize:11, padding:"2px 7px", borderRadius:20, background:sc.bg, color:sc.tx }}>{STATUS_L[org.base_status]??org.base_status}</span>
                          {org.investment_ticket && <span style={{ fontSize:11, color:"var(--text-5)" }}>{org.investment_ticket}</span>}
                        </div>
                        {org.location && <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:1 }}>{org.location}</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                        <StatusDropdown id={org.id} status={org.base_status} entity="organisations" size="sm"/>
                        {isExp ? <ChevronUp size={12} color="var(--text-5)"/> : <ChevronDown size={12} color="var(--text-5)"/>}
                      </div>
                    </div>
                    {/* Contacts de cette org */}
                    {isExp && orgContacts.map(c => {
                      const days = daysSince(c.last_contact_date);
                      return (
                        <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px 9px 32px", borderTop:"1px solid var(--border)" }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text-3)", flexShrink:0 }}>
                            {(c.first_name?.[0]??"").toUpperCase()}{(c.last_name?.[0]??"").toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                              <Link href={`/protected/contacts/${c.id}`} style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", textDecoration:"none" }}>{c.first_name} {c.last_name}</Link>
                              {c.title && <span style={{ fontSize:11.5, color:"var(--text-4)" }}>{c.title}</span>}
                            </div>
                            {days !== null && days > 15 && (
                              <div style={{ fontSize:11, color: days>30?"var(--rec-tx)":"#B45309", display:"flex", alignItems:"center", gap:3, marginTop:2 }}>
                                <AlertTriangle size={10}/> {days}j sans contact
                              </div>
                            )}
                          </div>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            <StatusDropdown id={c.id} status={c.base_status} entity="contacts" size="sm"/>
                            {c.email && <a href={`mailto:${c.email}`} style={{...actionBtn, textDecoration:"none"}}><Mail size={11}/></a>}
                            {c.phone && <a href={`tel:${c.phone}`} style={{...actionBtn, textDecoration:"none"}}><Phone size={11}/></a>}
                            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" style={{...actionBtn, textDecoration:"none"}}><Linkedin size={11}/></a>}
                          </div>
                        </div>
                      );
                    })}
                    {isExp && orgContacts.length === 0 && (
                      <div style={{ padding:"8px 32px", fontSize:12, color:"var(--text-5)", borderTop:"1px solid var(--border)" }}>Aucun contact</div>
                    )}
                  </div>
                );
              })}
              {expOrgs && orgs.length === 0 && (
                <div style={{ padding:"24px", textAlign:"center", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)" }}>Aucune organisation</div>
              )}
            </div>

            {/* PIPELINE FINANCIER */}
            {isFundraising && (
              <div style={cardStyle}>
                <SectionHeader icon={TrendingUp} title="Pipeline investisseurs" count={commitments.length} expanded={expPipeline} onToggle={()=>setExpPipeline(p=>!p)} onAdd={()=>openModal("commitment")} addLabel="Engagement"/>
                {expPipeline && (
                  <>
                    {target > 0 && (
                      <div style={{ padding:"10px 16px", borderTop:"1px solid var(--border)", background:"var(--surface-2)" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-4)", marginBottom:5 }}>
                          <span>Hard : <strong style={{ color:"var(--fund-tx)" }}>{fmtA(hard, deal.currency)}</strong></span>
                          <span>Objectif : <strong style={{ color:"var(--text-2)" }}>{fmtA(target, deal.currency)}</strong> — <strong style={{ color:"var(--fund-tx)" }}>{pct}%</strong></span>
                        </div>
                        <div style={{ height:6, background:"var(--surface-3)", borderRadius:6, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:"var(--fund-tx)", borderRadius:6 }}/>
                        </div>
                      </div>
                    )}
                    {commitments.map((c,i) => {
                      const cs = COMM_S[c.status]??COMM_S.indication;
                      return (
                        <div key={c.id} style={{ ...rowStyle, borderBottom: i<commitments.length-1?"1px solid var(--border)":"none" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{c.org_name ?? "—"}</div>
                            <div style={{ fontSize:12, color:"var(--text-5)", marginTop:1 }}>{fmt(c.committed_at)}{c.notes ? ` · ${c.notes}` : ""}</div>
                          </div>
                          <span style={{ fontSize:11.5, padding:"3px 9px", borderRadius:20, background:cs.bg, color:cs.tx, fontWeight:600, flexShrink:0 }}>{cs.label}</span>
                          <span style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", flexShrink:0, minWidth:70, textAlign:"right" }}>{fmtA(c.amount, c.currency)}</span>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            <button onClick={()=>openModal("commitment",{...c,org_name:c.org_name})} style={{...actionBtn}}><Pencil size={11}/></button>
                            <button onClick={()=>deleteCommitment(c.id)} style={{...actionBtn, color:"var(--rec-tx)"}}><Trash2 size={11}/></button>
                          </div>
                        </div>
                      );
                    })}
                    {commitments.length===0 && <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>Aucun engagement</div>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Colonne droite ── */}
          <div>

            {/* TÂCHES */}
            <div style={cardStyle}>
              <SectionHeader icon={CheckSquare} title="Tâches" count={openTasks} expanded={expTasks} onToggle={()=>setExpTasks(p=>!p)} onAdd={()=>setTaskModal("new")} addLabel="Tâche"/>
              {expTasks && tasks.slice(0,8).map((t,i) => {
                const overdue = t.due_date && new Date(t.due_date) < new Date() && t.task_status==="open";
                return (
                  <div key={t.id} style={{ ...rowStyle, borderBottom: i<Math.min(tasks.length,8)-1?"1px solid var(--border)":"none", opacity:t.task_status==="done"?.45:1 }}>
                    <button onClick={()=>toggleTask(t)} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${t.task_status==="done"?"var(--fund-tx)":PRIO_C[t.priority_level]??PRIO_C.medium}`, background:t.task_status==="done"?"var(--fund-tx)":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {t.task_status==="done" && <Check size={10} color="#fff"/>}
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", textDecoration:t.task_status==="done"?"line-through":"none" }}>{t.title}</div>
                      {(t.contact_name||t.due_date) && (
                        <div style={{ fontSize:11.5, color: overdue?"var(--rec-tx)":"var(--text-5)", marginTop:1 }}>
                          {t.contact_name && <span>{t.contact_name}</span>}
                          {t.contact_name && t.due_date && <span> · </span>}
                          {t.due_date && <span>{overdue?"⚠ ":""}{fmt(t.due_date)}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      {(contacts.length > 0) && (
                        <button onClick={()=>setMailTask(t)} title="Envoyer un email aux contacts liés" style={{...actionBtn, color:"#1a56db"}}><Send size={11}/></button>
                      )}
                      <button onClick={()=>setTaskModal(t)} style={{...actionBtn}}><Pencil size={11}/></button>
                      <button onClick={()=>deleteTask(t.id)} style={{...actionBtn, color:"var(--rec-tx)"}}><Trash2 size={11}/></button>
                    </div>
                  </div>
                );
              })}
              {expTasks && tasks.length===0 && <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>Aucune tâche</div>}
              {expTasks && tasks.length>8 && <div style={{ padding:"8px 16px", fontSize:12, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>+{tasks.length-8} tâches supplémentaires</div>}
            </div>

            {/* ACTIVITÉS */}
            <div style={cardStyle}>
              <SectionHeader icon={Activity} title="Tâches & Actions" count={activities.length + tasks.length} expanded={expActs} onToggle={()=>setExpActs(p=>!p)} onAdd={()=>setTaskModal("new")} addLabel="Ajouter"/>
              {expActs && activities.slice(0,6).map((a,i) => (
                <div key={a.id} style={{ ...rowStyle, borderBottom: i<Math.min(activities.length,6)-1?"1px solid var(--border)":"none" }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                    {ACT_ICON[a.activity_type]??"📌"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{a.title}</div>
                    {(a.contact_names && (a.contact_names as string[]).length > 0) && (
                      <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:1 }}>
                        {(a.contact_names as string[]).join(", ")}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize:11.5, color:"var(--text-5)", flexShrink:0 }}>{fmt(a.activity_date)}</span>
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    <button onClick={()=>setTaskModal({id:a.id, title:a.title, task_type:a.activity_type, task_status:"done", priority_level:"medium", due_date:a.activity_date, contact_ids:a.contact_ids||[], summary:a.summary})} style={{...actionBtn}}><Pencil size={11}/></button>
                    <button onClick={()=>deleteActivity(a.id)} style={{...actionBtn, color:"var(--rec-tx)"}}><Trash2 size={11}/></button>
                  </div>
                </div>
              ))}
              {expActs && activities.length===0 && <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>Aucune activité</div>}
              {expActs && activities.length>6 && <div style={{ padding:"8px 16px", fontSize:12, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>+{activities.length-6} activités supplémentaires</div>}
            </div>

            {/* DOCUMENTS */}
            <div style={cardStyle}>
              <SectionHeader icon={FileText} title="Documents" count={docs.length} expanded={expDocs} onToggle={()=>setExpDocs(p=>!p)} onAdd={()=>openModal("document")} addLabel="Ajouter"/>
              {expDocs && docs.slice(0,5).map((d,i) => (
                <div key={d.id} style={{ ...rowStyle, borderBottom: i<Math.min(docs.length,5)-1?"1px solid var(--border)":"none" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{d.name}</div>
                    <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:1 }}>{d.document_type} {d.version_label?`· v${d.version_label}`:""}</div>
                  </div>
                  <span style={{ fontSize:11.5, color:"var(--text-5)", flexShrink:0 }}>{fmt(d.added_at)}</span>
                  {d.document_url && (
                    <a href={d.document_url} target="_blank" rel="noreferrer" style={{...actionBtn, textDecoration:"none"}}><ExternalLink size={11}/></a>
                  )}
                  <button onClick={()=>deleteDoc(d.id)} style={{...actionBtn, color:"var(--rec-tx)"}}><Trash2 size={11}/></button>
                </div>
              ))}
              {expDocs && docs.length===0 && <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>Aucun document</div>}
            </div>

          </div>
        </div>
      </div>

      {/* ═══ MODALES ═══════════════════════════════════════════ */}

      {/* Engagement */}
      {modal==="commitment" && (
        <Modal title={editing?"Modifier l'engagement":"Nouvel engagement"} onClose={closeModal}>
          <Field label="Organisation">
            <select style={sel} value={form.org_name||""} onChange={setF("org_name")}>
              <option value="">— Choisir —</option>
              {orgs.map(o=><option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <select style={sel} value={form.status||"indication"} onChange={setF("status")}>
              {Object.entries(COMM_S).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Montant">
            <input style={inp} type="number" placeholder="ex: 500000" value={form.amount||""} onChange={setF("amount")}/>
          </Field>
          <Field label="Devise">
            <select style={sel} value={form.currency||"EUR"} onChange={setF("currency")}>
              <option value="EUR">EUR</option><option value="CHF">CHF</option><option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Date d'engagement">
            <input style={inp} type="date" value={form.committed_at||""} onChange={setF("committed_at")}/>
          </Field>
          <Field label="Notes">
            <input style={inp} placeholder="Notes…" value={form.notes||""} onChange={setF("notes")}/>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={closeModal} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>Annuler</button>
            <BtnPrimary onClick={saveCommitment} loading={loading}>{editing?"Enregistrer":"Ajouter"}</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Tâche */}
      {modal==="task" && (
        <Modal title={editing?"Modifier la tâche":"Nouvelle tâche"} onClose={closeModal}>
          <Field label="Titre *">
            <input style={inp} placeholder="Titre de la tâche…" value={form.title||""} onChange={setF("title")}/>
          </Field>
          <Field label="Priorité">
            <select style={sel} value={form.priority_level||"medium"} onChange={setF("priority_level")}>
              <option value="high">Haute</option><option value="medium">Moyenne</option><option value="low">Basse</option>
            </select>
          </Field>
          <Field label="Date limite">
            <div style={{ display:"flex", gap:8 }}>
              <input style={{...inp, flex:2}} type="date" value={form.due_date||""} onChange={setF("due_date")}/>
              <TimeSelect value={form.due_time||""} onChange={v=>setForm(p=>({...p,due_time:v}))} style={{ flex:1 }}/>
            </div>
          </Field>
          <Field label="Contact associé">
            <select style={sel} value={form.contact_name||""} onChange={setF("contact_name")}>
              <option value="">— Aucun —</option>
              {contacts.map(c=><option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name} {c.org_name?`(${c.org_name})`:""}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea style={{...inp, height:70, resize:"vertical"}} placeholder="Description…" value={form.description||""} onChange={setF("description")}/>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={closeModal} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>Annuler</button>
            <BtnPrimary onClick={saveTask} loading={loading}>{editing?"Enregistrer":"Ajouter"}</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Activité */}
      {modal==="activity" && (
        <Modal title={editing?"Modifier l'activité":"Nouvelle activité"} onClose={closeModal}>
          <Field label="Titre *">
            <input style={inp} placeholder="ex: Email de présentation, Call de suivi…" value={form.title||""} onChange={setF("title")}/>
          </Field>
          <Field label="Type">
            <select style={sel} value={form.activity_type||"email_sent"} onChange={setF("activity_type")}>
              <option value="email_sent">✉️ Email envoyé</option>
              <option value="email_received">📩 Email reçu</option>
              <option value="call">📞 Appel</option>
              <option value="meeting">🤝 Réunion</option>
              <option value="follow_up">🔔 Relance</option>
              <option value="intro">👋 Introduction</option>
              <option value="deck_sent">📊 Deck envoyé</option>
              <option value="nda">📋 NDA</option>
              <option value="note">📝 Note</option>
              <option value="other">📌 Autre</option>
            </select>
          </Field>
          <Field label="Date et heure">
            <div style={{ display:"flex", gap:8 }}>
              <input style={{...inp, flex:2}} type="date" value={form.activity_date||new Date().toISOString().split("T")[0]} onChange={setF("activity_date")}/>
              <TimeSelect value={form.activity_time||""} onChange={v=>setForm(p=>({...p,activity_time:v}))} style={{ flex:1 }}/>
            </div>
          </Field>
          <Field label="Contacts associés">
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:160, overflowY:"auto", padding:"4px 0" }}>
              {contacts.map(c => {
                const cid = c.id;
                const selected = (Array.isArray(form.contact_ids_arr) ? form.contact_ids_arr as unknown as string[] : []).includes(cid);
                return (
                  <label key={cid} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, border:`1px solid ${selected?"var(--accent,#1a56db)":"var(--border)"}`, background:selected?"rgba(26,86,219,.06)":"var(--surface-2)", cursor:"pointer" }}>
                    <input type="checkbox" checked={selected} onChange={() => {
                      const cur: string[] = Array.isArray(form.contact_ids_arr) ? form.contact_ids_arr as unknown as string[] : [];
                      const next = selected ? cur.filter(x=>x!==cid) : [...cur, cid];
                      setForm((p: Record<string,string>) => ({...p, contact_ids_arr: next as unknown as string}));
                    }} style={{ accentColor:"var(--accent,#1a56db)" }}/>
                    <span style={{ fontSize:13, color:"var(--text-2)" }}>{c.first_name} {c.last_name}</span>
                    {c.org_name && <span style={{ fontSize:11.5, color:"var(--text-5)" }}>— {c.org_name}</span>}
                  </label>
                );
              })}
              {contacts.length === 0 && <span style={{ fontSize:13, color:"var(--text-5)" }}>Aucun contact dans ce dossier</span>}
            </div>
          </Field>
          <Field label="Résumé">
            <textarea style={{...inp, height:70, resize:"vertical"}} placeholder="Résumé, notes…" value={form.summary||""} onChange={setF("summary")}/>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={closeModal} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>Annuler</button>
            <BtnPrimary onClick={saveActivity} loading={loading}>{editing?"Enregistrer":"Ajouter"}</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Ajouter contact */}
      {modal==="add_contact" && (
        <Modal title="Ajouter un contact" onClose={closeModal}>
          <Field label="Contact existant">
            <select style={sel} value={form.contact_id||""} onChange={setF("contact_id")}>
              <option value="">— Rechercher —</option>
              {/* Les contacts viendront de la base — pour l'instant liste vide à compléter */}
            </select>
          </Field>
          <Field label="Ou créer un nouveau contact">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input style={inp} placeholder="Prénom" value={form.first_name||""} onChange={setF("first_name")}/>
              <input style={inp} placeholder="Nom" value={form.last_name||""} onChange={setF("last_name")}/>
            </div>
          </Field>
          <Field label="Email">
            <input style={inp} type="email" placeholder="email@exemple.com" value={form.email||""} onChange={setF("email")}/>
          </Field>
          <Field label="Organisation (dans ce dossier)">
            <select style={sel} value={form.org_name||""} onChange={setF("org_name")}>
              <option value="">— Choisir —</option>
              {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Rôle">
            <input style={inp} placeholder="ex: Partner, Investor…" value={form.role_label||""} onChange={setF("role_label")}/>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={closeModal} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>Annuler</button>
            <BtnPrimary onClick={async()=>{
              setLoading(true);
              try {
                const orgId = form.org_name;
                if (!orgId) { alert("Choisir une organisation"); return; }
                // Créer ou trouver le contact puis lier
                const res = await fetch("/api/contacts/upsert", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ first_name:form.first_name, last_name:form.last_name, email:form.email }) });
                const c = await res.json();
                await api("contacts-link","POST",{ contact_id:c.id, organization_id:orgId, role_label:form.role_label });
                const org = orgs.find(o=>o.id===orgId);
                setContacts(p=>[...p,{ id:c.id, first_name:c.first_name||form.first_name, last_name:c.last_name||form.last_name, email:c.email||form.email, base_status:"to_qualify", org_id:orgId, org_name:org?.name }]);
                closeModal();
              } catch(e:any){ alert(e.message); } finally { setLoading(false); }
            }} loading={loading}>Ajouter</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Document */}
      {modal==="document" && (
        <Modal title="Ajouter un document" onClose={closeModal}>
          <Field label="Nom du document *">
            <input style={inp} placeholder="ex: Teaser Redpeaks v1, NDA signé…" value={form.doc_name||""} onChange={setF("doc_name")}/>
          </Field>
          <Field label="Lien (URL ou Google Drive)">
            <input style={inp} type="url" placeholder="https://drive.google.com/…" value={form.doc_url||""} onChange={setF("doc_url")}/>
            <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:4 }}>
              Colle le lien de partage Google Drive ou toute autre URL.
            </div>
          </Field>
          <Field label="Version">
            <input style={inp} placeholder="ex: v1.0" value={form.doc_version||""} onChange={setF("doc_version")}/>
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={closeModal} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13 }}>Annuler</button>
            <BtnPrimary onClick={saveDocument} loading={loading}>Ajouter</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* TaskModal unifié */}
      {taskModal !== null && (
        <TaskModal
          item={taskModal === "new" ? null : taskModal as any}
          contacts={contacts.map(c => ({ id:c.id, first_name:c.first_name, last_name:c.last_name, email:c.email, org_name:c.org_name }))}
          dealId={deal.id}
          onClose={() => setTaskModal(null)}
          onSave={(t) => {
            if (taskModal === "new") {
              setTasks(p => [...p, {...t, task_status:"open"} as any]);
            } else {
              setTasks(p => p.map(x => x.id === t.id ? {...x,...t} as any : x));
              setActivities(p => p.map(x => x.id === t.id ? {...x,...t} as any : x));
            }
          }}
          onDelete={(id) => {
            setTasks(p => p.filter(x => x.id !== id));
            setActivities(p => p.filter(x => x.id !== id));
          }}
          onToggle={(id, done) => {
            setTasks(p => p.map(x => x.id === id ? {...x, task_status:done?"done":"open"} as any : x));
          }}
        />
      )}

      {/* Modale email tâche */}
      {mailTask && (
        <MailTaskModal
          task={mailTask}
          contacts={contacts}
          onClose={() => setMailTask(null)}
        />
      )}

      {/* EventModal */}
      {showEventModal && (
        <EventModal
          dealId={deal.id}
          contactId={eventContext.contactId}
          orgId={eventContext.orgId}
          contactName={eventContext.contactName}
          orgName={eventContext.orgName}
          dealName={deal.name}
          onClose={() => setShowEventModal(false)}
        />
      )}

      {/* LossReasonModal */}
      {showLossModal && (
        <LossReasonModal
          entityType="deal"
          entityName={deal.name}
          entityId={deal.id}
          onClose={() => setShowLossModal(false)}
          onConfirm={async (reason) => {
            setShowLossModal(false);
          }}
        />
      )}
    </div>
  );
}
