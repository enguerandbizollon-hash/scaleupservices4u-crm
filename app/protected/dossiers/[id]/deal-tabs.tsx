"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, Users, FileText, CheckSquare, Activity, TrendingUp, Mail, Phone, Linkedin, ChevronRight, ExternalLink } from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";

const STATUS_COLORS: Record<string,{bg:string,tx:string}> = {
  active:    {bg:"var(--fund-bg)", tx:"var(--fund-tx)"},
  priority:  {bg:"var(--rec-bg)",  tx:"var(--rec-tx)"},
  qualified: {bg:"var(--sell-bg)", tx:"var(--sell-tx)"},
  to_qualify:{bg:"var(--surface-3)",tx:"var(--text-4)"},
  excluded:  {bg:"var(--rec-bg)",  tx:"var(--rec-tx)"},
  dormant:   {bg:"var(--surface-3)",tx:"var(--text-4)"},
  inactive:  {bg:"var(--surface-3)",tx:"var(--text-5)"},
};
const STATUS_LABELS: Record<string,string> = {
  active:"Actif", priority:"Prioritaire", qualified:"Qualifié",
  to_qualify:"À qualifier", dormant:"Dormant", inactive:"Inactif", excluded:"Exclu",
};
const TYPE_LABELS: Record<string,string> = {
  investor:"Investisseur", family_office:"Family Office", corporate:"Corporate",
  bank:"Banque", advisor:"Conseil", law_firm:"Cab. juridique", other:"Autre",
};
const ACT_ICON: Record<string,string> = { email:"✉️", call:"📞", meeting:"🤝", note:"📝", other:"📌" };
const COMM_STATUS: Record<string,{label:string,bg:string,tx:string}> = {
  indication: {label:"Indication",  bg:"var(--surface-3)", tx:"var(--text-4)"},
  soft:       {label:"Soft",        bg:"var(--sell-bg)",   tx:"var(--sell-tx)"},
  hard:       {label:"Hard",        bg:"var(--fund-bg)",   tx:"var(--fund-tx)"},
  signed:     {label:"Signé",       bg:"var(--fund-bg)",   tx:"var(--fund-tx)"},
  transferred:{label:"Transféré",   bg:"var(--fund-bg)",   tx:"var(--fund-tx)"},
  cancelled:  {label:"Annulé",      bg:"var(--rec-bg)",    tx:"var(--rec-tx)"},
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d));
}
function fmtAmount(n: number, currency = "EUR") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}
function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

type Tab = "organisations" | "contacts" | "financier" | "taches" | "activites" | "documents";

export function DealTabs({ dealId, dealType, orgs, contacts, docs, tasks, activities, commitments, target, hardAmount, softAmount, currency }: {
  dealId: string; dealType: string;
  orgs: any[]; contacts: any[]; docs: any[]; tasks: any[]; activities: any[];
  commitments: any[]; target: number; hardAmount: number; softAmount: number; currency: string;
}) {
  const [tab, setTab] = useState<Tab>("organisations");
  const isFundraising = dealType === "fundraising";
  const openTasks = tasks.filter(t => t.task_status === "open").length;
  const completion = target > 0 ? Math.min(100, Math.round((hardAmount / target) * 100)) : 0;

  const tabs: { id: Tab; icon: any; label: string; count?: number }[] = [
    { id:"organisations", icon:Building2, label:"Organisations", count:orgs.length },
    { id:"contacts",      icon:Users,     label:"Contacts",      count:contacts.length },
    ...(isFundraising ? [{ id:"financier" as Tab, icon:TrendingUp, label:"Pipeline" }] : []),
    { id:"taches",        icon:CheckSquare, label:"Tâches",      count:openTasks },
    { id:"activites",     icon:Activity,  label:"Activités",     count:activities.length },
    { id:"documents",     icon:FileText,  label:"Documents",     count:docs.length },
  ];

  return (
    <div>
      {/* Onglets nav */}
      <div style={{ display:"flex", gap:4, marginBottom:12, background:"var(--surface-2)", borderRadius:12, padding:4 }}>
        {tabs.map(({ id, icon:Icon, label, count }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
            padding:"8px 6px", borderRadius:9, border:"none", cursor:"pointer",
            background: tab===id ? "var(--surface)" : "transparent",
            color: tab===id ? "var(--text-1)" : "var(--text-4)",
            fontWeight: tab===id ? 600 : 400,
            fontSize:12.5, fontFamily:"inherit",
            boxShadow: tab===id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            transition:"all .12s",
          }}>
            <Icon size={13}/>
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span style={{ fontSize:11, background: tab===id ? "var(--surface-3)" : "var(--surface-3)", color:"var(--text-4)", borderRadius:10, padding:"1px 6px", fontWeight:600 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Organisations */}
      {tab === "organisations" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {orgs.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucune organisation liée à ce dossier
            </div>
          ) : orgs.map((o, i) => {
            const sc = STATUS_COLORS[o.base_status] ?? STATUS_COLORS.to_qualify;
            return (
              <div key={o.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom: i<orgs.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ width:36, height:36, borderRadius:9, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Building2 size={14} color="var(--text-4)"/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:600, color:"var(--text-1)" }}>{o.name}</span>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:sc.bg, color:sc.tx }}>
                      {STATUS_LABELS[o.base_status] ?? o.base_status}
                    </span>
                    {o.investment_ticket && <span style={{ fontSize:11, color:"var(--text-4)", padding:"2px 8px", borderRadius:20, background:"var(--surface-2)", border:"1px solid var(--border)" }}>{o.investment_ticket}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2 }}>
                    {TYPE_LABELS[o.organization_type] ?? o.organization_type}
                    {o.location ? ` · ${o.location}` : ""}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <StatusDropdown id={o.id} status={o.base_status} entity="organisations" size="sm"/>
                  <Link href={`/protected/organisations/${o.id}`}
                    style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"var(--text-4)" }}>
                    <ChevronRight size={13}/>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contacts */}
      {tab === "contacts" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {contacts.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucun contact lié à ce dossier
            </div>
          ) : contacts.map((c, i) => {
            const days = daysSince(c.last_contact_date);
            const sc = STATUS_COLORS[c.base_status] ?? STATUS_COLORS.to_qualify;
            return (
              <div key={c.id} style={{
                display:"flex", alignItems:"center", gap:14, padding:"13px 20px",
                borderBottom: i<contacts.length-1?"1px solid var(--border)":"none",
                background: days && days > 30 ? "rgba(220,38,38,.03)" : days && days > 15 ? "rgba(245,158,11,.03)" : "transparent",
              }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--text-3)", flexShrink:0 }}>
                  {(c.first_name?.[0]??"").toUpperCase()}{(c.last_name?.[0]??"").toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{c.first_name} {c.last_name}</span>
                    {c.title && <span style={{ fontSize:12, color:"var(--text-4)" }}>{c.title}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2, display:"flex", gap:8, flexWrap:"wrap" }}>
                    {c.organisation && <span>{c.organisation}</span>}
                    {days !== null && <span style={{ color: days>30?"var(--rec-tx)":days>15?"#B45309":"var(--text-5)", fontWeight: days>15?600:400 }}>
                      {days>15 ? `⚠ ${days}j` : `Contact ${fmtDate(c.last_contact_date)}`}
                    </span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <StatusDropdown id={c.id} status={c.base_status} entity="contacts" size="sm"/>
                  {c.email && <a href={`mailto:${c.email}`} style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)", textDecoration:"none" }}><Mail size={12}/></a>}
                  {c.phone && <a href={`tel:${c.phone}`} style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)", textDecoration:"none" }}><Phone size={12}/></a>}
                  <Link href={`/protected/contacts/${c.id}`} style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)", textDecoration:"none" }}><ChevronRight size={12}/></Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline financier (fundraising) */}
      {tab === "financier" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Barre progression */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:12, color:"var(--text-4)", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>Objectif</div>
                <div style={{ fontSize:22, fontWeight:800, color:"var(--text-1)" }}>{fmtAmount(target, currency)}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:12, color:"var(--text-4)", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>Sécurisé (hard)</div>
                <div style={{ fontSize:22, fontWeight:800, color:"var(--fund-tx)" }}>{fmtAmount(hardAmount, currency)}</div>
              </div>
            </div>
            <div style={{ height:10, background:"var(--surface-3)", borderRadius:10, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${completion}%`, background:"var(--fund-tx)", borderRadius:10, transition:"width .3s" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12, color:"var(--text-5)" }}>
              <span>Soft : {fmtAmount(softAmount, currency)}</span>
              <span style={{ fontWeight:600, color:"var(--fund-tx)" }}>{completion}%</span>
            </div>
          </div>

          {/* Tableau engagements */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em" }}>
                Engagements ({commitments.length})
              </span>
            </div>
            {commitments.length === 0 ? (
              <div style={{ padding:"32px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
                Aucun engagement enregistré
              </div>
            ) : commitments.map((c, i) => {
              const org = Array.isArray(c.organizations) ? c.organizations[0] : c.organizations as any;
              const cs = COMM_STATUS[c.status] ?? COMM_STATUS.indication;
              return (
                <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 20px", borderBottom: i<commitments.length-1?"1px solid var(--border)":"none" }}>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{org?.name ?? "—"}</div>
                    <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2 }}>{fmtDate(c.committed_at)}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:11.5, padding:"3px 10px", borderRadius:20, background:cs.bg, color:cs.tx, fontWeight:600 }}>{cs.label}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>{fmtAmount(c.amount, c.currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tâches */}
      {tab === "taches" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {tasks.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>Aucune tâche</div>
          ) : tasks.map((t, i) => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.task_status === "open";
            return (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 20px", borderBottom: i<tasks.length-1?"1px solid var(--border)":"none", opacity: t.task_status==="done"?.5:1 }}>
                <div style={{ width:8, height:8, borderRadius:4, flexShrink:0, background: t.task_status==="done"?"var(--fund-tx)": overdue?"var(--rec-tx)": t.priority_level==="high"?"var(--sell-tx)":"var(--border-2)" }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)", textDecoration: t.task_status==="done"?"line-through":"none" }}>{t.title}</div>
                  {t.description && <div style={{ fontSize:12, color:"var(--text-4)", marginTop:2 }}>{t.description}</div>}
                </div>
                <div style={{ fontSize:12, color: overdue?"var(--rec-tx)":"var(--text-5)", flexShrink:0, fontWeight: overdue?600:400 }}>
                  {t.due_date ? fmtDate(t.due_date) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activités */}
      {tab === "activites" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {activities.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>Aucune activité</div>
          ) : activities.map((a, i) => {
            const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations as any;
            return (
              <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"13px 20px", borderBottom: i<activities.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                  {ACT_ICON[a.activity_type] ?? "📌"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{a.title}</div>
                  {a.summary && <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>{a.summary}</div>}
                  {org?.name && <div style={{ fontSize:12, color:"var(--text-5)", marginTop:3 }}>{org.name}</div>}
                </div>
                <div style={{ fontSize:12, color:"var(--text-5)", flexShrink:0 }}>{fmtDate(a.activity_date)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {docs.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>Aucun document</div>
          ) : docs.map((d, i) => (
            <div key={d.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 20px", borderBottom: i<docs.length-1?"1px solid var(--border)":"none" }}>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{d.name}</div>
                <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2 }}>{d.document_type} {d.version_label ? `· v${d.version_label}` : ""}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:12, color:"var(--text-5)" }}>{fmtDate(d.added_at)}</span>
                {d.document_url && (
                  <a href={d.document_url} target="_blank" rel="noreferrer"
                    style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-4)", textDecoration:"none" }}>
                    <ExternalLink size={12}/>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
