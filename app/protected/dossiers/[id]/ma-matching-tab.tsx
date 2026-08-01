"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMaTargetMatches,
  getAcquirerMatches, ensureAcquirerSuggestion, aiJustifyAcquirers,
  type AcquirerMatchView,
} from "@/actions/ma-matching";
import { approveSuggestion, rejectSuggestion, markSuggestionContacted } from "@/actions/suggestions";
import { updateDealField } from "@/actions/deals";
import type { MaMatchResult } from "@/lib/crm/ma-scoring";
import { OPERATION_TYPES, DEAL_STANCES, DEAL_CONTEXTS } from "@/lib/crm/matching-maps";
import { organizationTypeLabels } from "@/lib/crm/labels";
import Link from "next/link";
import { ExternalLink, Sparkles, Loader2 } from "lucide-react";

// ── Helpers partagés ─────────────────────────────────────────────────────────

function scoreColor(score: number | null): { bg: string; tx: string } {
  if (score === null) return { bg: "var(--surface-3)", tx: "var(--text-5)" };
  if (score >= 70) return { bg: "#D1FAE5", tx: "#065F46" };
  if (score >= 40) return { bg: "#FEF3C7", tx: "#92400E" };
  return { bg: "#FEE2E2", tx: "#991B1B" };
}

function CriterionBar({ label, earned, max, reason, muted }: { label: string; earned: number; max: number; reason: string; muted?: boolean }) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  const color = muted ? "#D1D5DB" : pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : pct > 0 ? "#EF4444" : "#D1D5DB";
  return (
    <div style={{ marginBottom: 6, opacity: muted ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 }}>
          {label}{muted ? " · non évalué" : ""}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-5)" }}>{earned}/{max}pts</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .3s" }} />
      </div>
      {reason && <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

// Un seul mot pour l'acheteur dans tout l'outil : « Acquéreur »
// (source unique lib/crm/labels.ts, fin du Acheteur/Repreneur selon l'écran).
const ORG_TYPE_LABELS = organizationTypeLabels;

// ── Vue ACQUÉREURS (ma_sell) — scoring V2, grille métier ─────────────────────

const SUGGESTION_STATUS_META: Record<string, { label: string; bg: string; tx: string }> = {
  suggested: { label: "Suggéré",  bg: "var(--surface-2)", tx: "var(--text-4)" },
  approved:  { label: "Approuvé", bg: "#D1FAE5", tx: "#065F46" },
  rejected:  { label: "Écarté",   bg: "#FEE2E2", tx: "#991B1B" },
  deferred:  { label: "Plus tard", bg: "#FEF3C7", tx: "#92400E" },
  contacted: { label: "Contacté", bg: "#DBEAFE", tx: "#1D4ED8" },
};

function AcquirerCard({ dealId, match, onStatusChange }: {
  dealId: string;
  match: AcquirerMatchView;
  onStatusChange: (orgId: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { result, org, suggestion } = match;
  const { bg, tx } = scoreColor(result.score);
  const status = suggestion?.status ?? null;

  async function setStatus(target: "approved" | "rejected" | "contacted") {
    if (acting) return;
    setActing(true);
    setActionError(null);
    const ensured = await ensureAcquirerSuggestion(dealId, org.id, result.score);
    if (!ensured.success) { setActionError(ensured.error); setActing(false); return; }
    const res = target === "approved" ? await approveSuggestion(ensured.id)
      : target === "rejected" ? await rejectSuggestion(ensured.id)
      : await markSuggestionContacted(ensured.id);
    setActing(false);
    if (res && "error" in res && res.error) { setActionError(String(res.error)); return; }
    onStatusChange(org.id, target);
  }

  const statusBtn = (target: "approved" | "rejected" | "contacted", label: string): React.CSSProperties => {
    const active = status === target;
    const meta = SUGGESTION_STATUS_META[target];
    return {
      padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
      fontFamily: "inherit", border: `1px solid ${active ? meta.tx : "var(--border)"}`,
      background: active ? meta.bg : "var(--surface-2)",
      color: active ? meta.tx : "var(--text-4)",
      opacity: acting ? 0.6 : 1,
    };
  };

  const stanceLabel = org.deal_stance ? DEAL_STANCES.find(s => s.value === org.deal_stance)?.label : null;
  const opsLabels = (org.operation_types ?? []).map(o => OPERATION_TYPES.find(t => t.value === o)?.label ?? o);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link href={`/protected/organisations/${org.id}`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}>
              {org.name}
            </Link>
            <ExternalLink size={11} color="var(--text-5)" />
            {status && SUGGESTION_STATUS_META[status] && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: SUGGESTION_STATUS_META[status].bg, color: SUGGESTION_STATUS_META[status].tx }}>
                {SUGGESTION_STATUS_META[status].label}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>
              {ORG_TYPE_LABELS[org.organization_type] ?? org.organization_type}
            </span>
            {stanceLabel && <span style={{ fontSize: 11, color: "var(--text-5)" }}>{stanceLabel}</span>}
            {org.location && <span style={{ fontSize: 11, color: "var(--text-5)" }}>📍 {org.location}</span>}
          </div>
          {opsLabels.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 3 }}>{opsLabels.join(" · ")}</div>
          )}
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: tx, background: bg, borderRadius: 10, padding: "4px 12px", minWidth: 48 }}>
            {result.score !== null ? result.score : "✕"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 2 }}>
            {result.coverage.evaluated}/{result.coverage.total} critères
          </div>
        </div>
      </div>

      {org.acquirer_summary && (
        <div style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>{org.acquirer_summary}</div>
      )}

      {result.dealBreaker && (
        <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", borderRadius: 8, padding: "6px 10px" }}>
          ✕ {result.dealBreaker}
        </div>
      )}

      {result.malusHistorique.reason && (
        <div style={{ fontSize: 11.5, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "5px 10px" }}>
          −10 · {result.malusHistorique.reason}
        </div>
      )}

      {suggestion?.ai_explanation && (
        <div style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", borderRadius: 8, padding: "7px 10px", display: "flex", gap: 7 }}>
          <Sparkles size={12} style={{ flexShrink: 0, marginTop: 2 }} color="#7C3AED" />
          <span>
            {suggestion.score_ai != null && <strong>IA {suggestion.score_ai}/100 · </strong>}
            {suggestion.ai_explanation}
          </span>
        </div>
      )}

      {/* Le geste d'approche */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setStatus("approved")} disabled={acting} style={statusBtn("approved", "Approuver")}>Approuver</button>
        <button onClick={() => setStatus("contacted")} disabled={acting} style={statusBtn("contacted", "Contacté")}>Contacté</button>
        <button onClick={() => setStatus("rejected")} disabled={acting} style={statusBtn("rejected", "Écarter")}>Écarter</button>
        {acting && <Loader2 size={12} className="animate-spin" color="var(--text-5)" />}
        <button onClick={() => setExpanded(p => !p)}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-4)", padding: 0, fontFamily: "inherit" }}>
          {expanded ? "▲ Détail" : "▼ Détail"}
        </button>
      </div>
      {actionError && <div style={{ fontSize: 11.5, color: "#991B1B" }}>{actionError}</div>}

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <CriterionBar label="Capacité"        earned={result.breakdown.capacite.earned}   max={result.breakdown.capacite.max}   reason={result.breakdown.capacite.reason}   muted={!result.breakdown.capacite.evaluated} />
          <CriterionBar label="Secteur"         earned={result.breakdown.secteur.earned}    max={result.breakdown.secteur.max}    reason={result.breakdown.secteur.reason}    muted={!result.breakdown.secteur.evaluated} />
          <CriterionBar label="Type d'opération" earned={result.breakdown.operation.earned} max={result.breakdown.operation.max}  reason={result.breakdown.operation.reason}  muted={!result.breakdown.operation.evaluated} />
          <CriterionBar label="Appétit"         earned={result.breakdown.appetit.earned}    max={result.breakdown.appetit.max}    reason={result.breakdown.appetit.reason}    muted={!result.breakdown.appetit.evaluated} />
          <CriterionBar label="Géographie"      earned={result.breakdown.geographie.earned} max={result.breakdown.geographie.max} reason={result.breakdown.geographie.reason} muted={!result.breakdown.geographie.evaluated} />
          <CriterionBar label="Structure"       earned={result.breakdown.structure.earned}  max={result.breakdown.structure.max}  reason={result.breakdown.structure.reason}  muted={!result.breakdown.structure.evaluated} />
          {result.bonusRelation.earned > 0 && (
            <div style={{ fontSize: 11.5, color: "#065F46", marginTop: 6 }}>
              +{result.bonusRelation.earned} relation · {result.bonusRelation.reasons.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AcquirerMatchesView({ dealId }: { dealId: string }) {
  const [matches, setMatches] = useState<AcquirerMatchView[]>([]);
  const [dealContext, setDealContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(-1);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const aiBusyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAcquirerMatches(dealId, showAll);
    if (res.error) setError(res.error);
    else { setMatches(res.matches); setDealContext(res.deal_context); }
    setLoading(false);
  }, [dealId, showAll]);

  useEffect(() => { load(); }, [load]);

  function handleStatusChange(orgId: string, status: string) {
    setMatches(prev => prev.map(m => m.org.id === orgId
      ? { ...m, suggestion: { id: m.suggestion?.id ?? "", status, score_ai: m.suggestion?.score_ai ?? null, ai_explanation: m.suggestion?.ai_explanation ?? null } }
      : m));
  }

  async function handleAiJustify() {
    if (aiBusyRef.current) return;
    const top = matches.filter(m => m.result.score !== null).slice(0, 10).map(m => m.org.id);
    if (top.length === 0) return;
    if (!confirm(`Justifier les ${top.length} premiers matchs par l'IA (quelques centimes) ?`)) return;
    aiBusyRef.current = true;
    setAiRunning(true);
    const res = await aiJustifyAcquirers(dealId, top);
    aiBusyRef.current = false;
    setAiRunning(false);
    if (!res.success) { setError(res.error); return; }
    await load();
  }

  const filtered = matches.filter(m => {
    if (minScore >= 0 && (m.result.score === null || m.result.score < minScore)) return false;
    if (search.trim().length >= 2 && !m.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total: matches.length,
    hot: matches.filter(m => (m.result.score ?? -1) >= 70).length,
    breaker: matches.filter(m => m.result.score === null).length,
  };
  const contextLabel = dealContext ? DEAL_CONTEXTS.find(c => c.value === dealContext)?.label : null;

  const inp: React.CSSProperties = {
    padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface-2)", color: "var(--text-1)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  // Éditeur inline du contexte d'opération : le renseigner ici recalcule
  // immédiatement les 20 points « type d'opération » (même champ que le
  // bloc specs du dossier, via updateDealField).
  async function handleSetContext(value: string) {
    if (!value) return;
    setSavingContext(true);
    const res = await updateDealField(dealId, "deal_context", value);
    setSavingContext(false);
    if (!res.success) { setError(res.error); return; }
    setDealContext(value);
    await load();
  }
  const contextBanner = !dealContext ? (
    <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 10, background: "#FEF3C7", color: "#92400E", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span>Contexte d&apos;opération non renseigné : les 20 points « type d&apos;opération » ne sont pas évalués.</span>
      <select disabled={savingContext} value="" onChange={e => handleSetContext(e.target.value)}
        style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid #F59E0B", background: "#FFFBEB", color: "#92400E", fontSize: 12.5, fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
        <option value="">Renseigner…</option>
        {DEAL_CONTEXTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {savingContext && <Loader2 size={13} className="animate-spin" />}
    </div>
  ) : null;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-5)" }}>Classement des acquéreurs…</div>;
  if (error) return <div style={{ padding: 24, color: "#991B1B", fontSize: 13 }}>Erreur : {error}</div>;

  if (matches.length === 0) return (
    <div style={{ padding: "20px 0" }}>
      {contextBanner}
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
          Aucun acquéreur dans la base
        </div>
        <div style={{ fontSize: 13, color: "var(--text-5)", maxWidth: 460, margin: "0 auto 16px" }}>
          Le matching score les organisations des familles acquéreurs (Acquéreur, Corporate,
          Fonds, Repreneur individuel, Family Office). Il n&apos;y en a encore aucune : la liste
          se remplira à mesure que la base se nourrit.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/protected/acquereurs"
            style={{ padding: "8px 16px", borderRadius: 9, background: "#3730A3", color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            Ouvrir la base acquéreurs
          </Link>
          <Link href="/protected/organisations/nouveau"
            style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            Créer un acquéreur
          </Link>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 14 }}>
          Depuis la prospection, le bouton « Marquer acquéreur » d&apos;une fiche alimente aussi cette base.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 0" }}>
      {contextBanner}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Acquéreurs analysés", value: counts.total, bg: "var(--surface-2)", tx: undefined as string | undefined },
          { label: "Score ≥ 70", value: counts.hot, bg: "#D1FAE5", tx: "#065F46" },
          { label: "Éliminés (raison affichée)", value: counts.breaker, bg: "#FEE2E2", tx: "#991B1B" },
        ].map(s => (
          <div key={s.label} style={{ padding: "9px 15px", borderRadius: 10, background: s.bg, border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.tx ?? "var(--text-1)" }}>{s.value}</span>
            <span style={{ fontSize: 11.5, color: "var(--text-4)", marginLeft: 7 }}>{s.label}</span>
          </div>
        ))}
        {contextLabel && (
          <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>Contexte : <strong>{contextLabel}</strong></span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Rechercher un acquéreur…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
          <option value={-1}>Tous (éliminés inclus)</option>
          <option value={0}>Score ≥ 0</option>
          <option value={40}>Score ≥ 40</option>
          <option value={70}>Score ≥ 70</option>
        </select>
        <button onClick={() => setShowAll(p => !p)}
          style={{ ...inp, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap",
            border: showAll ? "1.5px solid #1a56db" : "1px solid var(--border)",
            background: showAll ? "#eff6ff" : "var(--surface-2)",
            color: showAll ? "#1a56db" : "var(--text-3)" }}>
          {showAll ? "✓ Inactifs inclus" : "Inclure inactifs"}
        </button>
        <button onClick={handleAiJustify} disabled={aiRunning}
          style={{ ...inp, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, color: "#7C3AED", opacity: aiRunning ? 0.6 : 1 }}>
          {aiRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {aiRunning ? "Justification…" : "Justifier le top 10 (IA)"}
        </button>
        <button onClick={load} style={{ ...inp, cursor: "pointer", color: "var(--text-3)", fontWeight: 500 }}>↺</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
          Aucun acquéreur ne correspond à ces critères.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 10 }}>
          {filtered.map(m => (
            <AcquirerCard key={m.org.id} dealId={dealId} match={m} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vue LEGACY (ma_buy : deal → cibles) ──────────────────────────────────────

function MaMatchCard({ match }: { match: MaMatchResult }) {
  const [expanded, setExpanded] = useState(false);
  const { bg, tx } = scoreColor(match.score);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link href={`/protected/organisations/${match.org.id}`}
              style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}>
              {match.org.name}
            </Link>
            <ExternalLink size={11} color="var(--text-5)" />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {match.org.organization_type && (
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-4)", border: "1px solid var(--border)" }}>
                {ORG_TYPE_LABELS[match.org.organization_type] ?? match.org.organization_type}
              </span>
            )}
            {match.org.location && <span style={{ fontSize: 11, color: "var(--text-5)" }}>📍 {match.org.location}</span>}
            {match.org.sector && <span style={{ fontSize: 11, color: "var(--text-5)" }}>{match.org.sector}</span>}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: tx, background: bg, borderRadius: 10, padding: "4px 12px", minWidth: 48 }}>
            {match.score !== null ? match.score : "✕"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 2 }}>score</div>
        </div>
      </div>

      {match.dealBreaker && (
        <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", borderRadius: 8, padding: "6px 10px" }}>
          ✕ {match.dealBreaker}
        </div>
      )}

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

      {match.score !== null && (
        <button onClick={() => setExpanded(p => !p)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-4)", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
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

function LegacyTargetsView({ dealId }: { dealId: string }) {
  const [matches, setMatches] = useState<MaMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(-1);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getMaTargetMatches(dealId, showAll);
    if (result.error) setError(result.error);
    else setMatches(result.matches);
    setLoading(false);
  }, [dealId, showAll]);

  useEffect(() => { load(); }, [load]);

  const filtered = matches.filter(m => {
    if (minScore >= 0 && (m.score === null || m.score < minScore)) return false;
    if (search.trim().length >= 2 && !m.org.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inp: React.CSSProperties = {
    padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface-2)", color: "var(--text-1)", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-5)" }}>Calcul du matching M&A…</div>;
  if (error) return <div style={{ padding: 24, color: "#991B1B", fontSize: 13 }}>Erreur : {error}</div>;
  if (matches.length === 0) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Aucune cible à matcher</div>
      <div style={{ fontSize: 13, color: "var(--text-5)", maxWidth: 400, margin: "0 auto" }}>
        Ajoutez des organisations de type Cible (sale_readiness = open/actively_selling) pour activer le matching.
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Rechercher une cible…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
          <option value={-1}>Tous (deal breakers inclus)</option>
          <option value={0}>Score ≥ 0</option>
          <option value={40}>Score ≥ 40</option>
          <option value={70}>Score ≥ 70</option>
        </select>
        <button onClick={() => setShowAll(p => !p)}
          style={{ ...inp, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap",
            border: showAll ? "1.5px solid #1a56db" : "1px solid var(--border)",
            background: showAll ? "#eff6ff" : "var(--surface-2)",
            color: showAll ? "#1a56db" : "var(--text-3)" }}>
          {showAll ? "✓ Toutes cibles" : "Inclure 'non à vendre'"}
        </button>
        <button onClick={load} style={{ ...inp, cursor: "pointer", color: "var(--text-3)", fontWeight: 500 }}>↺</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
          Aucune cible ne correspond à ces critères.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
          {filtered.map(m => <MaMatchCard key={m.org.id} match={m} />)}
        </div>
      )}
    </div>
  );
}

// ── Entrée ───────────────────────────────────────────────────────────────────

interface MaMatchingTabProps {
  dealId: string;
  dealType: "ma_sell" | "ma_buy";
}

export function MaMatchingTab({ dealId, dealType }: MaMatchingTabProps) {
  return dealType === "ma_sell"
    ? <AcquirerMatchesView dealId={dealId} />
    : <LegacyTargetsView dealId={dealId} />;
}
