"use client";
import { useState, useCallback, useEffect } from "react";
import { TimeSelect } from "../../components/time-select";
import { LossReasonModal } from "../../components/loss-reason-modal";
import ActionTimeline from "@/components/actions/ActionTimeline";
import ActionModal from "@/components/actions/ActionModal";
import { MandateInlineForm } from "@/components/mandates/MandateInlineForm";
import { getAllMandates, linkMandateToDeal, unlinkMandateFromDeal, getMandateByDealId } from "@/actions/mandates";
import { MatchingTab } from "./matching-tab";
import { MaMatchingTab } from "./ma-matching-tab";
import { RecruitmentKanban } from "./recruitment-kanban";
import { RecruitmentMatching } from "./recruitment-matching";
import { FinancialTab, type FinancialRow } from "./financial-tab";
import { updateDealMatchingProfile } from "@/actions/matching";
import {
  createCommitment, updateCommitment, deleteCommitment,
  linkOrganisationToDeal, unlinkOrganisationFromDeal, updateDealOrgRole,
} from "@/actions/deals";
import { DocumentsTab } from "./documents-tab";
import { TagInput } from "@/components/tags/TagInput";
import { DirigeantSection } from "@/components/dossiers/DirigeantSection";
import { upsertContact, linkContactToOrganisation } from "@/actions/contacts";
import { createOrganisationAction } from "@/actions/organisations";
import { getAllOrganisationsSimple } from "@/actions/organisations";
import { COMPANY_STAGES, GEOGRAPHIES, ROUND_TYPES, DEAL_TIMING_OPTIONS, SENIORITY_OPTIONS, REMOTE_OPTIONS, GEO_LABELS } from "@/lib/crm/matching-maps";
import { GeoSelect } from "@/components/ui/GeoSelect";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, X, ChevronDown, ChevronUp,
  Mail, Phone, Linkedin, Users, User, Building2, TrendingUp,
  FileText, ExternalLink, AlertTriangle, CalendarDays, Briefcase
} from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";

// ── Types ────────────────────────────────────────────────────
type Org = { id:string; name:string; organization_type:string; base_status:string; location?:string; investment_ticket?:string; role_in_dossier?:string; contacts: Contact[] };
type Contact = { id:string; first_name:string; last_name:string; email?:string; phone?:string; title?:string; linkedin_url?:string; base_status:string; last_contact_date?:string; role_label?:string; org_id?:string; org_name?:string };
type Commitment = { id:string; amount?:number; currency:string; status:string; committed_at?:string; notes?:string; organization_id?:string; org_name?:string };
// Les documents sont gérés dans l'onglet Documents (V49) via ma_documents + Supabase Storage.

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
  active:     {bg:"#D1FAE5",          tx:"#065F46"},
  to_qualify: {bg:"var(--surface-3)", tx:"var(--text-4)"},
  inactive:   {bg:"#FEE2E2",          tx:"#991B1B"},
  // Backward compat
  priority:   {bg:"#D1FAE5",          tx:"#065F46"},
  qualified:  {bg:"#D1FAE5",          tx:"#065F46"},
  dormant:    {bg:"var(--surface-3)", tx:"var(--text-4)"},
  excluded:   {bg:"#FEE2E2",          tx:"#991B1B"},
};
const STATUS_L: Record<string,string> = {
  active:"Actif", to_qualify:"Non qualifié", inactive:"Inactif",
  priority:"Actif", qualified:"Actif", dormant:"Non qualifié", excluded:"Inactif",
};
const COMM_S: Record<string,{label:string,bg:string,tx:string}> = {
  indication:{label:"Indication",bg:"var(--surface-3)",tx:"var(--text-4)"},
  soft:{label:"Soft",bg:"#FEF3C7",tx:"#92400E"},
  hard:{label:"Hard",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  signed:{label:"Signé",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  transferred:{label:"Transféré",bg:"var(--fund-bg)",tx:"var(--fund-tx)"},
  cancelled:{label:"Annulé",bg:"var(--rec-bg)",tx:"var(--rec-tx)"},
};
const ROLE_CONFIG: Record<string,{label:string;bg:string;tx:string}> = {
  client:          {label:"Client",           bg:"#D1FAE5", tx:"#065F46"},
  banque:          {label:"Banque",           bg:"#DBEAFE", tx:"#1D4ED8"},
  repreneur:       {label:"Repreneur",        bg:"#EDE9FE", tx:"#5B21B6"},
  investisseur:    {label:"Investisseur",     bg:"#FEF3C7", tx:"#92400E"},
  avocat:          {label:"Cabinet juridique",bg:"#F3F4F6", tx:"#374151"},
  expert_comptable:{label:"Expert-comptable", bg:"#F3F4F6", tx:"#374151"},
  conseil:         {label:"Conseil",          bg:"#F3F4F6", tx:"#374151"},
  cible:           {label:"Cible M&A",        bg:"#FEE2E2", tx:"#991B1B"},
  acquereur:       {label:"Acquéreur",        bg:"#E0E7FF", tx:"#3730A3"},
  autre:           {label:"Autre",            bg:"var(--surface-3)", tx:"var(--text-4)"},
};
const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([v,c])=>({value:v,label:c.label}));

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
  icon:any; title:string; count?:number; expanded:boolean; onToggle:()=>void; onAdd?:()=>void; addLabel?:string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer" }} onClick={onToggle}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Icon size={14} color="var(--text-4)"/>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:".06em" }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize:11.5, background:"var(--surface-3)", color:"var(--text-4)", borderRadius:20, padding:"1px 7px", fontWeight:600 }}>{count}</span>
        )}
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
// Sous-composant : onglet Mandat — vue résumée avec lien vers fiche complète.
// Option B : pas de duplication avec /protected/mandats/[id], juste un résumé
// des informations clés et des 3 prochains jalons à échéance.
function MandateTabContent({
  deal,
  mandate,
  clientOrgs,
  onOpenCreate,
  onOpenLink,
  onOpenUnlink,
}: {
  deal: any;
  mandate: any;
  clientOrgs: { id: string; name: string }[];
  onOpenCreate: () => void;
  onOpenLink: () => void;
  onOpenUnlink: () => void;
}) {
  const MANDATE_TYPE_LABELS: Record<string, string> = {
    fundraising: "Fundraising", ma_sell: "M&A Sell-side", ma_buy: "M&A Buy-side",
    cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
  };
  const STATUS_COLORS: Record<string, { bg: string; tx: string; label: string }> = {
    draft:   { bg: "var(--surface-3)", tx: "var(--text-4)",  label: "Brouillon" },
    active:  { bg: "#D1FAE5",           tx: "#065F46",         label: "Actif" },
    on_hold: { bg: "#FEF3C7",           tx: "#92400E",         label: "En pause" },
    won:     { bg: "#DBEAFE",           tx: "#1E40AF",         label: "Gagné" },
    lost:    { bg: "#FEE2E2",           tx: "#991B1B",         label: "Perdu" },
    closed:  { bg: "var(--surface-3)", tx: "var(--text-5)",   label: "Clos" },
  };

  if (!mandate) {
    return (
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"40px 24px", textAlign:"center" }}>
        <div style={{ fontSize:14, color:"var(--text-3)", marginBottom:6, fontWeight:600 }}>Aucun mandat lié à ce dossier</div>
        <div style={{ fontSize:12.5, color:"var(--text-5)", marginBottom:20 }}>
          Créez un nouveau mandat ou liez-en un existant pour tracer les honoraires et les jalons commerciaux.
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <button type="button" onClick={onOpenCreate} disabled={clientOrgs.length === 0}
            title={clientOrgs.length === 0 ? "Ajoutez d'abord une organisation cliente au dossier" : ""}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", fontWeight:700, fontSize:13, cursor:"pointer", background:"var(--su-500)", color:"#fff", opacity: clientOrgs.length === 0 ? 0.5 : 1 }}>
            + Créer un mandat
          </button>
          <button type="button" onClick={onOpenLink}
            style={{ padding:"9px 20px", borderRadius:8, border:"1px solid var(--border)", fontWeight:600, fontSize:13, cursor:"pointer", background:"transparent", color:"var(--text-2)" }}>
            Lier un mandat existant
          </button>
        </div>
      </div>
    );
  }

  const sc = STATUS_COLORS[mandate.status] ?? STATUS_COLORS.draft;
  const fees = Array.isArray(mandate.fee_milestones) ? mandate.fee_milestones : [];
  const today = new Date().toISOString().split("T")[0];
  const upcomingFees = fees
    .filter((f: any) => f.status !== "paid" && f.status !== "cancelled" && f.due_date && f.due_date >= today)
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);
  const totalEstimated = mandate.estimated_fee_amount ?? 0;
  const totalConfirmed = mandate.confirmed_fee_amount ?? 0;
  const cur = mandate.currency ?? "EUR";

  const fmt = (n: number | null) => n != null ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) : "—";
  const fmtDate = (d: string | null) => d ? new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d)) : "—";

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:18, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:sc.bg, color:sc.tx }}>{sc.label}</span>
            <span style={{ fontSize:11.5, color:"var(--text-5)" }}>{MANDATE_TYPE_LABELS[mandate.type] ?? mandate.type}</span>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:"var(--text-1)", marginBottom:2 }}>{mandate.name}</div>
          {mandate.client_name && (
            <div style={{ fontSize:12.5, color:"var(--text-4)" }}>Client : {mandate.client_name}</div>
          )}
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <Link href={`/protected/mandats/${mandate.id}`}
            style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--border)", fontSize:12.5, fontWeight:600, textDecoration:"none", color:"var(--text-2)", background:"var(--surface-2)", display:"inline-flex", alignItems:"center", gap:5 }}>
            Voir mandat complet →
          </Link>
          <button type="button" onClick={onOpenUnlink}
            style={{ padding:"7px 12px", borderRadius:7, border:"1px solid var(--border)", fontSize:12.5, fontWeight:600, cursor:"pointer", background:"transparent", color:"var(--rec-tx)" }}>
            Délier
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:18 }}>
        <div style={{ background:"var(--surface-2)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Fee estimé</div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>{fmt(totalEstimated)} {cur}</div>
        </div>
        <div style={{ background:"var(--surface-2)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Fee confirmé</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#065F46" }}>{fmt(totalConfirmed)} {cur}</div>
        </div>
        <div style={{ background:"var(--surface-2)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Début</div>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-2)" }}>{fmtDate(mandate.start_date)}</div>
        </div>
        <div style={{ background:"var(--surface-2)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Closing cible</div>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-2)" }}>{fmtDate(mandate.target_close_date)}</div>
        </div>
      </div>

      {/* Prochains jalons */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:10 }}>
          Prochains jalons ({fees.length} au total)
        </div>
        {upcomingFees.length === 0 ? (
          <div style={{ fontSize:12.5, color:"var(--text-5)" }}>Aucun jalon à échéance. Gérez les jalons depuis la fiche mandat complète.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {upcomingFees.map((f: any) => (
              <div key={f.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--surface-2)", borderRadius:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{f.name}</div>
                  <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{f.milestone_type} · {fmtDate(f.due_date)}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-2)" }}>{fmt(f.amount)} {f.currency ?? cur}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      {mandate.description && (
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, marginTop:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>Description</div>
          <div style={{ fontSize:13, color:"var(--text-3)", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{mandate.description}</div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export function DealDetail({ deal, initialOrgs, initialContacts, initialCommitments, initialFinancialData, initialMandate }: {
  deal: any;
  initialOrgs: Org[];
  initialContacts: Contact[];
  initialCommitments: Commitment[];
  initialFinancialData: FinancialRow[];
  initialMandate: any;
}) {
  // State sections
  const [orgs, setOrgs] = useState<Org[]>(initialOrgs);
  const [allOrgs, setAllOrgs] = useState<{id:string;name:string}[]>([]);
  const [orgSearchOpen, setOrgSearchOpen] = useState(false);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [orgLinking, setOrgLinking] = useState(false);
  const [orgCreateOpen, setOrgCreateOpen] = useState(false);
  const [orgCreateName, setOrgCreateName] = useState("");
  const [orgCreateType, setOrgCreateType] = useState("other");
  const [orgCreateWebsite, setOrgCreateWebsite] = useState("");
  const [orgCreateLocation, setOrgCreateLocation] = useState("");
  const [orgLinkRole, setOrgLinkRole] = useState("autre");

  // Charger toutes les orgs CRM (pour le sélecteur dans Engagement)
  useEffect(() => {
    getAllOrganisationsSimple().then(orgs => setAllOrgs(orgs)).catch(() => {});
  }, []);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments);

  // Expanded sections
  const [expOrgs, setExpOrgs] = useState(true);
  const [expOrg, setExpOrg] = useState<Record<string,boolean>>({});
  const [expPipeline, setExpPipeline] = useState(true);
  const [expSpecs, setExpSpecs] = useState(true);

  // Modals
  const [modal, setModal] = useState<string|null>(null);
  const [showLossModal, setShowLossModal] = useState(false);
  // ActionModal depuis onglets (MatchingTab, etc.)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalContext, setActionModalContext] = useState<{ deal_id: string; organization_id?: string }>({ deal_id: deal.id });
  const [actionModalDefaultType, setActionModalDefaultType] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({});

  const [activeTab, setActiveTab] = useState<"dossier" | "mandat" | "matching" | "matching_ma" | "pipeline" | "matching_rh" | "financier" | "documents">("dossier");
  const [matchingRefreshKey, setMatchingRefreshKey] = useState(0);

  // Mandat — state et handlers
  const [mandate, setMandate] = useState<any>(initialMandate);
  const [mandateFormOpen, setMandateFormOpen] = useState(false);
  const [linkMandateOpen, setLinkMandateOpen] = useState(false);
  const [allMandatesForLink, setAllMandatesForLink] = useState<any[]>([]);
  const [selectedMandateToLink, setSelectedMandateToLink] = useState<string>("");
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [mandateActionLoading, setMandateActionLoading] = useState(false);

  async function reloadMandate() {
    const m = await getMandateByDealId(deal.id);
    setMandate(m);
  }

  async function handleMandateCreated() {
    await reloadMandate();
  }

  async function openLinkMandateModal() {
    if (allMandatesForLink.length === 0) {
      const list = await getAllMandates();
      setAllMandatesForLink(list);
    }
    setSelectedMandateToLink("");
    setLinkMandateOpen(true);
  }

  async function handleLinkMandate() {
    if (!selectedMandateToLink) return;
    setMandateActionLoading(true);
    const r = await linkMandateToDeal(deal.id, selectedMandateToLink);
    setMandateActionLoading(false);
    if (r.success) {
      setLinkMandateOpen(false);
      await reloadMandate();
    } else {
      alert(r.error ?? "Erreur lors de la liaison");
    }
  }

  async function handleUnlinkMandate() {
    setMandateActionLoading(true);
    const r = await unlinkMandateFromDeal(deal.id);
    setMandateActionLoading(false);
    if (r.success) {
      setUnlinkConfirmOpen(false);
      setMandate(null);
    } else {
      alert(r.error ?? "Erreur lors du déliement");
    }
  }

  // Matching profile inline edit
  const [matchingEditOpen, setMatchingEditOpen] = useState(false);
  const [matchingStage, setMatchingStage] = useState<string>(deal.company_stage ?? "");
  const [matchingGeo, setMatchingGeo] = useState<string>(deal.company_geography ?? "");
  const [matchingSaving, setMatchingSaving] = useState(false);

  const dt = DT[deal.deal_type] ?? DT.fundraising;
  const isFundraising  = deal.deal_type === "fundraising";
  const isRecruitment  = deal.deal_type === "recruitment";
  const isMa           = deal.deal_type === "ma_sell" || deal.deal_type === "ma_buy";
  const target = deal.target_amount ?? 0;
  const hard = commitments.filter(c=>["hard","signed","transferred"].includes(c.status)).reduce((s,c)=>s+(c.amount??0),0);
  const soft = commitments.filter(c=>["soft","hard","signed","transferred"].includes(c.status)).reduce((s,c)=>s+(c.amount??0),0);
  const pct = target > 0 ? Math.min(100, Math.round(hard/target*100)) : 0;

  const setF = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p=>({...p,[k]:e.target.value}));
  const openModal = (name:string, data?:any) => { setModal(name); setEditing(data??null); setForm(data ? {...data, amount:data.amount??"", committed_at:toDateStr(data.committed_at), due_date:toDateStr(data.due_date), activity_date:toDateStr(data.activity_date), organization_id:data.organization_id??""} : {}); };
  const closeModal = () => { setModal(null); setEditing(null); setForm({}); };

  // ── PIPELINE CRUD ──────────────────────────────────────────
  async function saveCommitment() {
    setLoading(true);
    try {
      const payload = {
        organization_id: form.organization_id || null,
        amount:          form.amount ? Number(form.amount) : null,
        currency:        form.currency || "EUR",
        status:          form.status || "indication",
        committed_at:    form.committed_at || null,
        notes:           form.notes || null,
      };
      if (editing) {
        const r = await updateCommitment(deal.id, editing.id, payload);
        if (!r.success) throw new Error(r.error);
        const orgName = Array.isArray(r.data?.organizations)?r.data.organizations[0]?.name:(r.data?.organizations as any)?.name;
        setCommitments(p=>p.map(c=>c.id===editing.id?{...r.data!,org_name:orgName}:c));
      } else {
        const r = await createCommitment(deal.id, payload);
        if (!r.success) throw new Error(r.error);
        const orgName = Array.isArray(r.data?.organizations)?r.data.organizations[0]?.name:(r.data?.organizations as any)?.name;
        setCommitments(p=>[...p,{...r.data!,org_name:orgName}]);
      }
      closeModal();
    } catch(e:any){ alert(e.message); } finally { setLoading(false); }
  }
  async function handleDeleteCommitment(id:string) {
    if (!confirm("Supprimer cet engagement ?")) return;
    const r = await deleteCommitment(deal.id, id);
    if (!r.success) { alert(r.error); return; }
    setCommitments(p=>p.filter(c=>c.id!==id));
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
              <div style={{ marginTop:10 }}><TagInput objectType="deal" objectId={deal.id} /></div>
            </div>
            <Link href={`/protected/dossiers/${deal.id}/modifier`} style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500, whiteSpace:"nowrap" }}>Modifier</Link>
          </div>
        </div>

        {/* Tabs — tous les dossiers ont au moins Dossier + Financier */}
        <div style={{ display:"flex", gap:2, marginBottom:14, borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
          {(isFundraising
            ? (["dossier","mandat","matching","financier","documents"] as const)
            : isRecruitment
            ? (["dossier","mandat","pipeline","matching_rh","documents"] as const)
            : isMa
            ? (["dossier","mandat","matching_ma","financier","documents"] as const)
            : (["dossier","mandat","financier","documents"] as const)
          ).map(tab => {
            const labels: Record<string, string> = {
              dossier:"Dossier", mandat:"Mandat", matching:"Matching", matching_ma:"Matching M&A",
              pipeline:"Pipeline", matching_rh:"Matching vivier", financier:"Financier",
              documents:"Documents",
            };
            const accentColor = isFundraising ? "var(--fund-tx)" : isRecruitment ? "var(--rec-tx)" : isMa ? "var(--sell-tx)" : "var(--sell-tx)";
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={()=>{
                setActiveTab(tab as typeof activeTab);
                if (tab === "matching") setMatchingRefreshKey(k => k + 1);
              }} style={{
                padding:"8px 16px", border:"none", background:"none", cursor:"pointer",
                fontSize:13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--text-1)" : "var(--text-4)",
                borderBottom: isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                marginBottom:-1, fontFamily:"inherit",
              }}>
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Onglet Financier */}
        {activeTab === "financier" && (
          <FinancialTab
            dealId={deal.id}
            dealType={deal.deal_type}
            initialData={initialFinancialData}
          />
        )}

        {/* Onglet Documents — Dataroom intégré V49 */}
        {activeTab === "documents" && (
          <DocumentsTab dealId={deal.id} dealName={deal.name} />
        )}

        {/* Onglet Matching (fundraising) */}
        {isFundraising && activeTab === "matching" && (
          <MatchingTab
            dealId={deal.id}
            refreshKey={matchingRefreshKey}
            onCreateActivity={(orgId) => {
              setActionModalContext({ deal_id: deal.id, organization_id: orgId });
              setActionModalDefaultType("email");
              setActionModalOpen(true);
            }}
          />
        )}

        {/* Onglet Matching M&A */}
        {isMa && activeTab === "matching_ma" && (
          <MaMatchingTab
            dealId={deal.id}
            dealType={deal.deal_type as "ma_sell" | "ma_buy"}
          />
        )}

        {/* Onglet Pipeline (recruitment) */}
        {isRecruitment && activeTab === "pipeline" && (
          <RecruitmentKanban dealId={deal.id} />
        )}

        {/* Onglet Matching vivier (recruitment) */}
        {isRecruitment && activeTab === "matching_rh" && (
          <RecruitmentMatching dealId={deal.id} />
        )}

        {/* Onglet Mandat — vue résumée + lien vers fiche mandat complète */}
        {activeTab === "mandat" && (
          <MandateTabContent
            deal={deal}
            mandate={mandate}
            clientOrgs={orgs.map((o: any) => ({ id: o.id, name: o.name }))}
            onOpenCreate={() => setMandateFormOpen(true)}
            onOpenLink={openLinkMandateModal}
            onOpenUnlink={() => setUnlinkConfirmOpen(true)}
          />
        )}

        {/* Layout 2 colonnes — strictement sur l'onglet Dossier pour tous les types.
            Les autres onglets (Mandat, Matching*, Pipeline RH, Financier) sont
            full-width autonomes, sans sidebar Dirigeant/Orgs/Actions/Docs. */}
        {activeTab === "dossier" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>

          {/* ── Colonne gauche ── */}
          <div>

            {/* DIRIGEANT */}
            <div style={cardStyle}>
              <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:8 }}>
                <User size={14} color="var(--text-4)"/>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:".06em" }}>Dirigeant</span>
              </div>
              <DirigeantSection
                dealId={deal.id}
                initial={{
                  dirigeant_id: deal.dirigeant_id ?? null,
                  dirigeant_nom: deal.dirigeant_nom ?? null,
                  dirigeant_email: deal.dirigeant_email ?? null,
                  dirigeant_telephone: deal.dirigeant_telephone ?? null,
                  dirigeant_titre: deal.dirigeant_titre ?? null,
                }}
              />
            </div>

            {/* ORGANISATIONS + CONTACTS */}
            <div style={cardStyle}>
              <SectionHeader icon={Building2} title="Organisations & Contacts" count={orgs.length} expanded={expOrgs} onToggle={()=>setExpOrgs(p=>!p)} onAdd={()=>openModal("add_contact")} addLabel="Contact"/>

              {/* Ajouter une organisation */}
              {expOrgs && (
                <div style={{ padding:"8px 16px", borderTop:"1px solid var(--border)" }}>
                  {!orgSearchOpen ? (
                    <button onClick={()=>{setOrgSearchOpen(true);setOrgSearchQuery("")}} style={{ fontSize:12.5, color:"var(--text-3)", background:"none", border:"1px dashed var(--border)", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontWeight:500, width:"100%" }}>
                      + Lier une organisation
                    </button>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <input
                          autoFocus
                          placeholder="Rechercher une organisation…"
                          value={orgSearchQuery}
                          onChange={e=>setOrgSearchQuery(e.target.value)}
                          style={{ flex:1, padding:"7px 12px", border:"1px solid var(--border)", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", background:"var(--surface-2)", color:"var(--text-1)" }}
                        />
                        <button onClick={()=>setOrgSearchOpen(false)} style={{ padding:"6px 10px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", cursor:"pointer", color:"var(--text-4)", fontFamily:"inherit", fontSize:12 }}>✕</button>
                      </div>
                      {orgSearchQuery.trim().length >= 2 && (
                        <div style={{ maxHeight:200, overflowY:"auto", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)" }}>
                          {allOrgs
                            .filter(o => o.name.toLowerCase().includes(orgSearchQuery.toLowerCase()) && !orgs.some(existing => existing.id === o.id))
                            .slice(0, 8)
                            .map(o => (
                              <button key={o.id} disabled={orgLinking} onClick={async ()=>{
                                setOrgLinking(true);
                                const res = await linkOrganisationToDeal(deal.id, o.id);
                                if (res.success) {
                                  setOrgs(prev => [...prev, { id:o.id, name:o.name, organization_type:"other", base_status:"active", contacts:[] }]);
                                  setOrgSearchOpen(false);
                                  setOrgSearchQuery("");
                                }
                                setOrgLinking(false);
                              }} style={{ display:"block", width:"100%", padding:"8px 12px", textAlign:"left", border:"none", borderBottom:"1px solid var(--border)", background:"none", cursor:"pointer", fontSize:13, color:"var(--text-1)", fontFamily:"inherit" }}>
                                {o.name}
                              </button>
                            ))}
                          {allOrgs.filter(o => o.name.toLowerCase().includes(orgSearchQuery.toLowerCase()) && !orgs.some(existing => existing.id === o.id)).length === 0 && (
                            <div style={{ padding:"10px 12px" }}>
                              <div style={{ fontSize:12.5, color:"var(--text-5)", marginBottom:6 }}>Aucun résultat pour &quot;{orgSearchQuery}&quot;</div>
                              <button onClick={()=>{ setOrgCreateOpen(true); setOrgCreateName(orgSearchQuery); setOrgCreateType("other"); setOrgCreateWebsite(""); setOrgCreateLocation(""); }} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", border:"1px solid var(--border)", borderRadius:7, background:"var(--surface-2)", color:"var(--su-500,#1a56db)", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                                <Plus size={11}/> Créer &quot;{orgSearchQuery}&quot;
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Inline org creation */}
                      {orgCreateOpen && (
                        <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:12, background:"var(--surface-2)", marginTop:6 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:"var(--text-2)", marginBottom:8 }}>Nouvelle organisation</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                            <div>
                              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-4)", marginBottom:3 }}>NOM *</label>
                              <input value={orgCreateName} onChange={e=>setOrgCreateName(e.target.value)} style={{ width:"100%", padding:"6px 10px", border:"1px solid var(--border)", borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none", background:"var(--surface)", color:"var(--text-1)", boxSizing:"border-box" }}/>
                            </div>
                            <div>
                              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-4)", marginBottom:3 }}>TYPE *</label>
                              <select value={orgCreateType} onChange={e=>setOrgCreateType(e.target.value)} style={{ width:"100%", padding:"6px 10px", border:"1px solid var(--border)", borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none", background:"var(--surface)", color:"var(--text-1)", boxSizing:"border-box" }}>
                                <option value="investor">Investisseur</option>
                                <option value="business_angel">Business Angel</option>
                                <option value="family_office">Family Office</option>
                                <option value="corporate">Corporate / CVC</option>
                                <option value="bank">Banque</option>
                                <option value="client">Client</option>
                                <option value="buyer">Repreneur</option>
                                <option value="law_firm">Cabinet juridique</option>
                                <option value="accounting_firm">Cabinet comptable</option>
                                <option value="consulting_firm">Conseil</option>
                                <option value="other">Autre</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-4)", marginBottom:3 }}>SITE WEB</label>
                              <input value={orgCreateWebsite} onChange={e=>setOrgCreateWebsite(e.target.value)} placeholder="https://..." style={{ width:"100%", padding:"6px 10px", border:"1px solid var(--border)", borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none", background:"var(--surface)", color:"var(--text-1)", boxSizing:"border-box" }}/>
                            </div>
                            <div>
                              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--text-4)", marginBottom:3 }}>LOCALISATION</label>
                              <GeoSelect mode="single" value={orgCreateLocation || null} onChange={v => setOrgCreateLocation(v ?? "")} placeholder="— Non renseignée —" />
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                            <button onClick={()=>setOrgCreateOpen(false)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid var(--border)", background:"var(--surface)", cursor:"pointer", fontSize:12, color:"var(--text-3)", fontFamily:"inherit" }}>Annuler</button>
                            <button disabled={!orgCreateName.trim() || orgLinking} onClick={async ()=>{
                              setOrgLinking(true);
                              const res = await createOrganisationAction({
                                name: orgCreateName.trim(),
                                organization_type: orgCreateType,
                                base_status: "to_qualify",
                                website: orgCreateWebsite.trim() || null,
                                location: orgCreateLocation.trim() || null,
                                linkedin_url: null, description: null, notes: null,
                                investor_ticket_min: null, investor_ticket_max: null,
                                investor_sectors: [], investor_stages: [],
                                investor_geographies: [], investor_thesis: null,
                                sector: null, founded_year: null, employee_count: null,
                                company_stage: null, revenue_range: null,
                                sale_readiness: null, partial_sale_ok: true,
                                acquisition_rationale: null, target_sectors: [],
                                excluded_sectors: [], target_geographies: [],
                                target_revenue_min: null, target_revenue_max: null,
                              });
                              if (res.success && res.id) {
                                await linkOrganisationToDeal(deal.id, res.id);
                                setOrgs(prev => [...prev, { id:res.id!, name:orgCreateName.trim(), organization_type:orgCreateType, base_status:"to_qualify", contacts:[] }]);
                                setOrgCreateOpen(false);
                                setOrgSearchOpen(false);
                                setOrgSearchQuery("");
                              }
                              setOrgLinking(false);
                            }} style={{ padding:"5px 12px", borderRadius:7, border:"none", background:"var(--su-500,#1a56db)", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", opacity: orgLinking ? 0.6 : 1 }}>
                              {orgLinking ? "..." : "Créer et lier"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <Link href={`/protected/organisations/${org.id}`} onClick={e=>e.stopPropagation()} style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", textDecoration:"none" }}>{org.name}</Link>
                          {(() => { const rc = ROLE_CONFIG[org.role_in_dossier ?? "autre"] ?? ROLE_CONFIG.autre; return (
                            <select value={org.role_in_dossier ?? "autre"} onClick={e=>e.stopPropagation()} onChange={async (e) => {
                              const newRole = e.target.value;
                              setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, role_in_dossier: newRole } : o));
                              await updateDealOrgRole(deal.id, org.id, newRole);
                            }} style={{ fontSize:10.5, fontWeight:600, padding:"2px 6px", borderRadius:12, background:rc.bg, color:rc.tx, border:"none", cursor:"pointer", fontFamily:"inherit", appearance:"auto" }}>
                              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ); })()}
                          <span style={{ fontSize:11, padding:"2px 7px", borderRadius:20, background:sc.bg, color:sc.tx }}>{STATUS_L[org.base_status]??org.base_status}</span>
                          {org.investment_ticket && <span style={{ fontSize:11, color:"var(--text-5)" }}>{org.investment_ticket}</span>}
                        </div>
                        {org.location && <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:1 }}>{org.location}</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                        <StatusDropdown id={org.id} status={org.base_status} entity="organisations" size="sm"/>
                        <button onClick={async (e)=>{
                          e.stopPropagation();
                          if (!confirm(`Délier ${org.name} de ce dossier ?`)) return;
                          const res = await unlinkOrganisationFromDeal(deal.id, org.id);
                          if (res.success) setOrgs(prev => prev.filter(o => o.id !== org.id));
                        }} style={{ width:22, height:22, borderRadius:6, border:"1px solid var(--border)", background:"var(--surface-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-5)", fontSize:11 }} title="Délier cette organisation">
                          <X size={10}/>
                        </button>
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

            {/* SPÉCIFICITÉS MISSION — dépend du deal_type, saisies au wizard */}
            <SpecificsCard deal={deal} expanded={expSpecs} onToggle={()=>setExpSpecs(p=>!p)}/>

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
                            <button onClick={()=>handleDeleteCommitment(c.id)} style={{...actionBtn, color:"var(--rec-tx)"}}><Trash2 size={11}/></button>
                          </div>
                        </div>
                      );
                    })}
                    {commitments.length===0 && <div style={{ padding:"20px 16px", fontSize:13, color:"var(--text-5)", borderTop:"1px solid var(--border)", textAlign:"center" }}>Aucun engagement</div>}
                  </>
                )}
              </div>
            )}

            {/* PROFIL POUR MATCHING — fundraising uniquement */}
            {isFundraising && (
              <div style={cardStyle}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <TrendingUp size={14} color="var(--text-4)"/>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", textTransform:"uppercase", letterSpacing:".06em" }}>Profil matching</span>
                  </div>
                  <button onClick={()=>setMatchingEditOpen(p=>!p)} style={{ padding:"4px 10px", border:"1px solid var(--border)", borderRadius:7, background:"var(--surface-2)", color:"var(--text-3)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    {matchingEditOpen ? "Annuler" : "Modifier"}
                  </button>
                </div>
                {!matchingEditOpen ? (
                  <div style={{ padding:"10px 16px 14px", borderTop:"1px solid var(--border)", display:"flex", gap:16, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-5)", textTransform:"uppercase", marginBottom:3 }}>Stade</div>
                      <div style={{ fontSize:13, color:"var(--text-2)" }}>
                        {COMPANY_STAGES.find(s=>s.value===deal.company_stage)?.label ?? <span style={{ color:"var(--text-5)" }}>—</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-5)", textTransform:"uppercase", marginBottom:3 }}>Géographie</div>
                      <div style={{ fontSize:13, color:"var(--text-2)" }}>
                        {GEOGRAPHIES.find(g=>g.value===deal.company_geography)?.label ?? <span style={{ color:"var(--text-5)" }}>—</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-5)", textTransform:"uppercase", marginBottom:3 }}>Secteur</div>
                      <div style={{ fontSize:13, color:"var(--text-2)" }}>{deal.sector ?? <span style={{ color:"var(--text-5)" }}>—</span>}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:"var(--text-5)", textTransform:"uppercase", marginBottom:3 }}>Montant cible</div>
                      <div style={{ fontSize:13, color:"var(--text-2)" }}>{target > 0 ? fmtA(target, deal.currency) : <span style={{ color:"var(--text-5)" }}>—</span>}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:"12px 16px 14px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:12 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5 }}>Stade</label>
                        <select value={matchingStage} onChange={e=>setMatchingStage(e.target.value)} style={sel}>
                          <option value="">— Non renseigné —</option>
                          {COMPANY_STAGES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:"var(--text-4)", marginBottom:5 }}>Géographie</label>
                        <select value={matchingGeo} onChange={e=>setMatchingGeo(e.target.value)} style={sel}>
                          <option value="">— Non renseignée —</option>
                          {GEOGRAPHIES.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <BtnPrimary loading={matchingSaving} onClick={async ()=>{
                        setMatchingSaving(true);
                        const res = await updateDealMatchingProfile(deal.id, {
                          company_stage:     matchingStage || null,
                          company_geography: matchingGeo   || null,
                        });
                        setMatchingSaving(false);
                        if (res.success) {
                          deal.company_stage     = matchingStage     || null;
                          deal.company_geography = matchingGeo       || null;
                          setMatchingEditOpen(false);
                          setMatchingRefreshKey(k => k + 1);
                        }
                      }}>Enregistrer</BtnPrimary>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Colonne droite ── */}
          <div>

            {/* ACTIONS — timeline unifiée (tâches, appels, meetings, emails, notes, deadlines, documents) */}
            <div style={{ ...cardStyle, padding: "16px 18px" }}>
              <ActionTimeline filters={{ deal_id: deal.id }} showCreateButton={true} />
            </div>

            {/* Documents — désormais dans l'onglet dédié "Documents" (V49) */}

          </div>
        </div>
        )}
      </div>

      {/* ═══ MODALES ═══════════════════════════════════════════ */}

      {/* Engagement */}
      {modal==="commitment" && (
        <Modal title={editing?"Modifier l'engagement":"Nouvel engagement"} onClose={closeModal}>
          <Field label="Organisation">
            <select style={sel} value={form.organization_id||""} onChange={setF("organization_id")}>
              <option value="">— Choisir —</option>
              {allOrgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
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
                const cu = await upsertContact({ first_name:form.first_name||"", last_name:form.last_name||"", email:form.email||null });
                if (!cu.success) throw new Error(cu.error);
                await linkContactToOrganisation(cu.id, orgId, form.role_label||undefined);
                const org = orgs.find(o=>o.id===orgId);
                setContacts(p=>[...p,{ id:cu.id, first_name:form.first_name, last_name:form.last_name, email:form.email, base_status:"to_qualify", org_id:orgId, org_name:org?.name }]);
                closeModal();
              } catch(e:any){ alert(e.message); } finally { setLoading(false); }
            }} loading={loading}>Ajouter</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Modal Document supprimée (V49) — ajout via l'onglet Documents dédié. */}

      {/* ActionModal — déclenchée depuis MatchingTab pour créer une action ciblant un investisseur */}
      <ActionModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        onSaved={() => setActionModalOpen(false)}
        defaultType={actionModalDefaultType}
        context={actionModalContext}
      />

      {/* MandateInlineForm — création mandat depuis onglet Mandat */}
      <MandateInlineForm
        open={mandateFormOpen}
        dealId={deal.id}
        dealName={deal.name ?? ""}
        clientOrgs={orgs.map((o: any) => ({ id: o.id, name: o.name }))}
        defaultType={deal.deal_type}
        onClose={() => setMandateFormOpen(false)}
        onCreated={handleMandateCreated}
      />

      {/* Modale — lier un mandat existant */}
      {linkMandateOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setLinkMandateOpen(false)}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <span style={{ fontSize:16, fontWeight:700, color:"var(--text-1)" }}>Lier un mandat existant</span>
              <button onClick={() => setLinkMandateOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--text-4)", fontSize:18 }}>✕</button>
            </div>
            {allMandatesForLink.length === 0 ? (
              <div style={{ padding:"20px 0", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
                Aucun mandat disponible. Créez-en un d'abord.
              </div>
            ) : (
              <>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-4)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Mandat à lier</label>
                <select value={selectedMandateToLink} onChange={e => setSelectedMandateToLink(e.target.value)}
                  style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:16 }}>
                  <option value="">— Sélectionner —</option>
                  {allMandatesForLink.map((m:any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.type} · {m.status}{m.client_name ? ` · ${m.client_name}` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button type="button" onClick={() => setLinkMandateOpen(false)}
                style={{ padding:"9px 22px", borderRadius:8, border:"1px solid var(--border)", fontWeight:600, fontSize:13.5, cursor:"pointer", background:"transparent", color:"var(--text-3)" }}>
                Annuler
              </button>
              <button type="button" onClick={handleLinkMandate}
                disabled={!selectedMandateToLink || mandateActionLoading}
                style={{ padding:"9px 22px", borderRadius:8, border:"none", fontWeight:700, fontSize:13.5, cursor:"pointer", background:"var(--su-500)", color:"#fff", opacity: (!selectedMandateToLink || mandateActionLoading) ? 0.6 : 1 }}>
                {mandateActionLoading ? "Liaison..." : "Lier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale — confirmation déliement */}
      {unlinkConfirmOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setUnlinkConfirmOpen(false)}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)", marginBottom:10 }}>Délier le mandat ?</div>
            <div style={{ fontSize:13.5, color:"var(--text-3)", marginBottom:20, lineHeight:1.5 }}>
              Le mandat <strong>{mandate?.name}</strong> restera existant mais ne sera plus lié à ce dossier.
              Les fee_milestones du mandat ne seront pas affectés.
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button type="button" onClick={() => setUnlinkConfirmOpen(false)}
                style={{ padding:"9px 22px", borderRadius:8, border:"1px solid var(--border)", fontWeight:600, fontSize:13.5, cursor:"pointer", background:"transparent", color:"var(--text-3)" }}>
                Annuler
              </button>
              <button type="button" onClick={handleUnlinkMandate} disabled={mandateActionLoading}
                style={{ padding:"9px 22px", borderRadius:8, border:"none", fontWeight:700, fontSize:13.5, cursor:"pointer", background:"#b91c1c", color:"#fff", opacity: mandateActionLoading ? 0.6 : 1 }}>
                {mandateActionLoading ? "Déliement..." : "Délier"}
              </button>
            </div>
          </div>
        </div>
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

// ─── SpecificsCard — affichage read-only des champs spécifiques par deal_type ──
// Contenu saisi via le wizard de création (V44). Read-only ici.
// L'édition repasse aujourd'hui par /modifier (refactor à venir — wizard edit).

type SpecDeal = {
  deal_type: string;
  currency: string | null;
  target_amount: number | null;
  // Fundraising
  target_raise_amount: number | null;
  pre_money_valuation: number | null;
  post_money_valuation: number | null;
  round_type: string | null;
  runway_months: number | null;
  use_of_funds: string | null;
  current_investors: string[] | null;
  // M&A Sell
  asking_price_min: number | null;
  asking_price_max: number | null;
  partial_sale_ok: boolean | null;
  management_retention: boolean | null;
  management_retention_notes: string | null;
  deal_timing: string | null;
  // M&A Buy
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_geographies: string[] | null;
  excluded_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ev_min: number | null;
  target_ev_max: number | null;
  target_stage: string | null;
  acquisition_budget_min: number | null;
  acquisition_budget_max: number | null;
  full_acquisition_required: boolean | null;
  strategic_rationale: string | null;
  // Recruitment
  job_title: string | null;
  required_seniority: string | null;
  required_location: string | null;
  required_remote: string | null;
  salary_min: number | null;
  salary_max: number | null;
};

function hasAnySpec(deal: SpecDeal): boolean {
  switch (deal.deal_type) {
    case "fundraising":
      return !!(deal.target_raise_amount || deal.pre_money_valuation || deal.post_money_valuation
        || deal.round_type || deal.runway_months || deal.use_of_funds
        || (deal.current_investors && deal.current_investors.length > 0));
    case "ma_sell":
      return !!(deal.target_amount || deal.asking_price_min || deal.asking_price_max
        || deal.management_retention_notes || deal.deal_timing
        || deal.management_retention !== null || deal.partial_sale_ok !== null);
    case "ma_buy":
      return !!((deal.target_sectors && deal.target_sectors.length > 0)
        || (deal.excluded_sectors && deal.excluded_sectors.length > 0)
        || (deal.target_geographies && deal.target_geographies.length > 0)
        || (deal.excluded_geographies && deal.excluded_geographies.length > 0)
        || deal.target_revenue_min || deal.target_revenue_max
        || deal.target_ev_min || deal.target_ev_max || deal.target_stage
        || deal.acquisition_budget_min || deal.acquisition_budget_max
        || deal.full_acquisition_required || deal.strategic_rationale || deal.deal_timing);
    case "recruitment":
      return !!(deal.job_title || deal.required_seniority || deal.required_location
        || deal.required_remote || deal.salary_min || deal.salary_max);
    default:
      return false;
  }
}

function SpecificsCard({ deal, expanded, onToggle }: {
  deal: SpecDeal; expanded: boolean; onToggle: () => void;
}) {
  if (!hasAnySpec(deal)) return null;

  const title =
    deal.deal_type === "fundraising" ? "Spécificités levée" :
    deal.deal_type === "ma_sell" ? "Spécificités cession" :
    deal.deal_type === "ma_buy" ? "Critères acquisition" :
    deal.deal_type === "recruitment" ? "Fiche de poste" :
    "Spécificités";

  const cardStyle: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", marginBottom:10 };

  return (
    <div style={cardStyle}>
      <SectionHeader icon={Briefcase} title={title} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:10 }}>
          {deal.deal_type === "fundraising" && <FundraisingSpecs deal={deal} />}
          {deal.deal_type === "ma_sell" && <MaSellSpecs deal={deal} />}
          {deal.deal_type === "ma_buy" && <MaBuySpecs deal={deal} />}
          {deal.deal_type === "recruitment" && <RecruitmentSpecs deal={deal} />}
        </div>
      )}
    </div>
  );
}

// ── Helpers rendu ─────────────────────────────────────────────────────────────

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"140px 1fr", gap:12, alignItems:"baseline" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
      <div style={{ fontSize:13, color:"var(--text-1)" }}>{children}</div>
    </div>
  );
}

function Chips({ values }: { values: string[] }) {
  if (!values || values.length === 0) return <span style={{ color:"var(--text-5)" }}>—</span>;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
      {values.map(v => (
        <span key={v} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-2)", fontWeight:500 }}>
          {v}
        </span>
      ))}
    </div>
  );
}

function GeoChips({ values }: { values: string[] }) {
  if (!values || values.length === 0) return <span style={{ color:"var(--text-5)" }}>—</span>;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
      {values.map(v => (
        <span key={v} style={{ fontSize:11.5, padding:"2px 8px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-2)", fontWeight:500 }}>
          {GEO_LABELS[v] ?? v}
        </span>
      ))}
    </div>
  );
}

function rangeFmt(min: number | null, max: number | null, currency: string | null): string | null {
  if (!min && !max) return null;
  const c = currency ?? "EUR";
  const fm = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}k` : `${n}`;
  if (min && max) return `${fm(min)} – ${fm(max)} ${c}`;
  if (min) return `≥ ${fm(min)} ${c}`;
  if (max) return `≤ ${fm(max)} ${c}`;
  return null;
}

// ── Specs par type ────────────────────────────────────────────────────────────

function FundraisingSpecs({ deal }: { deal: SpecDeal }) {
  const c = deal.currency ?? "EUR";
  const fm = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M ${c}` : n >= 1e3 ? `${(n/1e3).toFixed(0)}k ${c}` : `${n} ${c}`;
  return (
    <>
      {deal.target_raise_amount !== null && (
        <SpecRow label="Montant cible">{fm(deal.target_raise_amount)}</SpecRow>
      )}
      {deal.round_type && (
        <SpecRow label="Type de round">{ROUND_TYPES.find(r => r.value === deal.round_type)?.label ?? deal.round_type}</SpecRow>
      )}
      {(deal.pre_money_valuation !== null || deal.post_money_valuation !== null) && (
        <SpecRow label="Valorisation">
          {deal.pre_money_valuation !== null && <span>Pre : <strong>{fm(deal.pre_money_valuation)}</strong></span>}
          {deal.pre_money_valuation !== null && deal.post_money_valuation !== null && <span style={{ margin:"0 8px" }}>·</span>}
          {deal.post_money_valuation !== null && <span>Post : <strong>{fm(deal.post_money_valuation)}</strong></span>}
        </SpecRow>
      )}
      {deal.runway_months !== null && (
        <SpecRow label="Runway">{deal.runway_months} mois</SpecRow>
      )}
      {deal.use_of_funds && (
        <SpecRow label="Utilisation">{deal.use_of_funds}</SpecRow>
      )}
      {deal.current_investors && deal.current_investors.length > 0 && (
        <SpecRow label="Investisseurs actuels"><Chips values={deal.current_investors} /></SpecRow>
      )}
    </>
  );
}

function MaSellSpecs({ deal }: { deal: SpecDeal }) {
  const c = deal.currency ?? "EUR";
  const fm = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M ${c}` : n >= 1e3 ? `${(n/1e3).toFixed(0)}k ${c}` : `${n} ${c}`;
  const askingRange = rangeFmt(deal.asking_price_min, deal.asking_price_max, deal.currency);
  return (
    <>
      {deal.target_amount !== null && (
        <SpecRow label="Valorisation cible">{fm(deal.target_amount)}</SpecRow>
      )}
      {askingRange && (
        <SpecRow label="Asking price">{askingRange}</SpecRow>
      )}
      {deal.deal_timing && (
        <SpecRow label="Timing">{DEAL_TIMING_OPTIONS.find(t => t.value === deal.deal_timing)?.label ?? deal.deal_timing}</SpecRow>
      )}
      {deal.partial_sale_ok !== null && (
        <SpecRow label="Cession partielle">{deal.partial_sale_ok ? "Acceptée" : "Refusée"}</SpecRow>
      )}
      {deal.management_retention !== null && (
        <SpecRow label="Rétention management">{deal.management_retention ? "Le management reste" : "Le management part"}</SpecRow>
      )}
      {deal.management_retention_notes && (
        <SpecRow label="Conditions / earn-out">{deal.management_retention_notes}</SpecRow>
      )}
    </>
  );
}

function MaBuySpecs({ deal }: { deal: SpecDeal }) {
  const revRange = rangeFmt(deal.target_revenue_min, deal.target_revenue_max, deal.currency);
  const evRange = rangeFmt(deal.target_ev_min, deal.target_ev_max, deal.currency);
  const budgetRange = rangeFmt(deal.acquisition_budget_min, deal.acquisition_budget_max, deal.currency);
  return (
    <>
      {deal.target_sectors && deal.target_sectors.length > 0 && (
        <SpecRow label="Secteurs cibles"><Chips values={deal.target_sectors} /></SpecRow>
      )}
      {deal.excluded_sectors && deal.excluded_sectors.length > 0 && (
        <SpecRow label="Secteurs exclus"><Chips values={deal.excluded_sectors} /></SpecRow>
      )}
      {deal.target_geographies && deal.target_geographies.length > 0 && (
        <SpecRow label="Géos cibles"><GeoChips values={deal.target_geographies} /></SpecRow>
      )}
      {deal.excluded_geographies && deal.excluded_geographies.length > 0 && (
        <SpecRow label="Géos exclues"><GeoChips values={deal.excluded_geographies} /></SpecRow>
      )}
      {revRange && (
        <SpecRow label="Revenue cible">{revRange}</SpecRow>
      )}
      {evRange && (
        <SpecRow label="EV cible">{evRange}</SpecRow>
      )}
      {budgetRange && (
        <SpecRow label="Budget acquisition">{budgetRange}</SpecRow>
      )}
      {deal.target_stage && (
        <SpecRow label="Stade cible">{COMPANY_STAGES.find(s => s.value === deal.target_stage)?.label ?? deal.target_stage}</SpecRow>
      )}
      {deal.deal_timing && (
        <SpecRow label="Timing">{DEAL_TIMING_OPTIONS.find(t => t.value === deal.deal_timing)?.label ?? deal.deal_timing}</SpecRow>
      )}
      {deal.full_acquisition_required !== null && deal.full_acquisition_required && (
        <SpecRow label="Acquisition"><strong style={{ color:"var(--rec-tx)" }}>100% requis (deal breaker)</strong></SpecRow>
      )}
      {deal.strategic_rationale && (
        <SpecRow label="Rationale">{deal.strategic_rationale}</SpecRow>
      )}
    </>
  );
}

function RecruitmentSpecs({ deal }: { deal: SpecDeal }) {
  const c = deal.currency ?? "EUR";
  const salaryRange = (() => {
    if (!deal.salary_min && !deal.salary_max) return null;
    if (deal.salary_min && deal.salary_max) return `${deal.salary_min.toLocaleString("fr-FR")} – ${deal.salary_max.toLocaleString("fr-FR")} ${c}`;
    if (deal.salary_min) return `≥ ${deal.salary_min.toLocaleString("fr-FR")} ${c}`;
    if (deal.salary_max) return `≤ ${deal.salary_max.toLocaleString("fr-FR")} ${c}`;
    return null;
  })();
  return (
    <>
      {deal.job_title && <SpecRow label="Poste">{deal.job_title}</SpecRow>}
      {deal.required_seniority && (
        <SpecRow label="Séniorité">{SENIORITY_OPTIONS.find(s => s.value === deal.required_seniority)?.label ?? deal.required_seniority}</SpecRow>
      )}
      {deal.required_remote && (
        <SpecRow label="Remote">{REMOTE_OPTIONS.find(r => r.value === deal.required_remote)?.label ?? deal.required_remote}</SpecRow>
      )}
      {deal.required_location && (
        <SpecRow label="Localisation">{GEO_LABELS[deal.required_location] ?? deal.required_location}</SpecRow>
      )}
      {salaryRange && (
        <SpecRow label="Salaire">{salaryRange}</SpecRow>
      )}
    </>
  );
}

