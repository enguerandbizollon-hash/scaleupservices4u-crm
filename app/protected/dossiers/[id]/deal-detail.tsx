"use client";
import { useState, useCallback, useEffect } from "react";
import { TimeSelect } from "../../components/time-select";
import { LossReasonModal } from "../../components/loss-reason-modal";
import ActionTimeline from "@/components/actions/ActionTimeline";
import ActionModal from "@/components/actions/ActionModal";
// MatchingTab (investisseurs) : supprimé, logique intégrée au SourcingWizard (S4).
// MaMatchingTab : remonté en onglet Acquéreurs (phase 3, scoring V2).
import { MaMatchingTab } from "./ma-matching-tab";
import { BuyMandateTargets } from "@/components/dossiers/BuyMandateTargets";
import { CadragePanel } from "@/components/dossiers/CadragePanel";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { CockpitSynthese } from "./cockpit-synthese";
import type { ActionnaireNormalise } from "@/lib/connectors/pappers";
import { FinancialTab, type FinancialRow } from "./financial-tab";
import {
  linkOrganisationToDeal, unlinkOrganisationFromDeal, updateDealOrgRole,
  updateDealOrganizationStage, setDealClientOrganization,
  updateDealField, deleteDeal, markMandateSigned, unmarkMandateSigned,
} from "@/actions/deals";
import { EditableField } from "@/components/ui/EditableField";
import { DocumentsTab } from "./documents-tab";
import { TagInput } from "@/components/tags/TagInput";
import { DirigeantSection } from "@/components/dossiers/DirigeantSection";
import { DealOverviewBlock } from "@/components/dossiers/DealOverviewBlock";
import { FeesTab, type FeeRow } from "@/components/dossiers/FeesTab";
import { DealHealthBadge } from "@/components/dossiers/DealHealthBadge";
import { StagePlaybook } from "@/components/dossiers/StagePlaybook";
import { ScreeningSection } from "@/components/dossiers/ScreeningSection";
import { BuyQualificationSection } from "@/components/dossiers/BuyQualificationSection";
import { BuyBudgetTab } from "@/components/dossiers/BuyBudgetTab";
import { SourcingWizard } from "@/components/dossiers/SourcingWizard";
import { computeDealHealth } from "@/lib/crm/health-score";
import type { SuggestionWithRelations } from "@/lib/crm/suggestions";
import { isScreeningReady } from "@/lib/crm/matching-maps";
import { upsertContact, linkContactToOrganisation } from "@/actions/contacts";
import { createOrganisationAction } from "@/actions/organisations";
import { getAllOrganisationsSimple } from "@/actions/organisations";
import { ORG_COMPANY_STAGES, DEAL_TIMING_OPTIONS, DEAL_CONTEXTS, stageLabel } from "@/lib/crm/matching-maps";
import { geoLabel } from "@/lib/crm/geo-match";
import { organizationTypeLabels, ORG_TYPE_SELECT_ORDER, dealTypeLabels, roleInDossierLabels } from "@/lib/crm/labels";
import { GeoSelect } from "@/components/ui/GeoSelect";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, X, ChevronDown, ChevronUp,
  Mail, Phone, Linkedin, Users, User, Building2,
  FileText, ExternalLink, AlertTriangle, CalendarDays, Briefcase
} from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";
import { EntityDrawer, type EntityRef } from "@/components/ui/EntityDrawer";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────
type Org = { id:string; name:string; organization_type:string; base_status:string; location?:string; investment_ticket?:string; role_in_dossier?:string; contacts: Contact[] };
type Contact = { id:string; first_name:string; last_name:string; email?:string; phone?:string; title?:string; linkedin_url?:string; base_status:string; last_contact_date?:string; role_label?:string; org_id?:string; org_name?:string };
// Les documents sont gérés dans l'onglet Documents (V49) via ma_documents + Supabase Storage.

// ── Helpers ──────────────────────────────────────────────────
const DT: Record<string,{bg:string;tx:string;border:string}> = {
  ma_sell:{bg:"var(--sell-bg)",tx:"var(--sell-tx)",border:"var(--sell-mid)"},
  ma_buy:{bg:"var(--buy-bg)",tx:"var(--buy-tx)",border:"var(--buy-mid)"},
};
const TYPE_LABELS = dealTypeLabels;
// V55 : libellés unifiés via stageLabel() depuis matching-maps. Map gardée
// vide pour éviter toute référence oubliée (remplacée une à une).
const STAGE_LABELS: Record<string,string> = {};
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
// Labels depuis la source unique (roleInDossierLabels), couleurs locales.
const ROLE_CONFIG: Record<string,{label:string;bg:string;tx:string}> = {
  client:          {label:roleInDossierLabels.client,           bg:"#D1FAE5", tx:"#065F46"},
  banque:          {label:roleInDossierLabels.banque,           bg:"#DBEAFE", tx:"#1D4ED8"},
  repreneur:       {label:roleInDossierLabels.repreneur,        bg:"#EDE9FE", tx:"#5B21B6"},
  investisseur:    {label:roleInDossierLabels.investisseur,     bg:"#FEF3C7", tx:"#92400E"},
  avocat:          {label:roleInDossierLabels.avocat,           bg:"#F3F4F6", tx:"#374151"},
  expert_comptable:{label:roleInDossierLabels.expert_comptable, bg:"#F3F4F6", tx:"#374151"},
  conseil:         {label:roleInDossierLabels.conseil,          bg:"#F3F4F6", tx:"#374151"},
  cible:           {label:roleInDossierLabels.cible,            bg:"#FEE2E2", tx:"#991B1B"},
  acquereur:       {label:roleInDossierLabels.acquereur,        bg:"#E0E7FF", tx:"#3730A3"},
  autre:           {label:roleInDossierLabels.autre,            bg:"var(--surface-3)", tx:"var(--text-4)"},
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
// Statut du dossier, éditable depuis l'en-tête (retour terrain 2026-07-31 :
// « je n'ai plus de possibilité de changer », le statut n'était accessible
// que par la page Modifier). Pilote les listes : en cours, en pause, gagné,
// perdu. updateDealField valide déjà deal_status côté serveur.
const DEAL_STATUS_OPTIONS: Array<{ value: string; label: string; bg: string; tx: string }> = [
  { value: "open",   label: "En cours", bg: "#D1FAE5",          tx: "#065F46" },
  { value: "paused", label: "En pause", bg: "#FEF3C7",          tx: "#92400E" },
  { value: "won",    label: "Gagné",    bg: "#DBEAFE",          tx: "#1E40AF" },
  { value: "lost",   label: "Perdu",    bg: "var(--surface-3)", tx: "var(--text-5)" },
];

function DealStatusSelect({ dealId, initial, onChanged }: { dealId: string; initial: string; onChanged: () => void }) {
  const [current, setCurrent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const meta = DEAL_STATUS_OPTIONS.find(o => o.value === current) ?? DEAL_STATUS_OPTIONS[0];

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const prev = current;
    setCurrent(value);
    setSaving(true);
    const res = await updateDealField(dealId, "deal_status", value);
    setSaving(false);
    if (!res.success) {
      setCurrent(prev);
      alert(`Statut non modifié : ${res.error}`);
      return;
    }
    onChanged();
  }

  return (
    <select value={current} onChange={handleChange} disabled={saving}
      title="Statut du dossier : En cours / En pause / Gagné / Perdu"
      style={{ padding:"8px 12px", borderRadius:9, border:"1px solid var(--border)", background:meta.bg, color:meta.tx, fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", outline:"none", opacity: saving ? 0.6 : 1 }}>
      {DEAL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Porte de signature (v75) : un dossier naît « en préparation » (pré-mandat).
// Ce contrôle le fait passer en « signé » (et inversement, misclick réversible).
// Distinct de deal_status (ouvert/pause/gagné/perdu) : on peut être signé ET
// en cours, ou en préparation ET perdu (mandat non décroché).
function MandateSignatureControl({ dealId, initial, onChanged }: { dealId: string; initial: string | null; onChanged: () => void }) {
  const [signedAt, setSignedAt] = useState<string | null>(initial);
  const [saving, setSaving] = useState(false);

  async function sign() {
    setSaving(true);
    const res = await markMandateSigned(dealId);
    setSaving(false);
    if (!res.success) { alert(`Non enregistré : ${res.error}`); return; }
    setSignedAt(new Date().toISOString());
    onChanged();
  }
  async function unsign() {
    if (!confirm("Repasser ce mandat en « préparation » (non signé) ?")) return;
    setSaving(true);
    const res = await unmarkMandateSigned(dealId);
    setSaving(false);
    if (!res.success) { alert(`Non enregistré : ${res.error}`); return; }
    setSignedAt(null);
    onChanged();
  }

  if (signedAt) {
    const d = new Intl.DateTimeFormat("fr-FR", { day:"numeric", month:"short", year:"numeric" }).format(new Date(signedAt));
    return (
      <button type="button" onClick={unsign} disabled={saving}
        title="Mandat signé. Cliquer pour le repasser en préparation."
        style={{ padding:"8px 14px", borderRadius:9, background:"#D1FAE5", border:"1px solid #065F46", color:"#065F46", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", opacity: saving ? 0.6 : 1 }}>
        ✓ Mandat signé le {d}
      </button>
    );
  }
  return (
    <button type="button" onClick={sign} disabled={saving}
      title="Ce dossier est en préparation (pré-mandat). Le marquer signé le fait entrer dans les mandats signés."
      style={{ padding:"8px 14px", borderRadius:9, background:"var(--surface-2)", border:"1px dashed var(--text-4)", color:"var(--text-3)", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", opacity: saving ? 0.6 : 1 }}>
      Marquer le mandat signé
    </button>
  );
}

export function DealDetail({ deal, initialOrgs, initialContacts, initialFinancialData, initialFees, initialClientOrganization, initialSuggestions, initialTab }: {
  deal: any;
  initialOrgs: Org[];
  initialContacts: Contact[];
  initialFinancialData: FinancialRow[];
  initialFees: FeeRow[];
  initialClientOrganization: { id: string; name: string; company_stage: string | null; organization_type: string | null; is_client: boolean; actionnariat?: ActionnaireNormalise[] | null } | null;
  initialSuggestions: SuggestionWithRelations[];
  initialTab?: string | null;
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

  // Expanded sections
  const [expOrgs, setExpOrgs] = useState(true);
  const [expOrg, setExpOrg] = useState<Record<string,boolean>>({});
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

  // Onglets adressables par URL (?tab=acquereurs) : le matching et chaque
  // espace du dossier deviennent partageables (favori, notification, lien).
  type TabKey = "dossier" | "screening" | "acquereurs" | "sourcing" | "honoraires" | "financier" | "documents";
  const validTabs: string[] = [
    "dossier", "honoraires", "financier", "screening", "documents",
    ...(deal.deal_type === "ma_sell" || deal.deal_type === "ma_buy" ? ["sourcing"] : []),
    ...(deal.deal_type === "ma_sell" ? ["acquereurs"] : []),
  ];
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && validTabs.includes(initialTab) ? (initialTab as TabKey) : "dossier",
  );
  // replaceState (shallow) : l'URL suit l'onglet sans refetch serveur.
  // Garde validTabs : un appelant (cockpit, renvoi) ne peut pas ouvrir un
  // pane qui n'existe pas pour ce type de dossier.
  const openTab = (tab: TabKey) => {
    if (!validTabs.includes(tab)) return;
    setActiveTab(tab);
    window.history.replaceState(null, "", `/protected/dossiers/${deal.id}${tab === "dossier" ? "" : `?tab=${tab}`}`);
  };

  // Drawer latéral pour entités liées (contacts, organisations)
  const [drawerEntity, setDrawerEntity] = useState<EntityRef>(null);

  const router = useRouter();

  // V54 : organisation cliente (sujet du dossier). Affichage en lecture seule
  // dans le header. L'édition de la taille se fait sur la fiche organisation
  // pour éviter la superposition (la taille est une propriété de l'org,
  // pas du dossier).
  const clientOrg = initialClientOrganization;
  const clientOrgStageLabel = clientOrg?.company_stage
    ? ORG_COMPANY_STAGES.find(s => s.value === clientOrg.company_stage)?.label ?? null
    : null;

  // Fix V54 legacy : dossiers créés avant V54 sans organisation cliente.
  // On permet de rattacher une org existante directement depuis le bandeau.
  const [linkClientOrgId, setLinkClientOrgId] = useState<string>("");
  const [linkingClientOrg, setLinkingClientOrg] = useState(false);
  const [linkClientError, setLinkClientError] = useState<string | null>(null);
  const handleLinkClientOrg = async () => {
    if (!linkClientOrgId) return;
    setLinkingClientOrg(true);
    setLinkClientError(null);
    const res = await setDealClientOrganization(deal.id, linkClientOrgId);
    setLinkingClientOrg(false);
    if (!res.success) {
      setLinkClientError(res.error);
      return;
    }
    window.location.reload();
  };

  const dt = DT[deal.deal_type] ?? DT.ma_sell;
  const isMa           = deal.deal_type === "ma_sell" || deal.deal_type === "ma_buy";

  const setF = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p=>({...p,[k]:e.target.value}));
  const openModal = (name:string, data?:any) => { setModal(name); setEditing(data??null); setForm(data ? {...data, amount:data.amount??"", committed_at:toDateStr(data.committed_at), due_date:toDateStr(data.due_date), activity_date:toDateStr(data.activity_date), organization_id:data.organization_id??""} : {}); };
  const closeModal = () => { setModal(null); setEditing(null); setForm({}); };

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
              <div style={{ display:"flex", gap:7, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:11.5, fontWeight:700, borderRadius:7, padding:"3px 10px", background:dt.bg, color:dt.tx, border:`1px solid ${dt.border}` }}>{TYPE_LABELS[deal.deal_type]??deal.deal_type}</span>
                <span style={{ fontSize:11.5, fontWeight:600, borderRadius:7, padding:"3px 10px", background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>{stageLabel(deal.deal_stage)}</span>
                <DealHealthBadge
                  health={computeDealHealth(deal, {
                    has_financial_data: (initialFinancialData?.length ?? 0) > 0,
                    has_fees_estimated: !!((deal.estimated_fee_amount && deal.estimated_fee_amount > 0) || (deal.success_fee_percent && deal.success_fee_percent > 0)),
                    linked_orgs_count: orgs.length,
                  })}
                  size="md"
                />
                {deal.target_date && <span style={{ fontSize:11.5, color:"var(--text-5)", padding:"3px 8px" }}>🎯 {fmt(deal.target_date)}</span>}
              </div>
              {deal.code && (
                <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-4)", letterSpacing:".05em", fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", marginBottom:4 }}>
                  {deal.code}
                </div>
              )}
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"var(--text-1)" }}>{deal.name}</h1>
              {deal.description && <p style={{ margin:"6px 0 0", fontSize:13, color:"var(--text-4)", lineHeight:1.5, maxWidth:600 }}>{deal.description}</p>}

              {/* V54 : bloc client (lecture seule). La taille d'entreprise
                  s'édite sur la fiche organisation, pas ici. */}
              {clientOrg && (
                <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11.5, fontWeight:700, padding:"3px 10px", background:"#D1FAE5", color:"#065F46", border:"1px solid #6EE7B7", borderRadius:6 }}>
                    Client
                  </span>
                  <Link href={`/protected/organisations/${clientOrg.id}`} style={{ fontSize:13, fontWeight:600, color:"var(--text-2)", textDecoration:"none" }}>
                    {clientOrg.name}
                  </Link>
                  {clientOrgStageLabel && (
                    <>
                      <span style={{ color:"var(--text-5)", fontSize:12 }}>·</span>
                      <span style={{ fontSize:12, color:"var(--text-4)" }}>{clientOrgStageLabel}</span>
                    </>
                  )}
                </div>
              )}
              {!clientOrg && (
                <div style={{ marginTop:10, fontSize:12, padding:"8px 12px", background:"#FEF3C7", border:"1px solid #FCD34D", color:"#92400E", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", maxWidth:700 }}>
                  <AlertTriangle size={13}/>
                  <span>Dossier sans organisation cliente. Rattache-la :</span>
                  <select
                    value={linkClientOrgId}
                    onChange={e => setLinkClientOrgId(e.target.value)}
                    disabled={linkingClientOrg}
                    style={{ flex:1, minWidth:180, padding:"5px 8px", fontSize:12, border:"1px solid var(--border)", background:"#fff", color:"var(--text-1)", fontFamily:"inherit" }}
                  >
                    <option value="">— Choisir —</option>
                    {allOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button
                    onClick={handleLinkClientOrg}
                    disabled={!linkClientOrgId || linkingClientOrg}
                    style={{ padding:"5px 12px", fontSize:12, fontWeight:600, background:"#065F46", color:"#fff", border:"none", cursor: linkClientOrgId && !linkingClientOrg ? "pointer" : "not-allowed", fontFamily:"inherit" }}
                  >
                    {linkingClientOrg ? "…" : "Rattacher"}
                  </button>
                  {linkClientError && <span style={{ width:"100%", color:"#991B1B" }}>{linkClientError}</span>}
                </div>
              )}

              <div style={{ marginTop:10 }}><TagInput objectType="deal" objectId={deal.id} /></div>
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
              <DealStatusSelect dealId={deal.id} initial={deal.deal_status ?? "open"} onChanged={() => router.refresh()} />
              <MandateSignatureControl dealId={deal.id} initial={deal.mandate_signed_at ?? null} onChanged={() => router.refresh()} />
              {deal.deal_type === "ma_sell" && (
                <>
                  <a
                    href={`/protected/dossiers/${deal.id}/teaser`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Teaser anonymisé du dossier (généré par l'IA, contrôlé par vous)"
                    style={{ padding:"8px 16px", borderRadius:9, background:"#0F766E", border:"1px solid #0F766E", fontSize:13, color:"#fff", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}
                  >
                    Teaser
                  </a>
                  <a
                    href={`/protected/dossiers/${deal.id}/im`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Information Memorandum nominatif (post-NDA, projections incluses, généré par l'IA, contrôlé par vous)"
                    style={{ padding:"8px 16px", borderRadius:9, background:"#192348", border:"1px solid #192348", fontSize:13, color:"#fff", textDecoration:"none", fontWeight:600, whiteSpace:"nowrap" }}
                  >
                    IM
                  </a>
                  <a
                    href={`/protected/dossiers/${deal.id}/liste-acquereurs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Liste d'acquéreurs scorée, imprimable, toujours à jour"
                    style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500, whiteSpace:"nowrap" }}
                  >
                    Liste acquéreurs
                  </a>
                </>
              )}
              <a
                href={`/protected/dossiers/${deal.id}/export?print=1`}
                target="_blank"
                rel="noopener noreferrer"
                title="Aperçu PDF imprimable de la synthèse dossier"
                style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500, whiteSpace:"nowrap" }}
              >
                Exporter PDF
              </a>
              <Link href={`/protected/dossiers/${deal.id}/modifier`} style={{ padding:"8px 16px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-2)", textDecoration:"none", fontWeight:500, whiteSpace:"nowrap" }}>Modifier</Link>
              <button
                onClick={async () => {
                  if (!confirm(`Supprimer définitivement le dossier « ${deal.name} » ?\nJalons d'honoraires, liaisons et documents rattachés seront supprimés.`)) return;
                  const res = await deleteDeal(deal.id);
                  if (res.success) {
                    router.push("/protected/dossiers");
                  } else {
                    alert(`Suppression impossible : ${res.error ?? "erreur inconnue"}`);
                  }
                }}
                title="Supprimer le dossier"
                style={{ padding:"8px 12px", borderRadius:9, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"#991B1B", cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6 }}
              >
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        </div>

        {/* Cockpit de synthèse (Deal OS) : où en est ce deal, en 5 secondes */}
        <CockpitSynthese
          deal={deal}
          financialData={initialFinancialData}
          suggestions={initialSuggestions}
          clientOrg={initialClientOrganization}
          onOpenMarket={() => openTab(deal.deal_type === "ma_sell" ? "acquereurs" : "sourcing")}
        />

        {/* Espaces de travail — Deal OS : 3 moments au lieu de 7 onglets à plat */}
        {(() => {
          type PaneKey = typeof activeTab;
          const espaces: { key: string; label: string; panes: { key: PaneKey; label: string }[] }[] = [
            {
              // Buy-side : pas d'entreprise sujette unique. Le « Financier »
              // devient le budget du repreneur, le « Screening » sa qualification.
              key: "cible", label: "L'affaire", panes: [
                { key: "financier", label: deal.deal_type === "ma_buy" ? "Budget" : "Financier" },
                { key: "screening", label: deal.deal_type === "ma_buy" ? "Qualification" : "Screening" },
                { key: "documents", label: "Documents" },
              ],
            },
            ...(isMa ? [{
              key: "marche", label: "Marché", panes: [
                ...(deal.deal_type === "ma_sell" ? [{ key: "acquereurs" as PaneKey, label: "Acquéreurs" }] : []),
                // Buy-side : le "sourcing" EST la recherche de cibles.
                { key: "sourcing" as PaneKey, label: deal.deal_type === "ma_buy" ? "Cibles" : "Sourcing" },
              ],
            }] : []),
            {
              key: "execution", label: "Exécution", panes: [
                { key: "dossier", label: "Dossier" },
                { key: "honoraires", label: "Honoraires" },
              ],
            },
          ];
          const activeEspace = espaces.find(e => e.panes.some(p => p.key === activeTab)) ?? espaces[espaces.length - 1];
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)" }}>
                {espaces.map(e => {
                  const isActive = e.key === activeEspace.key;
                  return (
                    <button key={e.key} onClick={() => openTab(e.panes[0].key)} style={{
                      padding: "8px 18px", border: "none", background: "none", cursor: "pointer",
                      fontSize: 13.5, fontWeight: isActive ? 800 : 500,
                      color: isActive ? "var(--text-1)" : "var(--text-4)",
                      borderBottom: isActive ? "2px solid var(--sell-tx)" : "2px solid transparent",
                      marginBottom: -1, fontFamily: "inherit",
                    }}>
                      {e.label}
                    </button>
                  );
                })}
              </div>
              {activeEspace.panes.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                  {activeEspace.panes.map(p => {
                    const isActive = activeTab === p.key;
                    return (
                      <button key={p.key} onClick={() => openTab(p.key)} style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                        border: "1px solid var(--border)",
                        background: isActive ? "var(--text-1)" : "var(--surface-2)",
                        color: isActive ? "var(--bg)" : "var(--text-3)",
                      }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Onglet Financier / Budget. Acquisition : pas d'entreprise sujette,
            la grille P&L laisse place au budget du repreneur. */}
        {activeTab === "financier" && deal.deal_type === "ma_buy" && (
          <BuyBudgetTab
            dealId={deal.id}
            budgetMin={deal.acquisition_budget_min ?? null}
            budgetMax={deal.acquisition_budget_max ?? null}
            revenueMin={deal.target_revenue_min ?? null}
            revenueMax={deal.target_revenue_max ?? null}
            onOpenPane={openTab}
          />
        )}
        {activeTab === "financier" && deal.deal_type !== "ma_buy" && (
          <FinancialTab
            dealId={deal.id}
            dealType={deal.deal_type}
            currency={deal.currency ?? "EUR"}
            initialData={initialFinancialData}
            initialAi={{
              ai_financial_score: deal.ai_financial_score ?? null,
              ai_valuation_low: deal.ai_valuation_low ?? null,
              ai_valuation_high: deal.ai_valuation_high ?? null,
              ai_financial_notes: deal.ai_financial_notes ?? null,
              ai_analyzed_at: deal.ai_analyzed_at ?? null,
              ai_score_growth: deal.ai_score_growth ?? null,
              ai_score_margin: deal.ai_score_margin ?? null,
              ai_score_balance: deal.ai_score_balance ?? null,
              ai_score_comparables: deal.ai_score_comparables ?? null,
              ai_anomalies: deal.ai_anomalies ?? null,
            }}
          />
        )}

        {/* Onglet Documents — Dataroom intégré V49 */}
        {activeTab === "documents" && (
          <DocumentsTab dealId={deal.id} dealName={deal.name} />
        )}

        {/* Onglets Matching et Matching M&A : supprimés (V56 Sourcing unifié).
            La logique scoring réseau interne (ma-scoring, matching algo) est
            intégrée comme source dans executeSourcingPlanAction. */}

        {/* Onglet Screening / Qualification — le dossier doit être qualifié
            avant ouverture vers l'extérieur (V53). Cession : screening de
            l'entreprise. Acquisition : qualification du projet du repreneur. */}
        {activeTab === "screening" && (
          deal.deal_type === "ma_buy"
            ? <BuyQualificationSection dealId={deal.id} onOpenPane={openTab} />
            : <ScreeningSection dealId={deal.id} />
        )}

        {/* Onglet Acquéreurs — classement de la base par la grille V2 (phase 3) */}
        {activeTab === "acquereurs" && deal.deal_type === "ma_sell" && (
          <MaMatchingTab dealId={deal.id} dealType="ma_sell" />
        )}

        {/* Onglet Sourcing / Cibles. Acquisition : UN seul moteur, le pipeline
            cadrage -> chasse -> cibles (le SourcingWizard de cession, doublon
            gated par le screening sell, n'y est plus rendu). */}
        {activeTab === "sourcing" && (
          <>
            {deal.deal_type === "ma_buy" && <CadragePanel dealId={deal.id} initialCadrage={(deal.cadrage_content ?? null) as CadrageContent | null} />}
            {deal.deal_type === "ma_buy" && <BuyMandateTargets dealId={deal.id} />}
            {deal.deal_type === "ma_sell" && (
              <SourcingWizard
                dealId={deal.id}
                screeningReady={isScreeningReady(deal.screening_status)}
                initialSuggestions={initialSuggestions}
                initialPlan={(deal.sourcing_plan_json ?? null) as Parameters<typeof SourcingWizard>[0]["initialPlan"]}
                initialPlanGeneratedAt={deal.sourcing_plan_generated_at ?? null}
                initialPlanSource={deal.sourcing_plan_source ?? null}
                initialUrlsToConsult={deal.sourcing_urls_to_consult ?? []}
              />
            )}
          </>
        )}

        {/* Onglet Honoraires — économie du dossier (fusion mandats, temps 5) */}
        {activeTab === "honoraires" && (
          <FeesTab deal={deal} initialFees={initialFees} />
        )}

        {/* Layout 2 colonnes — strictement sur l'onglet Dossier pour tous les types.
            Les autres onglets (Mandat, Matching*, Pipeline RH, Financier) sont
            full-width autonomes, sans sidebar Dirigeant/Orgs/Actions/Docs. */}
        {activeTab === "dossier" && (
        <>
        {/* Vue d'ensemble — KPIs métier en première lecture. Les honoraires
            sont lus directement sur le deal (fusion mandats, v65). */}
        <DealOverviewBlock
          deal={deal}
          financialData={initialFinancialData}
        />

        {/* Playbook actions recommandées par stade */}
        <StagePlaybook dealId={deal.id} dealType={deal.deal_type} dealStage={deal.deal_stage} />

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
                organizationId={clientOrg?.id ?? deal.organization_id ?? undefined}
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
                                {ORG_TYPE_SELECT_ORDER.map(t => <option key={t} value={t}>{organizationTypeLabels[t]}</option>)}
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
                          <button type="button" onClick={(e)=>{ e.stopPropagation(); setDrawerEntity({ type:"organization", id: org.id }); }} style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>{org.name}</button>
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
                              <button type="button" onClick={()=>setDrawerEntity({ type:"contact", id: c.id })} style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>{c.first_name} {c.last_name}</button>
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
            <SpecificsCard deal={deal} dealId={deal.id} expanded={expSpecs} onToggle={()=>setExpSpecs(p=>!p)}/>

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
        </>
        )}
      </div>

      {/* ═══ MODALES ═══════════════════════════════════════════ */}

      {/* Ajouter contact — picker unifié (recherche + création) */}
      {modal==="add_contact" && (
        <Modal title="Ajouter un contact" onClose={closeModal}>
          {orgs.length === 0 ? (
            <div style={{ padding:"12px 0 4px", color:"var(--text-5)", fontSize:13.5, lineHeight:1.55 }}>
              Ajoute d'abord une organisation au dossier pour pouvoir y rattacher un contact.
            </div>
          ) : (
            <>
              <Field label="Organisation cible">
                {orgs.length === 1 ? (
                  <div style={{ padding:"9px 12px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text-1)", display:"flex", alignItems:"center", gap:7 }}>
                    <Building2 size={13} color="var(--text-4)"/>{orgs[0].name}
                  </div>
                ) : (
                  <select style={sel} value={form.org_id || ""} onChange={(e) => setForm((p) => ({ ...p, org_id: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {orgs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                  </select>
                )}
              </Field>
              <Field label="Rôle dans l'organisation (optionnel)">
                <input
                  style={inp}
                  placeholder="ex : Gérant, DG, DAF, Expert-comptable."
                  value={form.role_label || ""}
                  onChange={setF("role_label")}
                />
              </Field>
              <Field label="Contact (rechercher ou créer)">
                <EntityPicker
                  entityType="contact"
                  excludeIds={contacts
                    .filter((c) => c.org_id === (orgs.length === 1 ? orgs[0].id : form.org_id))
                    .map((c) => c.id)}
                  onPicked={async (contactId) => {
                    const orgId = orgs.length === 1 ? orgs[0].id : form.org_id;
                    if (!orgId) { alert("Choisis d'abord une organisation."); return; }
                    const r = await linkContactToOrganisation(contactId, orgId, form.role_label || undefined);
                    if (!r.success) { alert(r.error); return; }
                    closeModal();
                    router.refresh();
                  }}
                />
              </Field>
              <div style={{ fontSize:11.5, color:"var(--text-5)", marginTop:6, lineHeight:1.5 }}>
                Astuce : tape un nom existant pour le retrouver, ou un nouveau nom pour créer un contact en un clic.
              </div>
            </>
          )}
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

      {/* Drawer latéral pour fiches contact/organisation liées */}
      <EntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
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
  // M&A Sell
  asking_price_min: number | null;
  asking_price_max: number | null;
  partial_sale_ok: boolean | null;
  management_retention: boolean | null;
  management_retention_notes: string | null;
  deal_timing: string | null;
  deal_context?: string | null;
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
};

function hasAnySpec(deal: SpecDeal): boolean {
  switch (deal.deal_type) {
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
    default:
      return false;
  }
}

function SpecificsCard({ deal, dealId, expanded, onToggle }: {
  deal: SpecDeal; dealId: string; expanded: boolean; onToggle: () => void;
}) {
  const title =
    deal.deal_type === "ma_sell" ? "Spécificités cession" :
    deal.deal_type === "ma_buy" ? "Critères acquisition" :
    "Spécificités";

  const cardStyle: React.CSSProperties = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden", marginBottom:10 };

  return (
    <div style={cardStyle}>
      <SectionHeader icon={Briefcase} title={title} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:10 }}>
          {deal.deal_type === "ma_sell" && <MaSellSpecs deal={deal} dealId={dealId} />}
          {deal.deal_type === "ma_buy" && <MaBuySpecs deal={deal} dealId={dealId} />}
        </div>
      )}
    </div>
  );
}

// ── EditableSpec — wrapper local édition inline d'un champ deal ─────────────
// Combine EditableField + updateDealField. State local pour persister la
// valeur entre saves sans refetch complet. Erreurs en alert basique.
function EditableSpec({
  dealId, field, initialValue, type = "text", placeholder, formatter, selectOptions,
}: {
  dealId: string;
  field: string;
  initialValue: string | number | null | undefined;
  type?: "text" | "number" | "date";
  placeholder?: string;
  formatter?: (v: string | number | null) => string;
  selectOptions?: { value: string; label: string }[];
}) {
  const [value, setValue] = useState<string | number | null>(initialValue ?? null);
  return (
    <EditableField
      value={value}
      type={type}
      placeholder={placeholder}
      formatter={formatter}
      selectOptions={selectOptions}
      onSave={async (newValue) => {
        const res = await updateDealField(dealId, field, newValue);
        if (res.success) {
          setValue(newValue);
        } else {
          alert(res.error);
        }
      }}
    />
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
          {geoLabel(v)}
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

function MaSellSpecs({ deal, dealId }: { deal: SpecDeal; dealId: string }) {
  const c = deal.currency ?? "EUR";
  const fmMoney = (n: string | number | null) => {
    if (n == null || n === "") return "";
    const num = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(num)) return "";
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M ${c}`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}k ${c}`;
    return `${num} ${c}`;
  };
  return (
    <>
      <SpecRow label="Valorisation cible">
        <EditableSpec dealId={dealId} field="target_amount" initialValue={deal.target_amount} type="number" formatter={fmMoney} placeholder="Saisir valorisation cible" />
      </SpecRow>
      <SpecRow label="Asking price min">
        <EditableSpec dealId={dealId} field="asking_price_min" initialValue={deal.asking_price_min} type="number" formatter={fmMoney} placeholder="Saisir min" />
      </SpecRow>
      <SpecRow label="Asking price max">
        <EditableSpec dealId={dealId} field="asking_price_max" initialValue={deal.asking_price_max} type="number" formatter={fmMoney} placeholder="Saisir max" />
      </SpecRow>
      <SpecRow label="Timing">
        <EditableSpec
          dealId={dealId} field="deal_timing" initialValue={deal.deal_timing ?? null}
          selectOptions={DEAL_TIMING_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
          formatter={(v) => v ? (DEAL_TIMING_OPTIONS.find(t => t.value === v)?.label ?? String(v)) : ""}
          placeholder="Choisir un timing"
        />
      </SpecRow>
      <SpecRow label="Contexte d'opération">
        <EditableSpec
          dealId={dealId} field="deal_context" initialValue={deal.deal_context ?? null}
          selectOptions={DEAL_CONTEXTS.map(cx => ({ value: cx.value, label: cx.label }))}
          formatter={(v) => v ? (DEAL_CONTEXTS.find(cx => cx.value === v)?.label ?? String(v)) : ""}
          placeholder="Succession, MBO, build-up..."
        />
      </SpecRow>
      {deal.partial_sale_ok !== null && (
        <SpecRow label="Cession partielle">{deal.partial_sale_ok ? "Acceptée" : "Refusée"}</SpecRow>
      )}
      {deal.management_retention !== null && (
        <SpecRow label="Rétention management">{deal.management_retention ? "Le management reste" : "Le management part"}</SpecRow>
      )}
      <SpecRow label="Conditions / earn-out">
        <EditableSpec dealId={dealId} field="management_retention_notes" initialValue={deal.management_retention_notes ?? null} placeholder="Conditions, earn-out, mécanismes." />
      </SpecRow>
    </>
  );
}

function MaBuySpecs({ deal, dealId }: { deal: SpecDeal; dealId: string }) {
  const c = deal.currency ?? "EUR";
  const fmMoney = (n: string | number | null) => {
    if (n == null || n === "") return "";
    const num = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(num)) return "";
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M ${c}`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}k ${c}`;
    return `${num} ${c}`;
  };
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
      <SpecRow label="CA cible min">
        <EditableSpec dealId={dealId} field="target_revenue_min" initialValue={deal.target_revenue_min} type="number" formatter={fmMoney} placeholder="Min" />
      </SpecRow>
      <SpecRow label="CA cible max">
        <EditableSpec dealId={dealId} field="target_revenue_max" initialValue={deal.target_revenue_max} type="number" formatter={fmMoney} placeholder="Max" />
      </SpecRow>
      <SpecRow label="EV cible min">
        <EditableSpec dealId={dealId} field="target_ev_min" initialValue={deal.target_ev_min} type="number" formatter={fmMoney} placeholder="Min" />
      </SpecRow>
      <SpecRow label="EV cible max">
        <EditableSpec dealId={dealId} field="target_ev_max" initialValue={deal.target_ev_max} type="number" formatter={fmMoney} placeholder="Max" />
      </SpecRow>
      <SpecRow label="Budget acquisition min">
        <EditableSpec dealId={dealId} field="acquisition_budget_min" initialValue={deal.acquisition_budget_min} type="number" formatter={fmMoney} placeholder="Min" />
      </SpecRow>
      <SpecRow label="Budget acquisition max">
        <EditableSpec dealId={dealId} field="acquisition_budget_max" initialValue={deal.acquisition_budget_max} type="number" formatter={fmMoney} placeholder="Max" />
      </SpecRow>
      <SpecRow label="Stade cible">
        <EditableSpec
          dealId={dealId} field="target_stage" initialValue={deal.target_stage ?? null}
          selectOptions={ORG_COMPANY_STAGES.map(s => ({ value: s.value, label: s.label }))}
          formatter={(v) => v ? (ORG_COMPANY_STAGES.find(s => s.value === v)?.label ?? String(v)) : ""}
          placeholder="Choisir un stade"
        />
      </SpecRow>
      <SpecRow label="Timing">
        <EditableSpec
          dealId={dealId} field="deal_timing" initialValue={deal.deal_timing ?? null}
          selectOptions={DEAL_TIMING_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
          formatter={(v) => v ? (DEAL_TIMING_OPTIONS.find(t => t.value === v)?.label ?? String(v)) : ""}
          placeholder="Choisir un timing"
        />
      </SpecRow>
      {deal.full_acquisition_required !== null && deal.full_acquisition_required && (
        <SpecRow label="Acquisition"><strong style={{ color:"var(--rec-tx)" }}>100% requis (deal breaker)</strong></SpecRow>
      )}
      <SpecRow label="Rationale">
        <EditableSpec dealId={dealId} field="strategic_rationale" initialValue={deal.strategic_rationale ?? null} placeholder="Rationale stratégique" />
      </SpecRow>
    </>
  );
}


