"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft } from "lucide-react";
import { OrganisationTypeGrid } from "./OrganisationTypeGrid";
import { CompanyProfileFields, type CompanyProfileData } from "./CompanyProfileFields";
import { MaSellerFields, type MaSellerData } from "./MaSellerFields";
import { MaBuyerFields, type MaBuyerData } from "./MaBuyerFields";
import { AcquirerProfileFields, type AcquirerProfileData } from "./AcquirerProfileFields";
import { createOrganisationAction, updateOrganisationAction } from "@/actions/organisations";
import { ACQUIRER_BUYER_TYPES } from "@/lib/crm/acquirer-scoring";
import { COMPANY_PROFILE_TYPES } from "@/lib/crm/labels";
import { GeoSelect } from "@/components/ui/GeoSelect";
import { DedupAlert } from "./DedupAlert";

// Types qui affichent le profil entreprise : source unique lib/crm/labels.ts,
// partagée avec la fiche organisation (le save écrase toute colonne absente
// du bloc affiché, les deux listes doivent être identiques).

// ── Types ─────────────────────────────────────────────────────────────

export interface OrgFormInitialData {
  id?: string;
  name?: string;
  organization_type?: string;
  base_status?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  description?: string;
  notes?: string;
  // Investor fields
  investor_ticket_min?: number | null;
  investor_ticket_max?: number | null;
  investor_sectors?: string[];
  investor_stages?: string[];
  investor_geographies?: string[];
  investor_thesis?: string | null;
  investor_stage_min?: string | null;
  investor_stage_max?: string | null;
  // Company profile fields
  sector?: string | null;
  founded_year?: number | null;
  employee_count?: number | null;
  company_stage?: string | null;
  revenue_range?: string | null;
  // M&A seller
  sale_readiness?: string | null;
  partial_sale_ok?: boolean;
  // M&A buyer
  acquisition_rationale?: string | null;
  target_sectors?: string[];
  excluded_sectors?: string[];
  target_geographies?: string[];
  target_revenue_min?: number | null;
  target_revenue_max?: number | null;
  // Acquirer profile
  acquirer_type?: string | null;
  acquisition_motivations?: string[];
  target_ebitda_min?: number | null;
  target_ebitda_max?: number | null;
  acquisition_history?: string | null;
  operation_types?: string[];
  deal_stance?: string | null;
  acquirer_summary?: string | null;
}

interface OrganisationFormProps {
  mode: "create" | "edit";
  initialData?: OrgFormInitialData;
}

// ── Constants ────────────────────────────────────────────────────────

const STATUSES = [
  { value: "active",     label: "Actif" },
  { value: "to_qualify", label: "Non qualifié" },
  { value: "inactive",   label: "Inactif" },
];

// ── Styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8,
  fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff",
  color: "#111", boxSizing: "border-box",
};
const sel: React.CSSProperties = { ...inp };
const lbl: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 };
const section: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 22px", marginBottom: 14 };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };

// ── Component ─────────────────────────────────────────────────────────

export function OrganisationForm({ mode, initialData = {} }: OrganisationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // General fields
  const [orgType, setOrgType] = useState(initialData.organization_type ?? "other");
  const [name, setName] = useState(initialData.name ?? "");
  const [status, setStatus] = useState(initialData.base_status ?? "to_qualify");
  const [location, setLocation] = useState(initialData.location ?? "");
  const [website, setWebsite] = useState(initialData.website ?? "");
  const [linkedin, setLinkedin] = useState(initialData.linkedin_url ?? "");
  const [description, setDescription] = useState(initialData.description ?? "");
  const [notes, setNotes] = useState(initialData.notes ?? "");

  // Company profile
  const [companyData, setCompanyData] = useState<CompanyProfileData>({
    sector:         initialData.sector ?? "",
    founded_year:   initialData.founded_year ?? null,
    employee_count: initialData.employee_count ?? null,
    company_stage:  initialData.company_stage ?? "",
    revenue_range:  initialData.revenue_range ?? "",
  });

  // M&A seller (type = target)
  const [maSellerData, setMaSellerData] = useState<MaSellerData>({
    sale_readiness:  initialData.sale_readiness ?? "not_for_sale",
    partial_sale_ok: initialData.partial_sale_ok ?? true,
  });

  // M&A buyer (type = buyer) — rationale + excluded_sectors uniquement
  // target_sectors / target_geographies / target_revenue sont gérés par AcquirerProfileFields
  const [maBuyerData, setMaBuyerData] = useState<MaBuyerData>({
    acquisition_rationale: initialData.acquisition_rationale ?? "",
    excluded_sectors:      initialData.excluded_sectors ?? [],
  });

  // Acquirer profile — toutes les familles scorées par le matching portent
  // le profil acquéreur. Même liste que le scorer (ACQUIRER_BUYER_TYPES) :
  // un business_angel scoré mais sans formulaire perdait son profil au save.
  const [acquirerData, setAcquirerData] = useState<AcquirerProfileData>({
    acquirer_type:           initialData.acquirer_type ?? "",
    acquisition_motivations: initialData.acquisition_motivations ?? [],
    target_sectors:          initialData.target_sectors ?? [],
    target_geographies:      initialData.target_geographies ?? [],
    target_revenue_min:      initialData.target_revenue_min ?? null,
    target_revenue_max:      initialData.target_revenue_max ?? null,
    target_ebitda_min:       initialData.target_ebitda_min ?? null,
    target_ebitda_max:       initialData.target_ebitda_max ?? null,
    acquisition_history:     initialData.acquisition_history ?? "",
    operation_types:         initialData.operation_types ?? [],
    deal_stance:             initialData.deal_stance ?? "",
    acquirer_summary:        initialData.acquirer_summary ?? "",
  });

  const isCompanyType      = COMPANY_PROFILE_TYPES.includes(orgType);
  const isMaTarget         = orgType === "target";
  const isAcquirerType     = ACQUIRER_BUYER_TYPES.includes(orgType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }

    setLoading(true);
    setError("");

    const data = {
      name:         name.trim(),
      organization_type: orgType,
      base_status:  status,
      location:     location.trim() || null,
      website:      website.trim() || null,
      linkedin_url: linkedin.trim() || null,
      description:  description.trim() || null,
      notes:        notes.trim() || null,
      // Investor (colonnes héritées du fundraising : plus de saisie, on
      // repasse les valeurs existantes telles quelles pour ne rien effacer)
      investor_ticket_min:  initialData.investor_ticket_min ?? null,
      investor_ticket_max:  initialData.investor_ticket_max ?? null,
      investor_stages:      initialData.investor_stages ?? [],
      investor_sectors:     initialData.investor_sectors ?? [],
      investor_geographies: initialData.investor_geographies ?? [],
      investor_thesis:      initialData.investor_thesis ?? null,
      investor_stage_min:   initialData.investor_stage_min ?? null,
      investor_stage_max:   initialData.investor_stage_max ?? null,
      // Company profile
      sector:         isCompanyType ? (companyData.sector || null) : null,
      founded_year:   isCompanyType ? companyData.founded_year : null,
      employee_count: isCompanyType ? companyData.employee_count : null,
      company_stage:  isCompanyType ? (companyData.company_stage || null) : null,
      revenue_range:  isCompanyType ? (companyData.revenue_range || null) : null,
      // M&A seller
      sale_readiness:  isMaTarget ? maSellerData.sale_readiness : null,
      partial_sale_ok: isMaTarget ? maSellerData.partial_sale_ok : true,
      // M&A buyer — rationale + excluded_sectors, pour TOUTES les familles
      // acquéreurs (le scorer lit excluded_sectors quel que soit le type).
      acquisition_rationale: isAcquirerType ? (maBuyerData.acquisition_rationale.trim() || null) : null,
      excluded_sectors:      isAcquirerType ? maBuyerData.excluded_sectors : [],
      // Acquirer profile — source unique pour target_sectors, target_geographies,
      // target_revenue_*, target_ebitda_*, acquirer_type, motivations, history
      target_sectors:          isAcquirerType ? acquirerData.target_sectors : [],
      target_geographies:      isAcquirerType ? acquirerData.target_geographies : [],
      target_revenue_min:      isAcquirerType ? acquirerData.target_revenue_min : null,
      target_revenue_max:      isAcquirerType ? acquirerData.target_revenue_max : null,
      acquirer_type:           isAcquirerType ? (acquirerData.acquirer_type || null) : null,
      acquisition_motivations: isAcquirerType ? acquirerData.acquisition_motivations : [],
      target_ebitda_min:       isAcquirerType ? acquirerData.target_ebitda_min : null,
      target_ebitda_max:       isAcquirerType ? acquirerData.target_ebitda_max : null,
      acquisition_history:     isAcquirerType ? (acquirerData.acquisition_history.trim() || null) : null,
      operation_types:         isAcquirerType ? acquirerData.operation_types : [],
      deal_stance:             isAcquirerType ? (acquirerData.deal_stance || null) : null,
      acquirer_summary:        isAcquirerType ? (acquirerData.acquirer_summary.trim() || null) : null,
    };

    try {
      const result = mode === "create"
        ? await createOrganisationAction(data)
        : await updateOrganisationAction(initialData.id!, data);

      if (!result.success) throw new Error(result.error);

      router.push(mode === "create" ? "/protected/organisations" : `/protected/organisations/${initialData.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "28px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <Link
          href={mode === "edit" && initialData.id ? `/protected/organisations/${initialData.id}` : "/protected/organisations"}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6b7280", textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={13} /> {mode === "edit" ? "Retour" : "Organisations"}
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={18} color="#1a56db" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>
              {mode === "create" ? "Nouvelle organisation" : `Modifier — ${initialData.name}`}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              {mode === "create" ? "Les champs varient selon le type" : "Mettre à jour les informations"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Bloc 1 — Type */}
          <div style={section}>
            <label style={{ ...lbl, marginBottom: 12 }}>Type d'organisation *</label>
            <OrganisationTypeGrid value={orgType} onChange={setOrgType} />
          </div>

          {/* Bloc 2 — Infos générales */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 14 }}>Informations générales</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Nom *</label>
              <input
                required
                style={inp}
                placeholder="ex: Alven Capital, Andreessen Horowitz..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Statut</label>
                <select style={sel} value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Localisation</label>
                <GeoSelect mode="single" value={location || null} onChange={v => setLocation(v ?? "")} placeholder="— Non renseignée —" />
              </div>
              <div>
                <label style={lbl}>Site web</label>
                <input style={inp} type="url" placeholder="https://…" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>LinkedIn</label>
                <input style={inp} placeholder="https://linkedin.com/company/…" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Alerte doublons */}
          <DedupAlert
            name={name}
            website={website}
            linkedinUrl={linkedin}
            excludeId={initialData.id}
          />

          {/* Bloc 3b — Profil Entreprise (client, prospect, cible, acquéreur…) */}
          {isCompanyType && (
            <div style={section}>
              <CompanyProfileFields data={companyData} onChange={setCompanyData} />
            </div>
          )}

          {/* Bloc 3c — Profil cédant M&A (type = target) */}
          {isMaTarget && (
            <div style={section}>
              <MaSellerFields data={maSellerData} onChange={setMaSellerData} />
            </div>
          )}

          {/* Bloc 3d — Rationale + secteurs exclus (toutes familles acquéreurs) */}
          {isAcquirerType && (
            <div style={section}>
              <MaBuyerFields data={maBuyerData} onChange={setMaBuyerData} />
            </div>
          )}

          {/* Bloc 3e — Profil acquéreur (toutes familles scorées par le matching) */}
          {isAcquirerType && (
            <div style={section}>
              <AcquirerProfileFields data={acquirerData} onChange={setAcquirerData} />
            </div>
          )}

          {/* Bloc 4 — Notes */}
          <div style={section}>
            <label style={lbl}>Notes internes</label>
            <textarea
              rows={3}
              style={{ ...inp, resize: "vertical" }}
              placeholder="Informations complémentaires, contexte..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Link
              href={mode === "edit" && initialData.id ? `/protected/organisations/${initialData.id}` : "/protected/organisations"}
              style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #d1d5db", background: "#fff", color: "#374151", textDecoration: "none", fontSize: 13.5 }}
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "9px 22px", borderRadius: 9, background: "#1a56db", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Enregistrement…" : mode === "create" ? "Créer l'organisation" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
