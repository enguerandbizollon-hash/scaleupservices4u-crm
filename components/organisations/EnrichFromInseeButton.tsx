"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Search, X, Check, AlertCircle } from "lucide-react";
import {
  previewEnrichmentBySiren,
  searchEnrichmentByName,
  applyEnrichmentToOrganisation,
  type EnrichmentPreview,
} from "@/actions/organisations";

export function EnrichFromInseeButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [siren, setSiren] = useState("");
  const [searchQuery, setSearchQuery] = useState(orgName);
  const [searchResults, setSearchResults] = useState<EnrichmentPreview[]>([]);
  const [preview, setPreview] = useState<EnrichmentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);

  function reset() {
    setSiren("");
    setSearchQuery(orgName);
    setSearchResults([]);
    setPreview(null);
    setError(null);
    setOverwrite(false);
  }

  async function handleLookupBySiren() {
    setError(null);
    setSearchResults([]);
    setLoading(true);
    const res = await previewEnrichmentBySiren(siren);
    setLoading(false);
    if (res.success) setPreview(res.data);
    else setError(res.error);
  }

  async function handleSearchByName() {
    setError(null);
    setPreview(null);
    setLoading(true);
    const res = await searchEnrichmentByName(searchQuery);
    setLoading(false);
    if (res.success) {
      setSearchResults(res.data);
      if (res.data.length === 0) setError(`Aucune entreprise trouvée pour "${searchQuery.trim()}".`);
    } else {
      setError(res.error);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    const res = await applyEnrichmentToOrganisation(orgId, preview, { overwrite });
    setApplying(false);
    if (res.success) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--surface-2)",
          color: "var(--text-2)", fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}
        title="Enrichir depuis INSEE/SIRENE (API publique gratuite)"
      >
        <Sparkles size={12} /> Enrichir (INSEE)
      </button>
    );
  }

  return (
    <>
      <div onClick={() => { setOpen(false); reset(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 400 }} />
      <div role="dialog" aria-modal="true" style={{
        position: "fixed",
        top: "10vh", left: "50%", transform: "translateX(-50%)",
        width: "min(640px, 92vw)",
        maxHeight: "80vh",
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 14, zIndex: 401,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 48px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={15} color="var(--text-3)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Enrichir depuis INSEE</span>
          </div>
          <button type="button" onClick={() => { setOpen(false); reset(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {!preview && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-4)", marginBottom: 14, lineHeight: 1.5 }}>
                Récupère les données légales depuis l&apos;API publique <code style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>recherche-entreprises.api.gouv.fr</code> (INSEE SIRENE). Gratuit, sans clé. SIREN à 9 chiffres ou recherche par nom.
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>SIREN (9 chiffres)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text" inputMode="numeric"
                    value={siren}
                    onChange={(e) => setSiren(e.target.value.replace(/\s+/g, ""))}
                    placeholder="ex: 552120222"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button type="button" onClick={handleLookupBySiren} disabled={loading || siren.replace(/\s/g, "").length !== 9} style={primaryBtn(loading || siren.replace(/\s/g, "").length !== 9)}>
                    {loading ? "..." : "Chercher"}
                  </button>
                </div>
              </div>

              <div style={{ position: "relative", textAlign: "center", margin: "18px 0" }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "var(--border)" }} />
                <span style={{ position: "relative", background: "var(--surface)", padding: "0 12px", fontSize: 11, color: "var(--text-5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>OU</span>
              </div>

              <div>
                <label style={labelStyle}>Recherche par nom</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom de l'entreprise"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button type="button" onClick={handleSearchByName} disabled={loading || searchQuery.trim().length < 3} style={secondaryBtn(loading || searchQuery.trim().length < 3)}>
                    <Search size={12} /> Rechercher
                  </button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}
                  </div>
                  {searchResults.map((r) => (
                    <button key={r.siren} type="button" onClick={() => setPreview(r)} style={resultRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{r.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                          SIREN {r.siren} · {r.forme_juridique ?? "—"} · {r.city ?? r.address ?? "—"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div style={errorBox}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </>
          )}

          {preview && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
                {preview.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-5)", marginBottom: 16 }}>
                SIREN {preview.siren}
                {preview.forme_juridique && ` · ${preview.forme_juridique}`}
                {preview.category && ` · ${preview.category}`}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, fontSize: 12.5, marginBottom: 16 }}>
                <FieldRow label="Création" value={preview.founded_year != null ? `${preview.founded_year}` : null} />
                <FieldRow label="Effectif" value={preview.effectif_label} />
                <FieldRow label="Stade CRM" value={preview.company_stage_crm} />
                <FieldRow label="Activité" value={preview.activite} />
                <FieldRow label="Adresse" value={preview.address} />
                <FieldRow label="Ville" value={preview.city} />
                <FieldRow label="Pays" value={preview.country} />
              </div>

              {preview.dirigeants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                    Dirigeants ({preview.dirigeants.length})
                  </div>
                  {preview.dirigeants.slice(0, 5).map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: "var(--text-2)", padding: "3px 0" }}>
                      <strong>{d.name}</strong>
                      {d.qualite && <span style={{ color: "var(--text-5)" }}> · {d.qualite}</span>}
                    </div>
                  ))}
                </div>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)", padding: "6px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                Écraser les valeurs déjà saisies (par défaut : seuls les champs vides sont remplis)
              </label>

              {error && (
                <div style={errorBox}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {preview && (
            <button type="button" onClick={() => { setPreview(null); setError(null); }} style={secondaryBtn(false)}>
              Retour
            </button>
          )}
          <button type="button" onClick={() => { setOpen(false); reset(); }} style={secondaryBtn(false)}>
            Fermer
          </button>
          {preview && (
            <button type="button" onClick={handleApply} disabled={applying} style={primaryBtn(applying)}>
              <Check size={12} /> {applying ? "..." : "Appliquer"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? "var(--text-1)" : "var(--text-5)", fontStyle: value ? "normal" : "italic" }}>
        {value ?? "—"}
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "var(--text-4)", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: ".05em",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)", borderRadius: 8,
  background: "var(--surface-2)", color: "var(--text-1)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "8px 14px", borderRadius: 8,
    border: "none", background: "var(--accent, #1a56db)",
    color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}
function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "8px 14px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-2)",
    color: "var(--text-3)", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

const resultRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9,
  padding: "9px 11px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-2)",
  cursor: "pointer", textAlign: "left",
  fontFamily: "inherit",
};

const errorBox: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  marginTop: 12, padding: "8px 12px",
  borderRadius: 8, background: "#FEE2E2",
  color: "#991B1B", fontSize: 12.5,
};
