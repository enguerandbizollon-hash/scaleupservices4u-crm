"use client";
import { useState, useEffect, useCallback } from "react";
import { getInvestorMatches, type InvestorMatch } from "@/actions/matching";
import { InvestorMatchCard } from "@/app/protected/components/investor-match-card";

const MIN_SCORE_OPTIONS = [
  { value: -1,  label: "Tous (profils incomplets inclus)" },
  { value: 0,   label: "Score ≥ 0" },
  { value: 40,  label: "Score ≥ 40" },
  { value: 70,  label: "Score ≥ 70" },
  { value: 90,  label: "Score ≥ 90" },
];

interface MatchingTabProps {
  dealId: string;
  onCreateActivity: (orgId: string, orgName: string) => void;
}

export function MatchingTab({ dealId, onCreateActivity }: MatchingTabProps) {
  const [matches, setMatches] = useState<InvestorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(-1);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getInvestorMatches(dealId, showInactive);
    if (result.error) setError(result.error);
    else setMatches(result.matches);
    setLoading(false);
  }, [dealId, showInactive]);

  useEffect(() => { load(); }, [load]);

  // Quand un investisseur est désactivé depuis la card, on met à jour localement
  function handleStatusChange(orgId: string, newStatus: "active" | "inactive") {
    if (!showInactive && newStatus === "inactive") {
      // Retirer de la liste si on ne montre pas les inactifs
      setMatches(p => p.filter(m => m.org.id !== orgId));
    } else {
      setMatches(p => p.map(m => m.org.id === orgId ? { ...m, org: { ...m.org, base_status: newStatus } } : m));
    }
  }

  const filtered = matches.filter(m => {
    if (!showInactive && m.org.base_status === "inactive") return false;
    if (minScore >= 0 && (m.score === null || m.score < minScore)) return false;
    if (minScore === -1) { /* tout afficher */ }
    if (search.trim().length >= 2 && !m.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total:   matches.filter(m => m.org.base_status !== "inactive" || showInactive).length,
    matched: matches.filter(m => m.score !== null && m.score >= 40).length,
    hot:     matches.filter(m => m.score !== null && m.score >= 70).length,
  };

  const inp: React.CSSProperties = {
    padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface-2)", color: "var(--text-1)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-5)" }}>
      Calcul du matching…
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, color: "var(--rec-tx)", fontSize: 13 }}>
      Erreur : {error}
    </div>
  );

  if (matches.length === 0) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
        Aucun investisseur à matcher
      </div>
      <div style={{ fontSize: 13, color: "var(--text-5)", maxWidth: 360, margin: "0 auto" }}>
        Ajoutez des organisations de type "Investisseur", "Business Angel", "Family Office" ou "Corporate/CVC" et renseignez leurs critères pour activer le matching.
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { label: "Investisseurs actifs", value: counts.total,   bg: "var(--surface-2)" },
          { label: "Score ≥ 40",           value: counts.matched, bg: "#DBEAFE", tx: "#1D4ED8" },
          { label: "Score ≥ 70",           value: counts.hot,     bg: "#D1FAE5", tx: "#065F46" },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px 16px", borderRadius: 10, background: s.bg, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: (s as any).tx ?? "var(--text-1)" }}>{s.value}</span>
            <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inp, flex: 1, minWidth: 180 }}
          placeholder="Rechercher un investisseur…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inp} value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
          {MIN_SCORE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {/* Toggle inactifs */}
        <button
          onClick={() => setShowInactive(p => !p)}
          style={{
            ...inp,
            cursor: "pointer",
            fontWeight: 500,
            border: showInactive ? "1.5px solid #1a56db" : "1px solid var(--border)",
            background: showInactive ? "#eff6ff" : "var(--surface-2)",
            color: showInactive ? "#1a56db" : "var(--text-3)",
            whiteSpace: "nowrap",
          }}
        >
          {showInactive ? "✓ Inactifs visibles" : "Afficher inactifs"}
        </button>
        <button
          onClick={load}
          style={{ ...inp, cursor: "pointer", color: "var(--text-3)", fontWeight: 500 }}
        >
          ↺
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
          Aucun investisseur ne correspond à ces critères.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
          {filtered.map(m => (
            <InvestorMatchCard
              key={m.org.id}
              match={m}
              onCreateActivity={onCreateActivity}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-5)", textAlign: "right" }}>
          {filtered.length} investisseur{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
