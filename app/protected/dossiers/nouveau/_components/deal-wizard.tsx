"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createDealWizardAction, type WizardDealPayload } from "../actions";
import { createOrganisationAction } from "@/actions/organisations";
import { createContact, linkContactToOrganisation } from "@/actions/contacts";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { Building2 } from "lucide-react";
import {
  SECTORS,
  COMPANY_STAGES,
  ORG_COMPANY_STAGES,
  SENIORITY_OPTIONS,
  REMOTE_OPTIONS,
  ROUND_TYPES,
  DEAL_TIMING_OPTIONS,
  CURRENCIES,
  GEO_ALL,
  GEO_LABELS,
} from "@/lib/crm/matching-maps";

// Options {value,label} construites depuis GEO_ALL (tableau de strings)
const GEO_OPTIONS = GEO_ALL.map(v => ({ value: v, label: GEO_LABELS[v] ?? v }));

// ── Types ────────────────────────────────────────────────────────────────────

type DealType = "fundraising" | "ma_sell" | "ma_buy" | "recruitment" | "cfo_advisor";

interface MandateOption { id: string; name: string; type: string; status: string; client_name: string | null }
interface OrgOption { id: string; name: string }
interface ContactOption { id: string; first_name: string; last_name: string; email: string | null }

interface Props {
  mandates: MandateOption[];
  organisations: OrgOption[];
  contacts: ContactOption[];
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising",
  ma_sell: "M&A Sell-side",
  ma_buy: "M&A Buy-side",
  recruitment: "Recrutement",
  cfo_advisor: "CFO Advisor",
};

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

// Pour CFO Advisor on saute la Step 2 (pas de colonnes dédiées pertinentes)
function needsStep2(dt: string): boolean {
  return dt !== "cfo_advisor";
}

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

// ── Composants réutilisables ─────────────────────────────────────────────────

function TagsInput({ values, onChange, placeholder }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  function commit() {
    const v = input.trim();
    if (!v || values.includes(v)) { setInput(""); return; }
    onChange([...values, v]);
    setInput("");
  }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: values.length > 0 ? 6 : 0 }}>
        {values.map(v => (
          <span key={v} style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
            borderRadius: 20, background: "var(--surface-3)", color: "var(--text-2)",
            fontSize: 12, fontWeight: 500,
          }}>
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", fontSize: 14, padding: 0 }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input type="text" value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !input && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        style={inp} />
    </div>
  );
}

function MultiSelect({ values, onChange, options, placeholder }: {
  values: string[]; onChange: (v: string[]) => void;
  options: readonly { value: string; label: string }[] | { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(o => {
          const active = values.includes(o.value);
          return (
            <button key={o.value} type="button"
              onClick={() => onChange(active ? values.filter(v => v !== o.value) : [...values, o.value])}
              style={{
                padding: "5px 12px", borderRadius: 18,
                border: active ? "1px solid var(--su-500)" : "1px solid var(--border)",
                background: active ? "var(--su-500)" : "var(--surface-2)",
                color: active ? "#fff" : "var(--text-3)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
      {values.length === 0 && <div style={hint}>{placeholder}</div>}
    </div>
  );
}

// ── Wizard principal ─────────────────────────────────────────────────────────

export function DealWizard({ mandates, organisations, contacts }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — identité
  const [name, setName] = useState("");
  const [dealType, setDealType] = useState<DealType>("fundraising");
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

  // Step 1 — mandat (3 modes)
  const [mandateMode, setMandateMode] = useState<"none" | "existing" | "new">("none");
  const [mandateId, setMandateId] = useState<string>("");
  const [newMandateName, setNewMandateName] = useState("");
  const [newMandateStart, setNewMandateStart] = useState("");
  const [newMandateClose, setNewMandateClose] = useState("");

  // Step 2 — Fundraising
  const [targetRaiseAmount, setTargetRaiseAmount] = useState("");
  const [preMoneyValuation, setPreMoneyValuation] = useState("");
  const [postMoneyValuation, setPostMoneyValuation] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");
  const [runwayMonths, setRunwayMonths] = useState("");
  const [roundType, setRoundType] = useState("");
  const [currentInvestors, setCurrentInvestors] = useState<string[]>([]);

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
  const [targetEvMin, setTargetEvMin] = useState("");
  const [targetEvMax, setTargetEvMax] = useState("");
  const [targetStage, setTargetStage] = useState("");
  const [acquisitionBudgetMin, setAcquisitionBudgetMin] = useState("");
  const [acquisitionBudgetMax, setAcquisitionBudgetMax] = useState("");
  const [fullAcquisitionRequired, setFullAcquisitionRequired] = useState(false);
  const [strategicRationale, setStrategicRationale] = useState("");

  // Step 2 — Recruitment
  const [jobTitle, setJobTitle] = useState("");
  const [requiredSeniority, setRequiredSeniority] = useState("");
  const [requiredLocation, setRequiredLocation] = useState("");
  const [requiredRemote, setRequiredRemote] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

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
  // V54 : organisation cliente obligatoire (sujet du dossier).
  // Mode existing : il faut une org sélectionnée. Mode new : nom requis.
  const step1ClientOk = clientOrgMode === "new"
    ? clientOrgName.trim().length > 0
    : !!clientOrgId;
  // Création mandat inline : si mode = new, nom requis (l'org est toujours présente)
  const step1MandateOk = mandateMode !== "new" || newMandateName.trim().length > 0;
  // Création dirigeant libre : si mode = new, prénom + nom requis
  const step1DirigeantOk = dirigeantMode !== "new" || (
    dirigeantFirstName.trim().length > 0 && dirigeantLastName.trim().length > 0
  );

  const canNext1 = step1Valid && step1ClientOk && step1MandateOk && step1DirigeantOk;

  // Navigation entre étapes (skip Step 2 pour CFO)
  function goNext() {
    if (step === 1) setStep(needsStep2(dealType) ? 2 : 3);
    else if (step === 2) setStep(3);
  }
  function goPrev() {
    if (step === 3) setStep(needsStep2(dealType) ? 2 : 1);
    else if (step === 2) setStep(1);
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

    // V54 : sécurité supplémentaire — ne pas avancer sans org cliente résolue.
    if (!resolvedClientOrgId) {
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
          await linkContactToOrganisation(
            cRes.id,
            resolvedClientOrgId,
            dirigeantTitle.trim() || "Dirigeant",
          );
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
      // V54 : stade startup uniquement pour fundraising. Les autres types
      // s'appuient sur organizations.company_stage (taille d'entreprise).
      company_stage: dealType === "fundraising" ? (companyStage || null) : null,
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

      mandate_id: mandateMode === "existing" ? (mandateId || null) : null,
      create_mandate: mandateMode === "new" && resolvedClientOrgId ? {
        name: newMandateName.trim(),
        type: dealType,
        client_organization_id: resolvedClientOrgId,
        start_date: newMandateStart || null,
        target_close_date: newMandateClose || null,
        currency,
      } : null,

      // Fundraising
      target_raise_amount: numOrNull(targetRaiseAmount),
      pre_money_valuation: numOrNull(preMoneyValuation),
      post_money_valuation: numOrNull(postMoneyValuation),
      use_of_funds: useOfFunds.trim() || null,
      runway_months: numOrNull(runwayMonths),
      round_type: roundType || null,
      current_investors: currentInvestors.length > 0 ? currentInvestors : null,

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
      target_ev_min: numOrNull(targetEvMin),
      target_ev_max: numOrNull(targetEvMax),
      target_stage: targetStage || null,
      acquisition_budget_min: numOrNull(acquisitionBudgetMin),
      acquisition_budget_max: numOrNull(acquisitionBudgetMax),
      full_acquisition_required: dealType === "ma_buy" ? fullAcquisitionRequired : null,
      strategic_rationale: strategicRationale.trim() || null,

      // Recruitment
      job_title: jobTitle.trim() || null,
      required_seniority: requiredSeniority || null,
      required_location: requiredLocation || null,
      required_remote: requiredRemote || null,
      salary_min: numOrNull(salaryMin),
      salary_max: numOrNull(salaryMax),

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
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    if (res.warnings.length > 0) {
      // Affichage non bloquant
      console.warn("Wizard warnings:", res.warnings);
    }
    router.push(`/protected/dossiers/${res.id}`);
  }

  // ── Progress bar ────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: "Identité & contexte" },
    ...(needsStep2(dealType) ? [{ n: 2, label: "Spécificités" }] : []),
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
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Redpeaks Série A" style={inp} />
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Type de mission *</label>
                  <select value={dealType} onChange={e => setDealType(e.target.value as DealType)} style={inp}>
                    {Object.entries(DEAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
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
                {/* V54 : Stade startup (seed → growth) réservé au fundraising.
                    Pour les autres types, la taille d'entreprise se renseigne
                    sur l'organisation cliente (section suivante). */}
                {dealType === "fundraising" ? (
                  <div>
                    <label style={lbl}>Stade startup</label>
                    <select value={companyStage} onChange={e => setCompanyStage(e.target.value)} style={inp}>
                      <option value="">— Non renseigné —</option>
                      {COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                ) : <div />}
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
                      <option value="client">Client</option>
                      <option value="investor">Investisseur</option>
                      <option value="business_angel">Business Angel</option>
                      <option value="family_office">Family Office</option>
                      <option value="corporate">Corporate / CVC</option>
                      <option value="bank">Banque</option>
                      <option value="buyer">Repreneur</option>
                      <option value="other">Autre</option>
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

            {/* Bloc Mandat */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Mandat associé</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["none", "existing", "new"] as const).map(m => (
                  <button key={m} type="button" onClick={() => setMandateMode(m)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                      background: mandateMode === m ? "var(--su-500, #1a56db)" : "var(--surface-2)",
                      color: mandateMode === m ? "#fff" : "var(--text-3)",
                      fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {m === "none" ? "Aucun" : m === "existing" ? "Sélectionner existant" : "Créer nouveau"}
                  </button>
                ))}
              </div>
              {mandateMode === "existing" && (
                <select value={mandateId} onChange={e => setMandateId(e.target.value)} style={inp}>
                  <option value="">— Choisir un mandat —</option>
                  {mandates.filter(m => m.status === "active" || m.status === "draft").map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.client_name ? ` — ${m.client_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {mandateMode === "new" && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <label style={lbl}>Nom du mandat *</label>
                    <input value={newMandateName} onChange={e => setNewMandateName(e.target.value)}
                      placeholder={`Mandat — ${name || "nouveau dossier"}`} style={inp} />
                  </div>
                  <div style={grid2}>
                    <div>
                      <label style={lbl}>Date de début</label>
                      <input type="date" value={newMandateStart} onChange={e => setNewMandateStart(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Date cible closing</label>
                      <input type="date" value={newMandateClose} onChange={e => setNewMandateClose(e.target.value)} style={inp} />
                    </div>
                  </div>
                  <div style={hint}>Le mandat prendra automatiquement le type et la devise du dossier.</div>
                </>
              )}
            </div>

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
        {step === 2 && dealType === "fundraising" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>Fundraising — levée de fonds</div>
            <div style={grid3}>
              <div>
                <label style={lbl}>Montant cible ({currencySymbol})</label>
                <input type="number" value={targetRaiseAmount} onChange={e => setTargetRaiseAmount(e.target.value)} placeholder="3000000" style={inp} />
              </div>
              <div>
                <label style={lbl}>Pre-money ({currencySymbol})</label>
                <input type="number" value={preMoneyValuation} onChange={e => setPreMoneyValuation(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Post-money ({currencySymbol})</label>
                <input type="number" value={postMoneyValuation} onChange={e => setPostMoneyValuation(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Type de round</label>
                <select value={roundType} onChange={e => setRoundType(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {ROUND_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Runway (mois)</label>
                <input type="number" value={runwayMonths} onChange={e => setRunwayMonths(e.target.value)} placeholder="12" style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Utilisation des fonds</label>
              <textarea rows={2} value={useOfFunds} onChange={e => setUseOfFunds(e.target.value)}
                placeholder="Recrutement, produit, marketing, international…" style={{ ...inp, resize: "vertical" }} />
            </div>
            <div>
              <label style={lbl}>Investisseurs actuels</label>
              <TagsInput values={currentInvestors} onChange={setCurrentInvestors} placeholder="Ajouter un investisseur puis Entrée" />
            </div>
          </div>
        )}

        {step === 2 && dealType === "ma_sell" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>M&A Sell-side — cession</div>
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
              <div style={hint}>Flag utilisé par le scoring M&A pour qualifier les repreneurs compatibles.</div>
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
            <div style={sectionTitle}>M&A Buy-side — critères d&apos;acquisition</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Secteurs visés</label>
              <MultiSelect values={targetSectors} onChange={setTargetSectors}
                options={SECTORS.map(s => ({ value: s, label: s }))}
                placeholder="Sélectionne un ou plusieurs secteurs" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Secteurs exclus</label>
              <MultiSelect values={excludedSectors} onChange={setExcludedSectors}
                options={SECTORS.map(s => ({ value: s, label: s }))}
                placeholder="Secteurs à exclure du matching (deal breaker)" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Géographies visées</label>
              <MultiSelect values={targetGeographies} onChange={setTargetGeographies}
                options={GEO_OPTIONS}
                placeholder="Zones géographiques cibles" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Géographies exclues</label>
              <MultiSelect values={excludedGeographies} onChange={setExcludedGeographies}
                options={GEO_OPTIONS}
                placeholder="Zones à exclure" />
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Revenue cible min ({currencySymbol})</label>
                <input type="number" value={targetRevenueMin} onChange={e => setTargetRevenueMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Revenue cible max ({currencySymbol})</label>
                <input type="number" value={targetRevenueMax} onChange={e => setTargetRevenueMax(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>EV cible min ({currencySymbol})</label>
                <input type="number" value={targetEvMin} onChange={e => setTargetEvMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>EV cible max ({currencySymbol})</label>
                <input type="number" value={targetEvMax} onChange={e => setTargetEvMax(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Budget acquisition min ({currencySymbol})</label>
                <input type="number" value={acquisitionBudgetMin} onChange={e => setAcquisitionBudgetMin(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Budget acquisition max ({currencySymbol})</label>
                <input type="number" value={acquisitionBudgetMax} onChange={e => setAcquisitionBudgetMax(e.target.value)} style={inp} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Stade cible</label>
                <select value={targetStage} onChange={e => setTargetStage(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Timing</label>
                <select value={dealTiming} onChange={e => setDealTiming(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {DEAL_TIMING_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
                <input type="checkbox" checked={fullAcquisitionRequired} onChange={e => setFullAcquisitionRequired(e.target.checked)} />
                Acquisition 100% requise (deal breaker)
              </label>
            </div>
            <div>
              <label style={lbl}>Rationale stratégique</label>
              <textarea rows={3} value={strategicRationale} onChange={e => setStrategicRationale(e.target.value)}
                placeholder="Synergies, expansion géo, consolidation…" style={{ ...inp, resize: "vertical" }} />
            </div>
          </div>
        )}

        {step === 2 && dealType === "recruitment" && (
          <div style={sectionCard}>
            <div style={sectionTitle}>Recrutement — fiche de poste</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Intitulé du poste *</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Head of Sales, CTO…" style={inp} />
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Séniorité requise</label>
                <select value={requiredSeniority} onChange={e => setRequiredSeniority(e.target.value)} style={inp}>
                  <option value="">— Non renseignée —</option>
                  {SENIORITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Remote policy</label>
                <select value={requiredRemote} onChange={e => setRequiredRemote(e.target.value)} style={inp}>
                  <option value="">— Non renseigné —</option>
                  {REMOTE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Localisation</label>
                <select value={requiredLocation} onChange={e => setRequiredLocation(e.target.value)} style={inp}>
                  <option value="">— Non renseignée —</option>
                  {GEO_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={lbl}>Salaire min ({currencySymbol})</label>
                  <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="80000" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Salaire max ({currencySymbol})</label>
                  <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="120000" style={inp} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Données financières */}
        {step === 3 && (
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
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
            {error}
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
          {step < 3 ? (
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
