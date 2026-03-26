"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft } from "lucide-react";
import { OrganisationTypeGrid, INVESTOR_TYPES } from "./OrganisationTypeGrid";
import { InvestorProfileFields, TICKET_OPTIONS, ticketKeyFromMinMax, type InvestorProfileData } from "./InvestorProfileFields";

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
  const [orgType, setOrgType] = useState(initialData.organization_type ?? "investor");
  const [name, setName] = useState(initialData.name ?? "");
  const [status, setStatus] = useState(initialData.base_status ?? "to_qualify");
  const [location, setLocation] = useState(initialData.location ?? "");
  const [website, setWebsite] = useState(initialData.website ?? "");
  const [linkedin, setLinkedin] = useState(initialData.linkedin_url ?? "");
  const [description, setDescription] = useState(initialData.description ?? "");
  const [notes, setNotes] = useState(initialData.notes ?? "");

  // Investor profile
  const [investorData, setInvestorData] = useState<InvestorProfileData>({
    ticketKey:   ticketKeyFromMinMax(initialData.investor_ticket_min ?? null, initialData.investor_ticket_max ?? null),
    stage:       (initialData.investor_stages ?? [])[0] ?? "",
    sectors:     initialData.investor_sectors ?? [],
    geographies: initialData.investor_geographies ?? [],
    thesis:      initialData.investor_thesis ?? "",
  });

  const isInvestorType = INVESTOR_TYPES.includes(orgType);

  // Validate sectors max 3
  function validateSectors(sectors: string[]): string | null {
    if (sectors.length > 3) {
      return "Un fonds peut sélectionner au maximum 3 secteurs d'investissement";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }

    // Validate sectors
    if (isInvestorType) {
      const sectorError = validateSectors(investorData.sectors);
      if (sectorError) { setError(sectorError); return; }
    }

    setLoading(true);
    setError("");

    // Resolve ticket min/max from key
    const ticketOpt = TICKET_OPTIONS.find(t => t.key === investorData.ticketKey);

    const body: Record<string, unknown> = {
      name: name.trim(),
      organization_type: orgType,
      base_status: status,
      location: location.trim() || null,
      website: website.trim() || null,
      linkedin_url: linkedin.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
    };

    if (isInvestorType) {
      body.investor_ticket_min   = ticketOpt?.min ?? null;
      body.investor_ticket_max   = ticketOpt?.max ?? null;
      body.investor_stages       = investorData.stage ? [investorData.stage] : [];
      body.investor_sectors      = investorData.sectors;
      body.investor_geographies  = investorData.geographies;
      body.investor_thesis       = investorData.thesis.trim() || null;
    }

    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/organisations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/organisations/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur serveur");
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
                <input style={inp} placeholder="ex: Paris (FR), Genève (CH)" value={location} onChange={e => setLocation(e.target.value)} />
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

          {/* Bloc 3 — Profil Investisseur (conditionnel) */}
          {isInvestorType && (
            <div style={section}>
              <InvestorProfileFields
                orgType={orgType}
                data={investorData}
                onChange={setInvestorData}
              />
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
