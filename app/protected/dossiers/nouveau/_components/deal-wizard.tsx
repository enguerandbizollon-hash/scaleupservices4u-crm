"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createDealWizardAction, type WizardDealPayload } from "../actions";
import { createOrganisationAction } from "@/actions/organisations";
import { createContact, linkContactToOrganisation } from "@/actions/contacts";
import { organizationTypeLabels, ORG_TYPE_SELECT_ORDER } from "@/lib/crm/labels";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { Building2 } from "lucide-react";
import {
  SECTOR_GROUPS,
  ORG_COMPANY_STAGES,
  DEAL_TIMING_OPTIONS,
  CURRENCIES,
  GEO_ALL,
  GEO_LABELS,
} from "@/lib/crm/matching-maps";
import { dealTypeLabels } from "@/lib/crm/labels";
import { IncludeExcludeMultiSelect } from "@/components/ui/IncludeExcludeMultiSelect";
import { SECTOR_FACET_GROUPS, GEO_FACET_GROUPS } from "@/components/ui/referential-facets";
import { extractCadrageFromUploadAction } from "@/actions/ai/cadrage";
import { cadrageToWizardPrefill } from "@/lib/crm/cadrage-map";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { uploadDealDocument } from "@/lib/storage/documents";
import { createDealDocument } from "@/actions/documents";

// Options {value,label} pour les selects de l'étape 1 (France + régions).
const GEO_OPTIONS = GEO_ALL.map(v => ({ value: v, label: GEO_LABELS[v] ?? v }));

// ── Types ────────────────────────────────────────────────────────────────────

type DealType = "ma_sell" | "ma_buy";

interface OrgOption { id: string; name: string }
interface ContactOption { id: string; first_name: string; last_name: string; email: string | null }

interface Props {
  organisations: OrgOption[];
  contacts: ContactOption[];
  /** Pré-règle le type (?type=ma_buy pour un mandat d'acquisition). */
  initialType?: DealType;
}


const DEAL_STAGES = [
  { value: "kickoff", label: "Kickoff" },
  { value: "preparation", label: "Préparation" },
  { value: "outreach", label: "Outreach" },
  { value: "management_meetings", label: "Mgmt meetings" },
  { value: "dd", label: "Due Diligence" },
  { value: "negotiation", label: "Négociation" },
  { value: "closing", label: "Closing" },
  { value: "post_closing", label: "Post-closing" },
  { value: "ongoing_support", label: "Suivi" },
];


// ── Styles partagés ──────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 13px", border: "1px solid var(--border)",
  borderRadius: 8, background: "var(--surface-2)", color: "var(--text-1)",
  fontSize: 13.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-4)",
  marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em",
};
const hint: React.CSSProperties = {
  fontSize: 11.5, color: "var(--text-5)", marginTop: 4,
};
const sectionCard: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20, marginBottom: 14,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--text-2)", letterSpacing: ".03em",
  marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)",
};
const grid2: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14,
};
const grid3: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

// ── Wizard principal ─────────────────────────────────────────────────────────

export function DealWizard({ organisations, contacts, initialType }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — identité
  const [name, setName] = useState("");
  const [dealType, setDealType] = useState<DealType>(initialType ?? "ma_sell");
  const [dealStatus, setDealStatus] = useState("open");
  const [dealStage, setDealStage] = useState("kickoff");
  const [priority, setPriority] = useState("medium");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [companyStage, setCompanyStage] = useState("");
  const [companyGeography, setCompanyGeography] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("EUR");

  // Step 1 — client org (obligatoire depuis V54 : 2 modes)
  const [clientOrgMode, setClientOrgMode] = useState<"existing" | "new">("existing");
  const [clientOrgId, setClientOrgId] = useState<string>("");
  const [clientOrgLabel, setClientOrgLabel] = useState<string>("");
  const [clientOrgName, setClientOrgName] = useState("");
  const [clientOrgType, setClientOrgType] = useState("client");
  // V54 : taille d'entreprise, stockée sur organizations.company_stage
  const [clientOrgStage, setClientOrgStage] = useState<string>("");

  // Step 1 — dirigeant (3 modes : none / contact existant / saisie libre)
  const [dirigeantMode, setDirigeantMode] = useState<"none" | "existing" | "new">("none");
  const [dirigeantId, setDirigeantId] = useState<string>("");
  const [dirigeantFirstName, setDirigeantFirstName] = useState("");
  const [dirigeantLastName, setDirigeantLastName] = useState("");
  const [dirigeantEmail, setDirigeantEmail] = useState("");
  const [dirigeantPhone, setDirigeantPhone] = useState("");
  const [dirigeantTitle, setDirigeantTitle] = useState("");

  // Step 2 — M&A Sell
  const [targetAmount, setTargetAmount] = useState("");
  const [askingPriceMin, setAskingPriceMin] = useState("");
  const [askingPriceMax, setAskingPriceMax] = useState("");
  const [partialSaleOk, setPartialSaleOk] = useState<boolean>(true);
  const [managementRetention, setManagementRetention] = useState(true); // flag : management reste
  const [managementRetentionNotes, setManagementRetentionNotes] = useState(""); // earn-out / clauses
  const [dealTiming, setDealTiming] = useState("");

  // Step 2 — M&A Buy
  const [targetSectors, setTargetSectors] = useState<string[]>([]);
  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);
  const [targetGeographies, setTargetGeographies] = useState<string[]>([]);
  const [excludedGeographies, setExcludedGeographies] = useState<string[]>([]);
  const [targetRevenueMin, setTargetRevenueMin] = useState("");
  const [targetRevenueMax, setTargetRevenueMax] = useState("");
  const [targetStage, setTargetStage] = useState("");
  const [acquisitionBudgetMin, setAcquisitionBudgetMin] = useState("");
  // Tri-état : null = non précisé (rien ne s'affirme au cédant dans le
  // profil de reprise), true = majoritaire requis, false = ouvert au minoritaire.
  const [fullAcquisitionRequired, setFullAcquisitionRequired] = useState<boolean | null>(null);
  const [strategicRationale, setStrategicRationale] = useState("");

  // Step 2 — Fiche de cadrage (cadrage-first) : upload PDF -> IA -> pré-remplissage.
  const [cadrageContent, setCadrageContent] = useState<CadrageContent | null>(null);
  // Le PDF est conservé pour être ARCHIVÉ dans les Documents du mandat à la
  // création (la pièce fondatrice ne doit pas être jetée après extraction).
  const [cadrageFile, setCadrageFile] = useState<File | null>(null);
  // Mandat créé mais archivage du cadrage échoué : on affiche l'erreur et un
  // bouton pour ouvrir le mandat, au lieu de rediriger en silence.
  const [createdTarget, setCreatedTarget] = useState<string | null>(null);
  const [cadrageLoading, setCadrageLoading] = useState(false);
  const [cadrageMsg, setCadrageMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Step 3 — données financières
  const [financialEnabled, setFinancialEnabled] = useState(false);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear() - 1);
  const [revenue, setRevenue] = useState("");
  const [grossMargin, setGrossMargin] = useState("");
  const [ebitda, setEbitda] = useState("");
  const [ebitdaMargin, setEbitdaMargin] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [recurrentEnabled, setRecurrentEnabled] = useState(false);
  const [arr, setArr] = useState("");
  const [mrr, setMrr] = useState("");
  const [nrr, setNrr] = useState("");
  const [churnRate, setChurnRate] = useState("");

  const currencySymbol = useMemo(
    () => CURRENCIES.find(c => c.value === currency)?.symbol ?? "€",
    [currency],
  );

  // ── Validation Step 1 ──
  const step1Valid = name.trim().length > 0 && !!dealType;
  // Organisation cliente obligatoire pour une cession (sujet du dossier),
  // OPTIONNELLE pour un mandat d'acquisition (le client peut n'être qu'un
  // repreneur individuel, capturé comme contact).
  const step1ClientOk = dealType === "ma_buy"
    ? true
    : clientOrgMode === "new"
      ? clientOrgName.trim().length > 0
      : !!clientOrgId;
  // Création dirigeant libre : si mode = new, prénom + nom requis
  const step1DirigeantOk = dirigeantMode !== "new" || (
    dirigeantFirstName.trim().length > 0 && dirigeantLastName.trim().length > 0
  );

  const canNext1 = step1Valid && step1ClientOk && step1DirigeantOk;

  // Un mandat d'acquisition n'a pas d'étape financière (pas de cible unique) :
  // 2 étapes pour ma_buy, 3 pour une cession.
  const lastStep: 2 | 3 = dealType === "ma_buy" ? 2 : 3;

  // Navigation entre étapes
  function goNext() {
    if (step < lastStep) setStep((step + 1) as 1 | 2 | 3);
  }
  function goPrev() {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  // Fiche de cadrage : l'IA extrait les critères, on pré-remplit, l'utilisateur
  // vérifie et corrige avant de valider (propose/dispose).
  async function analyzeCadrage(file: File): Promise<boolean> {
    setCadrageLoading(true);
    setCadrageMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await extractCadrageFromUploadAction(fd);
    setCadrageLoading(false);
    if (!res.success || !res.content) {
      setCadrageMsg({ kind: "err", text: `${res.error ?? "Analyse échouée."}${cadrageFile ? ` La fiche précédente (${cadrageFile.name}) reste en place.` : ""}` });
      return false;
    }
    const c = res.content;
    setCadrageContent(c);
    setCadrageFile(file);
    const p = cadrageToWizardPrefill(c);
    setTargetSectors(p.targetSectors);
    setTargetGeographies(p.targetGeographies);
    setTargetRevenueMin(p.targetRevenueMin);
    setTargetRevenueMax(p.targetRevenueMax);
    setAcquisitionBudgetMin(p.acquisitionBudgetMin);
    setFullAcquisitionRequired(p.fullAcquisitionRequired);
    setStrategicRationale(p.strategicRationale);
    if (c.repreneur_nom && !name.trim()) setName(`Acquisition ${c.repreneur_nom}`);
    setCadrageMsg({ kind: "ok", text: `Fiche analysée (confiance ${c.confidence}/100). Vérifiez et corrigez les critères ci-dessous.` });
    return true;
  }

  // ── Soumission finale ──
  async function handleSubmit() {
    if (!canNext1) return;
    setSaving(true);
    setError("");

    // 1. Création inline client org (si demandée) avant l'appel principal
    let resolvedClientOrgId: string | null = null;
    if (clientOrgMode === "existing" && clientOrgId) {
      resolvedClientOrgId = clientOrgId;
    } else if (clientOrgMode === "new") {
      const res = await createOrganisationAction({
        name: clientOrgName.trim(),
        organization_type: clientOrgType,
        base_status: "active",
        location: null, website: null, linkedin_url: null, description: null, notes: null,
        investor_ticket_min: null, investor_ticket_max: null,
        investor_sectors: [], investor_stages: [], investor_geographies: [],
        investor_thesis: null,
        sector: null, founded_year: null, employee_count: null,
        // V54 : taille d'entreprise stockée à la création
        company_stage: clientOrgStage || null,
        revenue_range: null,
        sale_readiness: null, partial_sale_ok: true,
        acquisition_rationale: null,
        target_sectors: [], excluded_sectors: [], target_geographies: [],
        target_revenue_min: null, target_revenue_max: null,
      });
      if (!res.success) { setSaving(false); setError(`Organisation : ${res.error}`); return; }
      resolvedClientOrgId = res.id;
    }

    // Org cliente requise pour une cession, optionnelle pour une acquisition
    // (le repreneur peut n'être qu'un contact).
    if (!resolvedClientOrgId && dealType !== "ma_buy") {
      setSaving(false);
      setError("Organisation cliente obligatoire");
      return;
    }

    // 2. Création inline dirigeant.
    // Mode "existing" : on récupère l'id du contact choisi.
    // Mode "new" : promotion automatique en contact CRM. Si un prénom OU
    // un nom a été saisi, on crée le contact, on le lie à l'organisation
    // cliente avec son titre comme rôle, puis on récupère son id pour
    // deal.dirigeant_id. Les champs dénormalisés dirigeant_* sur le deal
    // restent renseignés en miroir (pour compat avec le code existant).
    let resolvedDirigeantId: string | null = null;
    if (dirigeantMode === "existing" && dirigeantId) {
      resolvedDirigeantId = dirigeantId;
    } else if (dirigeantMode === "new") {
      const fn = dirigeantFirstName.trim();
      const ln = dirigeantLastName.trim();
      if (fn || ln) {
        const cRes = await createContact({
          first_name: fn || "—",
          last_name: ln || fn,
          email: dirigeantEmail.trim() || null,
          phone: dirigeantPhone.trim() || null,
          title: dirigeantTitle.trim() || null,
        });
        if (cRes.success) {
          resolvedDirigeantId = cRes.id;
          // Liaison seulement si une org cliente existe (null en acquisition
          // sans société repreneuse).
          if (resolvedClientOrgId) {
            await linkContactToOrganisation(
              cRes.id,
              resolvedClientOrgId,
              dirigeantTitle.trim() || "Dirigeant",
            );
          }
        }
        // Si la création échoue (ex: doublon par email), on laisse le
        // dossier se créer avec les champs texte dénormalisés. Pas bloquant.
      }
    }

    // 3. Préparation payload complet
    const payload: WizardDealPayload = {
      name: name.trim(),
      deal_type: dealType,
      deal_status: dealStatus,
      deal_stage: dealStage,
      priority_level: priority,
      sector: sector || null,
      location: location || null,
      company_stage: null,
      company_geography: companyGeography || null,
      start_date: startDate || null,
      target_date: targetDate || null,
      description: description.trim() || null,
      currency,

      client_organization_id: resolvedClientOrgId,
      // V54 : taille d'entreprise appliquée sur l'organisation cliente si
      // renseignée (y compris lorsqu'on sélectionne une org existante et qu'on
      // souhaite mettre à jour sa taille).
      client_organization_stage: clientOrgStage || null,

      dirigeant_id: resolvedDirigeantId,
      dirigeant_nom: (() => {
        if (dirigeantMode === "new") {
          const full = `${dirigeantFirstName.trim()} ${dirigeantLastName.trim()}`.trim();
          return full || null;
        }
        if (dirigeantMode === "existing") {
          const c = contacts.find(x => x.id === dirigeantId);
          if (!c) return null;
          const full = `${c.first_name} ${c.last_name}`.trim();
          return full || null;
        }
        return null;
      })(),
      dirigeant_email: dirigeantMode === "new"
        ? (dirigeantEmail.trim() || null)
        : (dirigeantMode === "existing" ? (contacts.find(c => c.id === dirigeantId)?.email ?? null) : null),
      dirigeant_telephone: dirigeantMode === "new" ? (dirigeantPhone.trim() || null) : null,
      dirigeant_titre: dirigeantMode === "new" ? (dirigeantTitle.trim() || null) : null,

      // M&A Sell
      target_amount: numOrNull(targetAmount),
      asking_price_min: numOrNull(askingPriceMin),
      asking_price_max: numOrNull(askingPriceMax),
      partial_sale_ok: dealType === "ma_sell" ? partialSaleOk : null,
      management_retention: dealType === "ma_sell" ? managementRetention : null,
      management_retention_notes: dealType === "ma_sell" ? (managementRetentionNotes.trim() || null) : null,
      deal_timing: dealTiming || null,

      // M&A Buy
      target_sectors: targetSectors.length > 0 ? targetSectors : null,
      excluded_sectors: excludedSectors.length > 0 ? excludedSectors : null,
      target_geographies: targetGeographies.length > 0 ? targetGeographies : null,
      excluded_geographies: excludedGeographies.length > 0 ? excludedGeographies : null,
      target_revenue_min: numOrNull(targetRevenueMin),
      target_revenue_max: numOrNull(targetRevenueMax),
      // EV et budget max : colonnes conservées en base mais non saisies au
      // cadrage small cap (rarement pertinent) ; renseignables plus tard.
      target_ev_min: null,
      target_ev_max: null,
      target_stage: targetStage || null,
      acquisition_budget_min: numOrNull(acquisitionBudgetMin),
      acquisition_budget_max: null,
      full_acquisition_required: dealType === "ma_buy" ? fullAcquisitionRequired : null,
      strategic_rationale: strategicRationale.trim() || null,
      // Fiche de cadrage extraite au wizard : persistée à l'INSERT pour la
      // génération de la chasse rattachée ensuite (?tab=sourcing).
      cadrage_content: dealType === "ma_buy" ? cadrageContent : null,

      // Financial (Step 3)
      financial: financialEnabled ? {
        fiscal_year: fiscalYear,
        revenue: numOrNull(revenue),
        gross_margin: numOrNull(grossMargin),
        ebitda: numOrNull(ebitda),
        ebitda_margin: numOrNull(ebitdaMargin),
        headcount: numOrNull(headcount),
        arr: recurrentEnabled ? numOrNull(arr) : null,
        mrr: recurrentEnabled ? numOrNull(mrr) : null,
        nrr: recurrentEnabled ? numOrNull(nrr) : null,
        churn_rate: recurrentEnabled ? numOrNull(churnRate) : null,
      } : null,
    };

    const res = await createDealWizardAction(payload);
    if (!res.success) { setSaving(false); setError(res.error); return; }
    if (res.warnings.length > 0) {
      // Affichage non bloquant
      console.warn("Wizard warnings:", res.warnings);
    }

    // Archive du PDF de cadrage dans les Documents du mandat (type dédié) :
    // la pièce fondatrice reste consultable et ré-analysable. Le dossier est
    // déjà créé : un échec ne le remet pas en cause, mais il se DIT (jamais
    // un console.warn muet), et l'utilisateur choisit quand ouvrir le mandat.
    const target = `/protected/dossiers/${res.id}${dealType === "ma_buy" ? "?tab=sourcing" : ""}`;
    if (dealType === "ma_buy" && cadrageFile) {
      let archiveError: string | null = null;
      try {
        const up = await uploadDealDocument(cadrageFile, res.id);
        if (!up.success) {
          archiveError = up.error;
        } else {
          const doc = await createDealDocument({
            deal_id: res.id,
            document_type: "cadrage",
            file_name: cadrageFile.name,
            file_size: up.size,
            mime_type: up.mime,
            storage_path: up.path,
            file_url: up.path, // le signed URL est généré à la demande
          });
          if (!doc.success) archiveError = doc.error;
        }
      } catch (e) {
        archiveError = e instanceof Error ? e.message : "erreur réseau";
      }
      if (archiveError) {
        setSaving(false);
        setCreatedTarget(target);
        setError(`Mandat créé, mais la fiche de cadrage n'a pas pu être archivée dans ses Documents (${archiveError}). Ajoutez-la depuis l'onglet Documents du mandat.`);
        return;
      }
    }
    setSaving(false);
    // Acquisition : on atterrit sur le sourcing (fiche de cadrage + cibles),
    // le cœur du mandat buy-side. Cession : la fiche dossier standard.
    router.push(target);
  }

  // ── Progress bar ────────────────────────────────────────────────────────
  // Un mandat d'acquisition se cadre en 2 étapes (identité + critères de
  // recherche) ; une cession garde l'étape 3 des données financières N-1.
  const steps = dealType === "ma_buy"
    ? [
        { n: 1, label: "Identité & contexte" },
        { n: 2, label: "Critères d'acquisition" },
      ]
    : [
        { n: 1, label: "Identité & contexte" },
        { n: 2, label: "Spécificités de la cession" },
        { n: 3, label: "Données financières" },
      ];

  return (
    <div style={{ padding: "32px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-5)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Dossiers</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Nouveau dossier</h1>
          </div>
          <button type="button" onClick={() => router.push("/protected/dossiers")}
            style={{ padding: "8px 16px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text-2)", cursor: "pointer", fontFamily: "inherit" }}>
            ← Retour
          </button>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {steps.map((s, i) => {
            const isActive = step === s.n;
            const isDone = step > s.n;
            return (
              <div key={s.n} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                  background: isActive ? "var(--su-500, #1a56db)" : (isDone ? "var(--fund-bg)" : "var(--surface-2)"),
                  color: isActive ? "#fff" : (isDone ? "var(--fund-tx)" : "var(--text-5)"),
                  border: isActive ? "1px solid var(--su-500, #1a56db)" : "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>
                  {isDone ? "✓" : s.n}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--text-1)" : "var(--text-4)" }}>
                  {s.label}
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 6 }} />}
              </div>
            );
          })}
        </div>

        {/* Step 1 — Identité */}
        {step === 1 && (
          <>
            <div style={sectionCard}>
              <div style={sectionTitle}>Identité du dossier</div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Nom du dossier *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Cession Scierie Martin" style={inp} />
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Type de mission *</label>
                  <select value={dealType} onChange={e => setDealType(e.target.value as DealType)} style={inp}>
                    <option value="ma_sell">{dealTypeLabels.ma_sell}</option>
                    <option value="ma_buy">{dealTypeLabels.ma_buy}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priorité</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
                    <option value="high">Haute</option>
                    <option value="medium">Moyenne</option>
                    <option value="low">Basse</option>
                  </select>
                </div>
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Étape</label>
                  <select value={dealStage} onChange={e => setDealStage(e.target.value)} style={inp}>
                    {DEAL_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Statut</label>
                  <select value={dealStatus} onChange={e => setDealStatus(e.target.value)} style={inp}>
                    <option value="open">En cours</option>
                    <option value="paused">En pause</option>
                  </select>
                </div>
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Devise</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={inp}>
                    {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Secteur d&apos;activité</label>
                  <select value={sector} onChange={e => setSector(e.target.value)} style={inp}>
                    <option value="">— Choisir —</option>
                    {SECTOR_GROUPS.map(g => (
                      <optgroup key={g.family} label={g.family}>
                        <option value={g.family}>{g.family} (tout le secteur)</option>
                        {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </optgroup>
                    ))}
                    <optgroup label="Transverse">
                      <option value="Généraliste">Généraliste</option>
                    </optgroup>
                  </select>
                </div>
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Localisation</label>
                  <select value={location} onChange={e => setLocation(e.target.value)} style={inp}>
                    <option value="">— Non renseignée —</option>
                    {GEO_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Géographie cible (matching)</label>
                  <select value={companyGeography} onChange={e => setCompanyGeography(e.target.value)} style={inp}>
                    <option value="">— Non renseignée —</option>
                    {GEO_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={grid2}>
                <div />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={lbl}>Date de début</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Date cible</label>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={inp} />
                  </div>
                </div>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Contexte, objectifs, notes…" style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>

            {/* Bloc Organisation cliente — obligatoire (V54) */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Organisation cliente (sujet du dossier) *</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["existing", "new"] as const).map(m => (
                  <button key={m} type="button" onClick={() => setClientOrgMode(m)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                      background: clientOrgMode === m ? "var(--su-500, #1a56db)" : "var(--surface-2)",
                      color: clientOrgMode === m ? "#fff" : "var(--text-3)",
                      fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {m === "existing" ? "Sélectionner existante" : "Créer nouvelle"}
                  </button>
                ))}
              </div>
              {clientOrgMode === "existing" && (
                clientOrgId ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8,
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-1)", minWidth: 0 }}>
                      <Building2 size={14} color="var(--text-4)" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientOrgLabel || organisations.find(o => o.id === clientOrgId)?.name || "Organisation"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setClientOrgId(""); setClientOrgLabel(""); }}
                      style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 12, padding: "4px 10px", fontFamily: "inherit" }}
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <EntityPicker
                    entityType="organization"
                    disableCreate
                    placeholder="Rechercher une organisation cliente."
                    onPicked={(id, label) => { setClientOrgId(id); setClientOrgLabel(label); }}
                  />
                )
              )}
              {clientOrgMode === "new" && (
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Nom *</label>
                    <input value={clientOrgName} onChange={e => setClientOrgName(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Type</label>
                    <select value={clientOrgType} onChange={e => setClientOrgType(e.target.value)} style={inp}>
                      {ORG_TYPE_SELECT_ORDER.map(t => <option key={t} value={t}>{organizationTypeLabels[t]}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {/* V54 : taille d'entreprise (startup / PME / ETI / grand groupe) */}
              <div style={{ marginTop: 14 }}>
                <label style={lbl}>Taille d&apos;entreprise</label>
                <select value={clientOrgStage} onChange={e => setClientOrgStage(e.target.value)} style={inp}>
                  <option value="">— Non renseignée —</option>
                  {ORG_COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div style={hint}>
                  {clientOrgMode === "existing"
                    ? "Si renseignée, met à jour la taille sur la fiche organisation."
                    : "Taille stockée sur l'organisation créée."}
                </div>
              </div>
            </div>

            {/* Bloc Mandat : supprimé (fusion mandats → dossiers, temps 5).
                Les honoraires se cadrent dans l'onglet Honoraires de la fiche. */}

            {/* Bloc Dirigeant */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Dirigeant / Référent principal</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["none", "existing", "new"] as const).map(m => (
                  <button key={m} type="button" onClick={() => setDirigeantMode(m)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                      background: dirigeantMode === m ? "var(--su-500, #1a56db)" : "var(--surface-2)",
                      color: dirigeantMode === m ? "#fff" : "var(--text-3)",
                      fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {m === "none" ? "Ne pas renseigner" : m === "existing" ? "Contact CRM existant" : "Saisie libre"}
                  </button>
                ))}
              </div>
              {dirigeantMode === "existing" && (
                dirigeantId ? (() => {
                  const c = contacts.find(x => x.id === dirigeantId);
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 8,
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                        {c ? `${c.first_name} ${c.last_name}` : "Contact sélectionné"}
                        {c?.email && <span style={{ fontWeight: 400, color: "var(--text-5)" }}> — {c.email}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDirigeantId("")}
                        style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 12, padding: "4px 10px", fontFamily: "inherit" }}
                      >
                        Changer
                      </button>
                    </div>
                  );
                })() : (
                  <EntityPicker
                    entityType="contact"
                    disableCreate
                    placeholder="Rechercher un contact existant."
                    onPicked={(id) => setDirigeantId(id)}
                  />
                )
              )}
              {dirigeantMode === "new" && (
                <>
                  <div style={grid2}>
                    <div>
                      <label style={lbl}>Prénom *</label>
                      <input value={dirigeantFirstName} onChange={e => setDirigeantFirstName(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Nom *</label>
                      <input value={dirigeantLastName} onChange={e => setDirigeantLastName(e.target.value)} style={inp} />
                    </div>
                  </div>
                  <div style={grid2}>
                    <div>
                      <label style={lbl}>Fonction</label>
                      <input value={dirigeantTitle} onChange={e => setDirigeantTitle(e.target.value)} placeholder="CEO, CFO…" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Email</label>
                      <input type="email" value={dirigeantEmail} onChange={e => setDirigeantEmail(e.target.value)} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Téléphone</label>
                    <input value={dirigeantPhone} onChange={e => setDirigeantPhone(e.target.value)} placeholder="+33 6 …" style={inp} />
                  </div>
                  <div style={hint}>Le dirigeant sera automatiquement créé comme contact CRM et rattaché à l&apos;organisation cliente.</div>
                </>
              )}
            </div>
          </>
        )}

        {/* Step 2 — Spécificités */}
        {step === 2 && dealType === "ma_sell" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>Cession : cadrage de l&apos;opération</div>
            <div style={grid3}>
              <div>
                <label style={lbl}>Valorisation cible ({currencySymbol})</label>
                <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Asking price min ({currencySymbol})</label>
                <input type="number" value={askingPriceMin} onChange={e => setAskingPriceMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Asking price max ({currencySymbol})</label>
                <input type="number" value={askingPriceMax} onChange={e => setAskingPriceMax(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Timing</label>
                <select value={dealTiming} onChange={e => setDealTiming(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {DEAL_TIMING_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
                  <input type="checkbox" checked={partialSaleOk} onChange={e => setPartialSaleOk(e.target.checked)} />
                  Cession partielle acceptée
                </label>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
                <input type="checkbox" checked={managementRetention}
                  onChange={e => setManagementRetention(e.target.checked)} />
                Le management souhaite rester après cession
              </label>
              <div style={hint}>Flag utilisé par le scoring M&A pour qualifier les acquéreurs compatibles.</div>
            </div>
            <div>
              <label style={lbl}>Conditions / earn-out / clauses</label>
              <textarea rows={2} value={managementRetentionNotes}
                onChange={e => setManagementRetentionNotes(e.target.value)}
                placeholder="Accompagnement 2 ans, earn-out 20% sur 2 ans, vesting…"
                style={{ ...inp, resize: "vertical" }} />
            </div>
          </div>
        )}

        {step === 2 && dealType === "ma_buy" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>Acquisition : critères de recherche</div>

            {/* Cadrage-first : la fiche pré-remplit tout, on vérifie ensuite. */}
            <div style={{ border: "1px dashed var(--su-500, #1a56db)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, background: "var(--surface-2)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>Importer la fiche de cadrage (PDF)</div>
              <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 10 }}>
                L&apos;IA lit le brief du repreneur et pré-remplit les critères ci-dessous. Vous vérifiez et corrigez avant de créer.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input type="file" accept="application/pdf" disabled={cadrageLoading}
                  onChange={async e => {
                    const input = e.currentTarget;
                    const f = input.files?.[0];
                    if (!f) return;
                    // Échec d'analyse : l'input ne doit pas afficher un fichier
                    // qui n'est ni retenu ni archivé (l'état garde la fiche précédente).
                    const ok = await analyzeCadrage(f);
                    if (!ok) input.value = "";
                  }}
                  style={{ fontSize: 12.5, fontFamily: "inherit", color: "var(--text-3)" }} />
                {cadrageLoading && <span style={{ fontSize: 12.5, color: "var(--text-4)" }}>Analyse en cours…</span>}
              </div>
              {cadrageMsg && (
                <div style={{ marginTop: 10, padding: "8px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: cadrageMsg.kind === "ok" ? "#D1FAE5" : "#FEE2E2", color: cadrageMsg.kind === "ok" ? "#065F46" : "#991B1B" }}>
                  {cadrageMsg.text}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Secteurs (visés / exclus)</label>
              <IncludeExcludeMultiSelect groups={SECTOR_FACET_GROUPS}
                included={targetSectors} excluded={excludedSectors}
                onIncluded={setTargetSectors} onExcluded={setExcludedSectors} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Géographies (visées / exclues)</label>
              <IncludeExcludeMultiSelect groups={GEO_FACET_GROUPS}
                included={targetGeographies} excluded={excludedGeographies}
                onIncluded={setTargetGeographies} onExcluded={setExcludedGeographies} />
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>CA cible min ({currencySymbol})</label>
                <input type="number" value={targetRevenueMin} onChange={e => setTargetRevenueMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>CA cible max ({currencySymbol})</label>
                <input type="number" value={targetRevenueMax} onChange={e => setTargetRevenueMax(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Apport / budget ({currencySymbol})</label>
                <input type="number" value={acquisitionBudgetMin} onChange={e => setAcquisitionBudgetMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Stade / taille cible</label>
                <select value={targetStage} onChange={e => setTargetStage(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {ORG_COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Type d&apos;opération recherchée</label>
              <select
                value={fullAcquisitionRequired === null ? "" : fullAcquisitionRequired ? "majoritaire" : "ouvert"}
                onChange={e => setFullAcquisitionRequired(e.target.value === "" ? null : e.target.value === "majoritaire")}
                style={inp}>
                <option value="">— Non précisé —</option>
                <option value="majoritaire">Prise de contrôle majoritaire requise (deal breaker)</option>
                <option value="ouvert">Ouvert à une prise de participation, majoritaire ou minoritaire</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Projet du repreneur / rationale</label>
              <textarea rows={3} value={strategicRationale} onChange={e => setStrategicRationale(e.target.value)}
                placeholder="Projet de reprise, synergies, zone, accompagnement souhaité…" style={{ ...inp, resize: "vertical" }} />
            </div>
          </div>
        )}

        {/* Step 3 — Données financières (cession uniquement) */}
        {step === 3 && dealType !== "ma_buy" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>Données financières initiales (optionnel)</div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--text-2)", marginBottom: 14 }}>
              <input type="checkbox" checked={financialEnabled} onChange={e => setFinancialEnabled(e.target.checked)} />
              Saisir les données financières maintenant
            </label>
            {!financialEnabled && (
              <div style={hint}>Tu pourras les renseigner à tout moment depuis l&apos;onglet Financier de la fiche dossier.</div>
            )}
            {financialEnabled && (
              <>
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Année fiscale</label>
                    <input type="number" value={fiscalYear}
                      onChange={e => setFiscalYear(Number(e.target.value) || new Date().getFullYear() - 1)}
                      style={inp} />
                    <div style={hint}>Par défaut : dernier exercice clos.</div>
                  </div>
                  <div>
                    <label style={lbl}>Effectif (headcount)</label>
                    <input type="number" value={headcount} onChange={e => setHeadcount(e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={grid3}>
                  <div>
                    <label style={lbl}>Revenue ({currencySymbol})</label>
                    <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Marge brute (%)</label>
                    <input type="number" step="0.01" value={grossMargin} onChange={e => setGrossMargin(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>EBITDA ({currencySymbol})</label>
                    <input type="number" value={ebitda} onChange={e => setEbitda(e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={grid2}>
                  <div>
                    <label style={lbl}>Marge EBITDA (%)</label>
                    <input type="number" step="0.01" value={ebitdaMargin} onChange={e => setEbitdaMargin(e.target.value)} style={inp} />
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--text-2)", marginTop: 10, marginBottom: 10 }}>
                  <input type="checkbox" checked={recurrentEnabled} onChange={e => setRecurrentEnabled(e.target.checked)} />
                  Modèle récurrent (SaaS, abonnement)
                </label>
                {recurrentEnabled && (
                  <div style={grid2}>
                    <div>
                      <label style={lbl}>ARR ({currencySymbol})</label>
                      <input type="number" value={arr} onChange={e => setArr(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>MRR ({currencySymbol})</label>
                      <input type="number" value={mrr} onChange={e => setMrr(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>NRR (%)</label>
                      <input type="number" step="0.01" value={nrr} onChange={e => setNrr(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Churn (%)</label>
                      <input type="number" step="0.01" value={churnRate} onChange={e => setChurnRate(e.target.value)} style={inp} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>{error}</span>
            {createdTarget && (
              <button type="button" onClick={() => router.push(createdTarget)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#b91c1c", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Ouvrir le mandat →
              </button>
            )}
          </div>
        )}

        {/* Footer — navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button type="button" onClick={goPrev} disabled={step === 1}
            style={{
              padding: "10px 22px", borderRadius: 9, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--text-3)",
              fontSize: 13.5, fontWeight: 600, cursor: step === 1 ? "default" : "pointer",
              opacity: step === 1 ? 0.4 : 1, fontFamily: "inherit",
            }}>
            ← Précédent
          </button>
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>
            Étape {steps.findIndex(s => s.n === step) + 1} / {steps.length}
          </div>
          {step < lastStep ? (
            <button type="button" onClick={goNext} disabled={step === 1 && !canNext1}
              style={{
                padding: "10px 22px", borderRadius: 9, border: "none",
                background: (step === 1 && !canNext1) ? "var(--border)" : "var(--su-500, #1a56db)",
                color: "#fff", fontSize: 13.5, fontWeight: 700,
                cursor: (step === 1 && !canNext1) ? "default" : "pointer", fontFamily: "inherit",
              }}>
              Suivant →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving || !canNext1}
              style={{
                padding: "10px 22px", borderRadius: 9, border: "none",
                background: "var(--su-500, #1a56db)", color: "#fff",
                fontSize: 13.5, fontWeight: 700,
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                fontFamily: "inherit",
              }}>
              {saving ? "Création…" : "Créer le dossier"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
