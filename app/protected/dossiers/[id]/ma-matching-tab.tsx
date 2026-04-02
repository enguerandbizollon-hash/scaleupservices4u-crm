"use client";
import { useState, useEffect, useCallback } from "react";
import { getMaBuyerMatches, getMaTargetMatches } from "@/actions/ma-matching";
import type { MaMatchResult } from "@/lib/crm/ma-scoring";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}`;
}

function scoreColor(score: number | null): { bg: string; tx: string } {
  if (score === null) return { bg: "var(--surface-3)", tx: "var(--text-5)" };
  if (score >= 70) return { bg: "#D1FAE5", tx: "#065F46" };
  if (score >= 40) return { bg: "#FEF3C7", tx: "#92400E" };
  return { bg: "#FEE2E2", tx: "#991B1B" };
}

function CriterionBar({ label, earned, max, reason }: { label: string; earned: number; max: number; reason: string }) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  const color = pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : pct > 0 ? "#EF4444" : "#D1D5DB";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--text-5)" }}>{earned}/{max}pts</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .3s" }} />
      </div>
      {reason && <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

function MaMatchCard({ match, dealType }: { match: MaMatchResult; dealType: "ma_sell" | "ma_buy" }) {
  const [expanded, setExpanded] = useState(false);
  const { bg, tx } = scoreColor(match.score);
  const orgTypeLabel: Record<string, string> = {
    buyer: "Acheteur", corporate: "Corporate", investor: "Investisseur",
    business_angel: "Business Angel", family_office: "Family Office",
    target: "Cible", client: "Client", prospect_client: "Prospect",
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link
              href={`/protected/organisations/${match.org.id}`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}
            >
              {match.org.name}
            </Link>
            <ExternalLink size={11} color="var(--text-5)" />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {match.org.organization_type && (
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>
                {orgTypeLabel[match.org.organization_type] ?? match.org.organization_type}
              </span>
            )}
            {match.org.location && (
              <span style={{ fontSize: 11, color: "var(--text-5)" }}>📍 {match.org.location}</span>
            )}
            {match.org.sector && (
              <span style={{ fontSize: 11, color: "var(--text-5)" }}>{match.org.sector}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: tx, background: bg, borderRadius: 10, padding: "4px 12px", minWidth: 48 }}>
            {match.score !== null ? match.score : "✕"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 2 }}>score</div>
        </div>
      </div>

      {/* Deal breaker */}
      {match.dealBreaker && (
        <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", borderRadius: 8, padding: "6px 10px" }}>
          ✕ {match.dealBreaker}
        </div>
      )}

      {/* Scores synthèse */}
      {match.score !== null && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 8, padding: "7px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{match.strategicScore}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-5)" }}>Stratégique</div>
          </div>
          {match.financialScore !== null && (
            <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 8, padding: "7px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{match.financialScore}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-5)" }}>Financier</div>
            </div>
          )}
        </div>
      )}

      {/* Détail critères */}
      {match.score !== null && (
        <button
          onClick={() => setExpanded(p => !p)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-4)", textAlign: "left", padding: 0, fontFamily: "inherit" }}
        >
          {expanded ? "▲ Masquer le détail" : "▼ Voir le détail"}
        </button>
      )}

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>Critères stratégiques</div>
          <CriterionBar label="Secteur"    earned={match.breakdown.sector.earned}    max={match.breakdown.sector.max}    reason={match.breakdown.sector.reason} />
          <CriterionBar label="Taille"     earned={match.breakdown.size.earned}      max={match.breakdown.size.max}      reason={match.breakdown.size.reason} />
          <CriterionBar label="Géographie" earned={match.breakdown.geography.earned} max={match.breakdown.geography.max} reason={match.breakdown.geography.reason} />
          <CriterionBar label="Profil"     earned={match.breakdown.profile.earned}   max={match.breakdown.profile.max}   reason={match.breakdown.profile.reason} />
          <CriterionBar label="Timing"     earned={match.breakdown.timing.earned}    max={match.breakdown.timing.max}    reason={match.breakdown.timing.reason} />

          {match.financialBreakdown && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", margin: "10px 0 8px", textTransform: "uppercase", letterSpacing: ".05em" }}>Critères financiers</div>
              <CriterionBar label="Croissance"   earned={match.financialBreakdown.growth.earned}      max={match.financialBreakdown.growth.max}      reason={match.financialBreakdown.growth.reason} />
              <CriterionBar label="Marge EBITDA" earned={match.financialBreakdown.margin.earned}      max={match.financialBreakdown.margin.max}      reason={match.financialBreakdown.margin.reason} />
              <CriterionBar label="Bilan"        earned={match.financialBreakdown.balance.earned}     max={match.financialBreakdown.balance.max}     reason={match.financialBreakdown.balance.reason} />
              <CriterionBar label="Comparables"  earned={match.financialBreakdown.comparables.earned} max={match.financialBreakdown.comparables.max} reason={match.financialBreakdown.comparables.reason} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── MaMatchingTab ──────────────────────────────────────────────────────────────

const MIN_SCORE_OPTIONS = [
  { value: -1, label: "Tous (deal breakers inclus)" },
  { value: 0,  label: "Score ≥ 0" },
  { value: 40, label: "Score ≥ 40" },
  { value: 70, label: "Score ≥ 70" },
  { value: 90, label: "Score ≥ 90" },
];

interface MaMatchingTabProps {
  dealId: string;
  dealType: "ma_sell" | "ma_buy";
}

export function MaMatchingTab({ dealId, dealType }: MaMatchingTabProps) {
  const [matches, setMatches]       = useState<MaMatchResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [minScore, setMinScore]     = useState(-1);
  const [search, setSearch]         = useState("");
  const [showAll, setShowAll]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = dealType === "ma_sell"
      ? await getMaBuyerMatches(dealId, showAll)
      : await getMaTargetMatches(dealId, showAll);
    if (result.error) setError(result.error);
    else setMatches(result.matches);
    setLoading(false);
  }, [dealId, dealType, showAll]);

  useEffect(() => { load(); }, [load]);

  const filtered = matches.filter(m => {
    if (minScore >= 0 && (m.score === null || m.score < minScore)) return false;
    if (search.trim().length >= 2 && !m.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total:   matches.length,
    matched: matches.filter(m => m.score !== null && m.score >= 40).length,
    hot:     matches.filter(m => m.score !== null && m.score >= 70).length,
    breaker: matches.filter(m => m.score === null).length,
  };

  const emptyMsg = dealType === "ma_sell"
    ? "Ajoutez des organisations de type Acheteur, Corporate ou Investisseur pour activer le matching."
    : "Ajoutez des organisations de type Cible (sale_readiness = open/actively_selling) pour activer le matching.";

  const inp: React.CSSProperties = {
    padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface-2)", color: "var(--text-1)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-5)" }}>Calcul du matching M&A…</div>
  );

  if (error) return (
    <div style={{ padding: 24, color: "#991B1B", fontSize: 13 }}>Erreur : {error}</div>
  );

  if (matches.length === 0) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
        Aucune contrepartie à matcher
      </div>
      <div style={{ fontSize: 13, color: "var(--text-5)", maxWidth: 400, margin: "0 auto" }}>
        {emptyMsg}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { label: "Contreparties analysées", value: counts.total,   bg: "var(--surface-2)" },
          { label: "Score ≥ 40",              value: counts.matched, bg: "#DBEAFE", tx: "#1D4ED8" },
          { label: "Score ≥ 70 (fort)",       value: counts.hot,     bg: "#D1FAE5", tx: "#065F46" },
          { label: "Deal breakers",           value: counts.breaker, bg: "#FEE2E2", tx: "#991B1B" },
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
          placeholder={dealType === "ma_sell" ? "Rechercher un acheteur…" : "Rechercher une cible…"}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inp} value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
          {MIN_SCORE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAll(p => !p)}
          style={{
            ...inp, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap",
            border: showAll ? "1.5px solid #1a56db" : "1px solid var(--border)",
            background: showAll ? "#eff6ff" : "var(--surface-2)",
            color: showAll ? "#1a56db" : "var(--text-3)",
          }}
        >
          {showAll
            ? (dealType === "ma_sell" ? "✓ Tous buyers" : "✓ Toutes cibles")
            : (dealType === "ma_sell" ? "Inclure inactifs" : "Inclure 'non à vendre'")}
        </button>
        <button onClick={load} style={{ ...inp, cursor: "pointer", color: "var(--text-3)", fontWeight: 500 }}>↺</button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
          Aucune contrepartie ne correspond à ces critères.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
          {filtered.map(m => (
            <MaMatchCard key={m.org.id} match={m} dealType={dealType} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-5)", textAlign: "right" }}>
          {filtered.length} contrepartie{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
