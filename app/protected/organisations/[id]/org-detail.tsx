"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, MapPin, Mail, Phone, Linkedin, ChevronRight, Sparkles, Users, FolderOpen, Activity, BarChart2, FileCheck, TrendingUp } from "lucide-react";
import { FinancialTab, type FinancialRow } from "../../dossiers/[id]/financial-tab";
import { StatusDropdown } from "../../components/status-dropdown";
import { EnrichButton } from "../../components/enrich-button";
import { ORG_COMPANY_STAGES, REVENUE_RANGES, SALE_READINESS_OPTIONS, GEOGRAPHIES } from "@/lib/crm/matching-maps";
import { TagInput } from "@/components/tags/TagInput";

const INVESTOR_TYPES = ["investor", "business_angel", "family_office", "corporate"];
const COMPANY_PROFILE_TYPES = ["client","prospect_client","target","buyer","bank","advisor","law_firm","accounting_firm","consulting_firm","other"];

const fmtRevenue = (v: number | null) => {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} k€`;
  return `${v} €`;
};

const TYPE_LABELS: Record<string,string> = {
  client:"Client", prospect_client:"Prospect", investor:"Investisseur", buyer:"Repreneur",
  target:"Cible", law_firm:"Cab. juridique", bank:"Banque", advisor:"Conseil",
  accounting_firm:"Cab. comptable", family_office:"Family Office",
  corporate:"Corporate", consulting_firm:"Cab. conseil", other:"Autre",
};
const STATUS_COLORS: Record<string,{bg:string,tx:string}> = {
  active:     {bg:"#D1FAE5",          tx:"#065F46"},
  to_qualify: {bg:"var(--surface-3)", tx:"var(--text-4)"},
  inactive:   {bg:"#FEE2E2",          tx:"#991B1B"},
  // Backward compat
  priority:   {bg:"#D1FAE5",          tx:"#065F46"},
  qualified:  {bg:"#D1FAE5",          tx:"#065F46"},
  dormant:    {bg:"var(--surface-3)", tx:"var(--text-4)"},
  excluded:   {bg:"#FEE2E2",          tx:"#991B1B"},
};
const STATUS_LABELS: Record<string,string> = {
  active:     "Actif",
  to_qualify: "Non qualifié",
  inactive:   "Inactif",
  // Backward compat
  priority:   "Actif",
  qualified:  "Actif",
  dormant:    "Non qualifié",
  excluded:   "Inactif",
};
const DEAL_TYPE: Record<string,string> = {
  fundraising:"Fundraising", ma_sell:"M&A Sell", ma_buy:"M&A Buy",
  cfo_advisor:"CFO Advisor", recruitment:"Recrutement",
};
const ACT_ICON: Record<string,string> = { email:"✉️", call:"📞", meeting:"🤝", note:"📝", other:"📌" };

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d));
}

type Tab = "contacts" | "dossiers" | "activites" | "profil" | "mandats" | "financier";

const MANDATE_TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell", ma_buy: "M&A Buy",
  cfo_advisor: "CFO Advisory", recruitment: "Recrutement",
};
const MANDATE_STATUS: Record<string, { bg: string; tx: string }> = {
  draft:   { bg: "var(--surface-3)", tx: "var(--text-5)" },
  active:  { bg: "#D1FAE5",          tx: "#065F46"        },
  on_hold: { bg: "#FEF3C7",          tx: "#92400E"        },
  won:     { bg: "#DBEAFE",          tx: "#1D4ED8"        },
  lost:    { bg: "#FEE2E2",          tx: "#991B1B"        },
  closed:  { bg: "var(--surface-3)", tx: "var(--text-4)"  },
};

export function OrgDetail({ org, contacts, deals, activities, mandates, financialData }: {
  org: any; contacts: any[]; deals: any[]; activities: any[]; mandates: any[]; financialData: FinancialRow[];
}) {
  const [tab, setTab] = useState<Tab>("contacts");
  const sc = STATUS_COLORS[org.base_status] ?? STATUS_COLORS.to_qualify;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

      {/* Breadcrumb */}
      <Link href="/protected/organisations" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-4)", textDecoration:"none", marginBottom:20 }}>
        <ArrowLeft size={13}/> Organisations
      </Link>

      {/* Header card */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:"24px 28px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:0 }}>
            {/* Badges */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:10 }}>
              <span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-3)" }}>
                {TYPE_LABELS[org.organization_type] ?? org.organization_type}
              </span>
              <span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sc.bg, color:sc.tx }}>
                {STATUS_LABELS[org.base_status] ?? org.base_status}
              </span>
              {org.investment_ticket && (
                <span style={{ fontSize:11.5, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                  {org.investment_ticket}
                </span>
              )}
              {org.investment_stage && (
                <span style={{ fontSize:11.5, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                  {org.investment_stage}
                </span>
              )}
              {org.company_stage && (() => {
                const s = ORG_COMPANY_STAGES.find(x => x.value === org.company_stage);
                return s ? (
                  <span style={{ fontSize:11.5, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
                    {s.label}
                  </span>
                ) : null;
              })()}
              {org.revenue_range && (() => {
                const r = REVENUE_RANGES.find(x => x.value === org.revenue_range);
                return r ? (
                  <span style={{ fontSize:11.5, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"#F0FDF4", color:"#166534", border:"1px solid #BBF7D0" }}>
                    CA {r.label}
                  </span>
                ) : null;
              })()}
              {org.sale_readiness && org.sale_readiness !== "not_for_sale" && (() => {
                const s = SALE_READINESS_OPTIONS.find(x => x.value === org.sale_readiness);
                return s ? (
                  <span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:s.bg, color:s.tx }}>
                    {s.label}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Nom */}
            <h1 style={{ fontSize:24, fontWeight:700, color:"var(--text-1)", margin:"0 0 8px" }}>{org.name}</h1>

            {/* Infos */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", fontSize:13, color:"var(--text-4)" }}>
              {org.sector && <span>{org.sector}</span>}
              {org.location && <span style={{ display:"flex", alignItems:"center", gap:4 }}><MapPin size={11}/>{org.location}</span>}
              {org.website && (
                <a href={org.website.startsWith("http") ? org.website : `https://${org.website}`} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:4, color:"var(--text-3)", textDecoration:"none" }}>
                  <Globe size={11}/>{org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {org.description && (
              <p style={{ fontSize:13, color:"var(--text-3)", margin:"10px 0 0", lineHeight:1.6 }}>{org.description}</p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end", flexShrink:0 }}>
            <div style={{ display:"flex", gap:8 }}>
              <StatusDropdown id={org.id} status={org.base_status} entity="organisations" size="sm"/>
              <EnrichButton id={org.id} type="organisation" name={org.name} size="sm"/>
            </div>
            <Link href={`/protected/organisations/${org.id}/modifier`}
              style={{ fontSize:12.5, color:"var(--text-4)", textDecoration:"none", padding:"5px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)" }}>
              Modifier
            </Link>
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginTop:14, borderTop:"1px solid var(--border)", paddingTop:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:7 }}>Tags</div>
          <TagInput objectType="organisation" objectId={org.id} />
        </div>

        {/* Notes Pappers */}
        {org.notes && org.notes.includes("[Pappers]") && (
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:10, fontSize:12, color:"var(--text-4)", borderLeft:"3px solid var(--border-2)" }}>
            <Sparkles size={11} style={{ marginRight:5, verticalAlign:"middle" }}/>{org.notes}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:16 }}>
        {[
          { icon:BarChart2,  label:"Profil",    val:"",                tab:"profil" as Tab,    noCount:true  },
          { icon:Users,      label:"Contacts",  val:contacts.length,   tab:"contacts" as Tab,  noCount:false },
          { icon:FolderOpen, label:"Dossiers",  val:deals.length,      tab:"dossiers" as Tab,  noCount:false },
          { icon:FileCheck,  label:"Mandats",   val:mandates.length,   tab:"mandats" as Tab,   noCount:false },
          { icon:TrendingUp, label:"Finances",  val:financialData.length, tab:"financier" as Tab, noCount:false },
          { icon:Activity,   label:"Activités", val:activities.length, tab:"activites" as Tab, noCount:false },
        ].map(({ icon:Icon, label, val, tab:t, noCount }) => (
          <button key={t} onClick={() => setTab(t)} style={{
            textAlign:"center", padding:"14px 12px",
            background: tab===t ? "var(--surface)" : "var(--surface-2)",
            border: tab===t ? "1.5px solid var(--border-2)" : "1px solid var(--border)",
            borderRadius:12, cursor:"pointer", transition:"all .12s", fontFamily:"inherit",
          }}>
            <Icon size={14} color="var(--text-4)" style={{ marginBottom:4 }}/>
            {!noCount && <div style={{ fontSize:22, fontWeight:700, color:"var(--text-1)", lineHeight:1.2 }}>{val}</div>}
            <div style={{ fontSize:11.5, color:"var(--text-4)", marginTop:noCount ? 0 : 2 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Onglet Profil */}
      {tab === "profil" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Profil investisseur */}
          {INVESTOR_TYPES.includes(org.organization_type) && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:14 }}>Profil investisseur</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {org.investor_ticket_min != null && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Ticket</div>
                    <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>
                      {fmtRevenue(org.investor_ticket_min)} – {org.investor_ticket_max ? fmtRevenue(org.investor_ticket_max) : "∞"}
                    </div>
                  </div>
                )}
                {org.investor_stages?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Stades</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.investor_stages.map((s: string) => (
                        <span key={s} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#EEF2FF", color:"#3730A3", fontWeight:600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.investor_sectors?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Secteurs</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.investor_sectors.map((s: string) => (
                        <span key={s} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#F0FDF4", color:"#166534", fontWeight:600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.investor_geographies?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Géographies</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.investor_geographies.map((g: string) => {
                        const label = GEOGRAPHIES.find(x => x.value === g)?.label ?? g;
                        return <span key={g} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#ECFEFF", color:"#0E7490", fontWeight:600 }}>{label}</span>;
                      })}
                    </div>
                  </div>
                )}
              </div>
              {org.investor_thesis && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Thèse d'investissement</div>
                  <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.6 }}>{org.investor_thesis}</p>
                </div>
              )}
            </div>
          )}

          {/* Profil entreprise */}
          {COMPANY_PROFILE_TYPES.includes(org.organization_type) && (
            org.company_stage || org.revenue_range || org.employee_count || org.founded_year || org.sector
          ) && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:14 }}>Profil entreprise</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {org.sector && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Secteur</div>
                    <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>{org.sector}</div>
                  </div>
                )}
                {org.company_stage && (() => {
                  const s = ORG_COMPANY_STAGES.find(x => x.value === org.company_stage);
                  return s ? (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Stade</div>
                      <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>{s.label}</div>
                    </div>
                  ) : null;
                })()}
                {org.revenue_range && (() => {
                  const r = REVENUE_RANGES.find(x => x.value === org.revenue_range);
                  return r ? (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Tranche de CA</div>
                      <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>{r.label}</div>
                    </div>
                  ) : null;
                })()}
                {org.employee_count && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Effectifs</div>
                    <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>{org.employee_count.toLocaleString("fr-FR")} pers.</div>
                  </div>
                )}
                {org.founded_year && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Fondée en</div>
                    <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>{org.founded_year}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profil cédant M&A */}
          {org.organization_type === "target" && org.sale_readiness && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:14 }}>Profil cédant M&A</div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                {(() => {
                  const s = SALE_READINESS_OPTIONS.find(x => x.value === org.sale_readiness);
                  return s ? (
                    <span style={{ fontSize:12.5, padding:"4px 12px", borderRadius:20, background:s.bg, color:s.tx, fontWeight:700 }}>
                      {s.label}
                    </span>
                  ) : null;
                })()}
                <span style={{ fontSize:13, color:"var(--text-3)" }}>
                  {org.partial_sale_ok ? "✓ Cession partielle acceptée" : "✗ Cession totale uniquement"}
                </span>
              </div>
            </div>
          )}

          {/* Profil acquéreur M&A */}
          {org.organization_type === "buyer" && (
            org.acquisition_rationale || org.target_sectors?.length > 0 || org.target_geographies?.length > 0 || org.target_revenue_min
          ) && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:14 }}>Critères d'acquisition</div>
              {org.acquisition_rationale && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Rationale</div>
                  <p style={{ fontSize:13, color:"var(--text-2)", margin:0, lineHeight:1.6 }}>{org.acquisition_rationale}</p>
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {(org.target_revenue_min || org.target_revenue_max) && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Fourchette CA cible</div>
                    <div style={{ fontSize:13.5, color:"var(--text-1)", fontWeight:600 }}>
                      {fmtRevenue(org.target_revenue_min) ?? "—"} – {fmtRevenue(org.target_revenue_max) ?? "∞"}
                    </div>
                  </div>
                )}
                {org.target_sectors?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Secteurs cibles</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.target_sectors.map((s: string) => (
                        <span key={s} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#EFF6FF", color:"#1D4ED8", fontWeight:600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.excluded_sectors?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Secteurs exclus</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.excluded_sectors.map((s: string) => (
                        <span key={s} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#FEF2F2", color:"#DC2626", fontWeight:600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.target_geographies?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Géographies cibles</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {org.target_geographies.map((g: string) => {
                        const label = GEOGRAPHIES.find(x => x.value === g)?.label ?? g;
                        return <span key={g} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"#ECFEFF", color:"#0E7490", fontWeight:600 }}>{label}</span>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Aucune donnée de profil */}
          {!INVESTOR_TYPES.includes(org.organization_type) &&
           !(org.company_stage || org.revenue_range || org.employee_count || org.founded_year || org.sector) &&
           org.organization_type !== "target" &&
           !(org.organization_type === "buyer" && (org.acquisition_rationale || org.target_sectors?.length > 0)) && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"40px 24px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucune donnée de profil — <Link href={`/protected/organisations/${org.id}/modifier`} style={{ color:"#1a56db" }}>compléter la fiche</Link>
            </div>
          )}
        </div>
      )}

      {/* Onglet Contacts */}
      {tab === "contacts" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {contacts.length === 0 ? (
            <div style={{ padding:"40px 24px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucun contact lié à cette organisation
            </div>
          ) : contacts.map((c, i) => {
            const days = daysSince(c.last_contact_date);
            const needsRelance = days !== null && days > 15;
            return (
              <div key={c.id} style={{
                display:"flex", alignItems:"center", gap:14, padding:"14px 20px",
                borderBottom: i < contacts.length-1 ? "1px solid var(--border)" : "none",
                background: needsRelance ? (days > 30 ? "rgba(220,38,38,.04)" : "rgba(245,158,11,.04)") : "transparent",
              }}>
                {/* Avatar */}
                <div style={{ width:36, height:36, borderRadius:10, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:"var(--text-3)", flexShrink:0 }}>
                  {(c.first_name?.[0] ?? "").toUpperCase()}{(c.last_name?.[0] ?? "").toUpperCase()}
                </div>

                {/* Infos */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14, fontWeight:600, color:"var(--text-1)" }}>
                      {c.first_name} {c.last_name}
                    </span>
                    {c.title && <span style={{ fontSize:12, color:"var(--text-4)" }}>{c.title}</span>}
                    {c.role_label && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"var(--surface-2)", color:"var(--text-4)" }}>{c.role_label}</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:3, flexWrap:"wrap" }}>
                    {c.last_contact_date && (
                      <span style={{ fontSize:11.5, color: days! > 30 ? "var(--rec-tx)" : days! > 15 ? "#B45309" : "var(--text-5)" }}>
                        {days! > 15 ? `⚠ ${days}j sans contact` : `Contact le ${fmtDate(c.last_contact_date)}`}
                      </span>
                    )}
                    <StatusDropdown id={c.id} status={c.base_status} entity="contacts" size="sm"/>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  {c.email && (
                    <a href={`mailto:${c.email}`} title={c.email}
                      style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-3)", textDecoration:"none" }}>
                      <Mail size={13}/>
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} title={c.phone}
                      style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-3)", textDecoration:"none" }}>
                      <Phone size={13}/>
                    </a>
                  )}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noreferrer"
                      style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-3)", textDecoration:"none" }}>
                      <Linkedin size={13}/>
                    </a>
                  )}
                  <Link href={`/protected/contacts/${c.id}`}
                    style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-3)", textDecoration:"none" }}>
                    <ChevronRight size={13}/>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onglet Dossiers */}
      {tab === "dossiers" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {deals.length === 0 ? (
            <div style={{ padding:"40px 24px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucun dossier lié à cette organisation
            </div>
          ) : deals.map((d, i) => (
            <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px",
              borderBottom: i < deals.length-1 ? "1px solid var(--border)" : "none",
              textDecoration:"none", transition:"background .1s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--text-1)" }}>{d.name}</div>
                <div style={{ fontSize:12, color:"var(--text-4)", marginTop:3 }}>
                  {DEAL_TYPE[d.deal_type] ?? d.deal_type} · {d.deal_stage} · {d.deal_status}
                </div>
              </div>
              <ChevronRight size={14} color="var(--text-5)"/>
            </Link>
          ))}
        </div>
      )}

      {/* Onglet Activités */}
      {tab === "activites" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
          {activities.length === 0 ? (
            <div style={{ padding:"40px 24px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
              Aucune activité enregistrée
            </div>
          ) : activities.map((a, i) => (
            <div key={a.id} style={{
              display:"flex", alignItems:"flex-start", gap:12, padding:"14px 20px",
              borderBottom: i < activities.length-1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                {ACT_ICON[a.activity_type] ?? "📌"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{a.title}</div>
                {a.summary && <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>{a.summary}</div>}
              </div>
              <div style={{ fontSize:12, color:"var(--text-5)", flexShrink:0 }}>{fmtDate(a.activity_date)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Onglet Financier */}
      {tab === "financier" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"4px 20px 20px" }}>
          <FinancialTab
            organizationId={org.id}
            initialData={financialData}
          />
        </div>
      )}

      {/* Onglet Mandats */}
      {tab === "mandats" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <Link href={`/protected/mandats/nouveau`}
              style={{ fontSize:12.5, fontWeight:600, color:"var(--text-1)", textDecoration:"none", padding:"7px 14px", borderRadius:9, background:"var(--surface)", border:"1px solid var(--border)" }}>
              + Nouveau mandat
            </Link>
          </div>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            {mandates.length === 0 ? (
              <div style={{ padding:"40px 24px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
                Aucun mandat pour cette organisation
              </div>
            ) : mandates.map((m, i) => {
              const sc = MANDATE_STATUS[m.status] ?? MANDATE_STATUS.draft;
              const fmtAmt = (n: number | null) => {
                if (!n) return "—";
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
                if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} k`;
                return String(n);
              };
              return (
                <Link key={m.id} href={`/protected/mandats/${m.id}`} style={{
                  display:"flex", alignItems:"center", gap:14, padding:"14px 20px",
                  borderBottom: i < mandates.length-1 ? "1px solid var(--border)" : "none",
                  textDecoration:"none", transition:"background .1s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6, background:"var(--surface-2)", color:"var(--text-3)", flexShrink:0 }}>
                    {MANDATE_TYPE_LABELS[m.type] ?? m.type}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"var(--text-1)" }}>{m.name}</div>
                    {m.target_close_date && (
                      <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2 }}>
                        🎯 {fmtDate(m.target_close_date)}
                      </div>
                    )}
                  </div>
                  {m.estimated_fee_amount && (
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", flexShrink:0 }}>
                      {fmtAmt(m.estimated_fee_amount)} {m.currency ?? "EUR"}
                    </div>
                  )}
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:sc.bg, color:sc.tx, flexShrink:0 }}>
                    {m.status === "draft" ? "Brouillon" : m.status === "active" ? "Actif" : m.status === "on_hold" ? "En pause" : m.status === "won" ? "Gagné" : m.status === "lost" ? "Perdu" : "Clôturé"}
                  </span>
                  <ChevronRight size={14} color="var(--text-5)"/>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
