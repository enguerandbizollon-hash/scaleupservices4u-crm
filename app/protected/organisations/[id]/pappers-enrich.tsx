"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle } from "lucide-react";

type PappersResult = {
  nom_entreprise?: string;
  siren?: string;
  siret?: string;
  dirigeants?: { nom?: string; prenom?: string; qualite?: string }[];
  siege?: { adresse_ligne_1?: string; code_postal?: string; ville?: string };
  domaine_activite?: string;
  site_web?: string | null;
  chiffre_affaires?: number;
  resultat?: number;
};

export function PappersEnrich({ orgName, onEnrich }: { orgName: string; onEnrich: (data: Partial<{ sector: string; country: string; website: string; notes: string }>) => void }) {
  const [query, setQuery] = useState(orgName);
  const [results, setResults] = useState<PappersResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriched, setEnriched] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pappers?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.resultats ?? []);
    } finally { setLoading(false); }
  }

  function apply(r: PappersResult) {
    const notes = [
      r.siren ? `SIREN: ${r.siren}` : "",
      r.siret ? `SIRET: ${r.siret}` : "",
      r.chiffre_affaires ? `CA: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(r.chiffre_affaires)}` : "",
      r.resultat ? `Résultat: ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(r.resultat)}` : "",
      r.dirigeants?.length ? `Dirigeants: ${r.dirigeants.map(d => `${d.prenom ?? ""} ${d.nom ?? ""} (${d.qualite ?? ""})`).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    onEnrich({
      sector: r.domaine_activite ?? undefined,
      country: "France",
      website: r.site_web ?? undefined,
      notes,
    });
    setEnriched(true);
    setResults([]);
  }

  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--su-50)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--su-600)", marginBottom: 10 }}>
        🏢 ENRICHIR DEPUIS PAPPERS
      </div>

      {enriched ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--deal-fundraising-text)", fontSize: 12, fontWeight: 600 }}>
          <CheckCircle size={14} /> Données enrichies. Enregistre le formulaire pour sauvegarder.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Nom de l'entreprise ou SIRET…"
              className="su-input" style={{ flex: 1, fontSize: 12 }}
            />
            <button onClick={search} disabled={loading} className="su-btn-primary" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12 }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              {loading ? "Recherche…" : "Chercher"}
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.slice(0, 4).map((r, i) => (
                <button key={i} onClick={() => apply(r)}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "white", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>{r.nom_entreprise}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {r.siren && `SIREN: ${r.siren}`}
                    {r.siege?.ville && ` · ${r.siege.ville}`}
                    {r.domaine_activite && ` · ${r.domaine_activite}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
