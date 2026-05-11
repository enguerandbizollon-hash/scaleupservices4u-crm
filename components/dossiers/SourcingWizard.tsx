"use client";

/**
 * SourcingWizard — Onglet Sourcing unique (S4)
 *
 * Remplace les onglets Matching + Matching M&A + Suggestions.
 *
 * Flux en 3 sections empilées sur un seul écran :
 *   1. Stratégie : générer/éditer le plan IA
 *   2. Exécution : bouton "Exécuter le sourcing" + status
 *   3. Résultats : liste des suggestions avec workflow approve/reject/defer
 */

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Sparkles, Brain, Mail, Check, X, Clock, Loader2, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink, Trash2, Plus, Pencil,
} from "lucide-react";
import {
  generateSourcingPlanAction,
  executeSourcingPlanAction,
  approveSuggestion,
  rejectSuggestion,
  deferSuggestion,
  scoreSuggestionAI,
  generateOutreachBriefForSuggestion,
} from "@/actions/sourcing";
import type { SourcingPlan, SourcingSegment, ActorType } from "@/lib/ai/sourcing-strategy";
import {
  suggestionStatusLabel,
  connectorSourceLabel,
} from "@/lib/crm/matching-maps";
import type { SuggestionWithRelations } from "@/lib/crm/suggestions";

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dealId: string;
  screeningReady: boolean;
  initialSuggestions: SuggestionWithRelations[];
}

// ── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-2)",
  padding: 14,
};

const btnBase: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#192348",
  color: "#fff",
  border: "none",
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 12.5,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text-1)",
  fontFamily: "inherit",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  color: "var(--text-5)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const ACTOR_TYPE_OPTIONS: Array<{ value: ActorType; label: string }> = [
  { value: "corporate_strategic", label: "Corporate stratégique" },
  { value: "corporate_build_up",  label: "Corporate build-up" },
  { value: "private_equity",      label: "Private Equity" },
  { value: "growth_equity",       label: "Growth Equity" },
  { value: "venture_capital",     label: "Venture Capital" },
  { value: "family_office",       label: "Family Office" },
  { value: "business_angel",      label: "Business Angel" },
  { value: "search_fund",         label: "Search Fund" },
  { value: "individual_acquirer", label: "Acquéreur individuel" },
  { value: "investment_bank",     label: "Banque d'affaires" },
  { value: "other",               label: "Autre" },
];

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-5)";
  if (score >= 70) return "#065F46";
  if (score >= 50) return "#B45309";
  return "#991B1B";
}

const STATUS_META: Record<string, { bg: string; tx: string }> = {
  suggested: { bg: "#DBEAFE", tx: "#1D4ED8" },
  approved:  { bg: "#D1FAE5", tx: "#065F46" },
  rejected:  { bg: "#FEE2E2", tx: "#991B1B" },
  deferred:  { bg: "#FEF3C7", tx: "#92400E" },
  contacted: { bg: "#E0E7FF", tx: "#3730A3" },
};

// ── Composant principal ─────────────────────────────────────────────────────

export function SourcingWizard({ dealId, screeningReady, initialSuggestions }: Props) {
  const [suggestions, setSuggestions] = useState<SuggestionWithRelations[]>(initialSuggestions);
  const [plan, setPlan] = useState<SourcingPlan | null>(null);
  const [planFromAI, setPlanFromAI] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [withAI, setWithAI] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "suggested" | "approved" | "contacted">("suggested");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const visible = suggestions.filter((s) => (filter === "all" ? true : s.status === filter));

  const handleGeneratePlan = useCallback(async () => {
    setError(null);
    setInfo(null);
    setIsGenerating(true);
    const res = await generateSourcingPlanAction(dealId);
    setIsGenerating(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPlan(res.plan);
    setPlanFromAI(res.from_ai);
    if (!res.from_ai) {
      setInfo("Plan par défaut affiché (IA non disponible). Ajuste les segments avant d'exécuter.");
    }
  }, [dealId]);

  const handleExecute = useCallback(async () => {
    if (!plan) return;
    setError(null);
    setInfo(null);
    setIsExecuting(true);
    const res = await executeSourcingPlanAction(dealId, plan, { withAI });
    setIsExecuting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setInfo(
      `Exécution terminée : ${res.candidates_total} candidats trouvés, ${res.suggestions_created} nouvelles suggestions, ${res.suggestions_enriched} enrichies, ${res.ai_scored} scorées par IA. Rafraîchis la page pour voir la liste.`,
    );
  }, [dealId, plan, withAI]);

  // Modifications de plan in-place
  const updateSegment = (idx: number, updater: (s: SourcingSegment) => SourcingSegment) => {
    if (!plan) return;
    const next = { ...plan, segments: plan.segments.map((s, i) => (i === idx ? updater(s) : s)) };
    setPlan(next);
  };
  const removeSegment = (idx: number) => {
    if (!plan) return;
    setPlan({ ...plan, segments: plan.segments.filter((_, i) => i !== idx) });
  };
  const addSegment = () => {
    if (!plan) return;
    setPlan({
      ...plan,
      segments: [
        ...plan.segments,
        {
          name: "Nouveau segment",
          priority: 3,
          actor_type: "other",
          keywords: [],
          geographies: [],
          employee_min: null,
          employee_max: null,
          rationale: "",
        },
      ],
    });
    setEditingIdx(plan.segments.length);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Section 1 : Stratégie ────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sparkles size={16} color="#192348" />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Sourcing</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-4)", lineHeight: 1.5 }}>
              L&apos;IA lit le dossier et propose une stratégie de sourcing segmentée. Tu ajustes les segments, puis le moteur combine ton réseau interne (CRM) et Apollo pour produire une liste unique, scorée et priorisée.
            </p>
          </div>
          {!plan && (
            <button
              disabled={!screeningReady || isGenerating}
              onClick={handleGeneratePlan}
              style={{
                ...btnPrimary,
                cursor: !screeningReady || isGenerating ? "not-allowed" : "pointer",
                opacity: !screeningReady ? 0.5 : 1,
              }}
            >
              {isGenerating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={13} />}
              {isGenerating ? "Stratégie en cours…" : "Préparer la stratégie"}
            </button>
          )}
        </div>

        {!screeningReady && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={13} /> Le screening du dossier doit être validé (onglet Screening) avant le sourcing.
          </div>
        )}

        {error && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {info && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#D1FAE5", border: "1px solid #6EE7B7", color: "#065F46", fontSize: 12 }}>
            {info}
          </div>
        )}

        {plan && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                Plan de sourcing
              </span>
              <span style={{
                fontSize: 10.5, padding: "1px 7px",
                background: planFromAI ? "#EEF2FF" : "var(--surface-3)",
                color: planFromAI ? "#3730A3" : "var(--text-4)",
              }}>
                {planFromAI ? "IA" : "manuel"}
              </span>
              {planFromAI && plan.confidence > 0 && (
                <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>
                  Confiance : {plan.confidence}/100
                </span>
              )}
              <button
                onClick={() => { setPlan(null); setEditingIdx(null); }}
                style={{ ...btnBase, marginLeft: "auto", fontSize: 11 }}
              >
                Recommencer
              </button>
            </div>

            {plan.profile_summary && (
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)", fontStyle: "italic", lineHeight: 1.5 }}>
                {plan.profile_summary}
              </p>
            )}

            {plan.notes && (
              <div style={{ padding: "6px 10px", background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", fontSize: 11.5, marginBottom: 10 }}>
                {plan.notes}
              </div>
            )}

            {/* Segments */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.segments.map((seg, idx) => (
                <SegmentCard
                  key={idx}
                  segment={seg}
                  editing={editingIdx === idx}
                  onEdit={() => setEditingIdx(idx)}
                  onSave={(updated) => {
                    updateSegment(idx, () => updated);
                    setEditingIdx(null);
                  }}
                  onCancel={() => setEditingIdx(null)}
                  onRemove={() => removeSegment(idx)}
                />
              ))}
              <button onClick={addSegment} style={{ ...btnBase, justifyContent: "center", padding: 10 }}>
                <Plus size={13} /> Ajouter un segment
              </button>
            </div>

            {/* Signaux + exclusions */}
            {(plan.signals_to_watch.length > 0 || plan.exclusions.length > 0) && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {plan.signals_to_watch.length > 0 && (
                  <div>
                    <div style={lbl}>Signaux à surveiller</div>
                    <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "var(--text-3)" }}>
                      {plan.signals_to_watch.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {plan.exclusions.length > 0 && (
                  <div>
                    <div style={{ ...lbl, color: "#991B1B" }}>Exclusions</div>
                    <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "var(--text-3)" }}>
                      {plan.exclusions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Exécution */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
                <input type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} />
                Scorer avec l&apos;IA (top 15 candidats)
              </label>
              <button
                onClick={handleExecute}
                disabled={isExecuting || plan.segments.length === 0}
                style={{
                  ...btnPrimary,
                  marginLeft: "auto",
                  cursor: isExecuting || plan.segments.length === 0 ? "not-allowed" : "pointer",
                  opacity: plan.segments.length === 0 ? 0.5 : 1,
                }}
              >
                {isExecuting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
                {isExecuting ? "Sourcing en cours (30 à 60s)…" : "Exécuter le sourcing"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2 : Résultats ──────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {(["suggested", "approved", "contacted", "all"] as const).map((f) => {
          const active = filter === f;
          const count = f === "all" ? suggestions.length : suggestions.filter((s) => s.status === f).length;
          const meta = f === "all" ? { bg: "var(--surface-2)", tx: "var(--text-3)" } : STATUS_META[f]!;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px",
                fontSize: 12, fontWeight: 600,
                background: active ? meta.tx : meta.bg,
                color: active ? "#fff" : meta.tx,
                border: `1px solid ${active ? meta.tx : "var(--border)"}`,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {f === "all" ? "Toutes" : suggestionStatusLabel(f)} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 32, color: "var(--text-5)" }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            Aucune suggestion {filter !== "all" ? `avec le statut « ${suggestionStatusLabel(filter)} »` : ""}.
          </p>
          {filter === "suggested" && screeningReady && !plan && (
            <p style={{ margin: "8px 0 0", fontSize: 12 }}>Prépare la stratégie ci-dessus pour lancer le sourcing.</p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onUpdate={(u) => setSuggestions((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)))}
              onRemove={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
              startTransition={startTransition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── SegmentCard : affichage + édition d'un segment de plan ──────────────────

function SegmentCard({
  segment, editing, onEdit, onSave, onCancel, onRemove,
}: {
  segment: SourcingSegment;
  editing: boolean;
  onEdit: () => void;
  onSave: (s: SourcingSegment) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<SourcingSegment>(segment);
  const [kwInput, setKwInput] = useState("");
  const [geoInput, setGeoInput] = useState("");

  useEffect(() => { if (editing) setDraft(segment); }, [editing, segment]);

  if (!editing) {
    return (
      <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", background: priorityBg(segment.priority), color: priorityTx(segment.priority) }}>
            Prio {segment.priority}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", flex: 1 }}>{segment.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-5)" }}>
            {ACTOR_TYPE_OPTIONS.find((o) => o.value === segment.actor_type)?.label ?? segment.actor_type}
          </span>
          <button onClick={onEdit} style={{ ...btnBase, padding: "3px 8px", fontSize: 11 }}><Pencil size={11} /></button>
          <button onClick={onRemove} style={{ ...btnBase, padding: "3px 8px", fontSize: 11, color: "#991B1B" }}><Trash2 size={11} /></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {segment.keywords.length > 0 && <span><strong>Mots-clés :</strong> {segment.keywords.join(", ")}</span>}
          {segment.geographies.length > 0 && <span><strong>Géo :</strong> {segment.geographies.join(", ")}</span>}
          {(segment.employee_min != null || segment.employee_max != null) && (
            <span>
              <strong>Taille :</strong>
              {" "}
              {segment.employee_min ?? "—"} à {segment.employee_max ?? "∞"} employés
            </span>
          )}
        </div>
        {segment.rationale && (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-4)", fontStyle: "italic", lineHeight: 1.45 }}>
            {segment.rationale}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 12, background: "var(--surface)", border: "1px solid #A7F3D0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Nom du segment</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp} />
        </div>
        <div>
          <label style={lbl}>Priorité</label>
          <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) as 1 | 2 | 3 })} style={inp}>
            <option value={1}>1 (haute)</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Type d&apos;acteur</label>
          <select value={draft.actor_type} onChange={(e) => setDraft({ ...draft, actor_type: e.target.value as ActorType })} style={inp}>
            {ACTOR_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Mots-clés</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            {draft.keywords.map((k, i) => (
              <span key={i} style={{ padding: "2px 8px", fontSize: 11, background: "var(--surface-2)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {k}
                <button onClick={() => setDraft({ ...draft, keywords: draft.keywords.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-5)", padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && kwInput.trim()) {
                e.preventDefault();
                setDraft({ ...draft, keywords: [...draft.keywords, kwInput.trim()] });
                setKwInput("");
              }
            }}
            placeholder="Tape + Entrée"
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Géographies</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
            {draft.geographies.map((g, i) => (
              <span key={i} style={{ padding: "2px 8px", fontSize: 11, background: "var(--surface-2)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {g}
                <button onClick={() => setDraft({ ...draft, geographies: draft.geographies.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-5)", padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input
            value={geoInput}
            onChange={(e) => setGeoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && geoInput.trim()) {
                e.preventDefault();
                setDraft({ ...draft, geographies: [...draft.geographies, geoInput.trim()] });
                setGeoInput("");
              }
            }}
            placeholder="france, europe, dach…"
            style={inp}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={lbl}>Employés min</label>
          <input
            type="number"
            value={draft.employee_min ?? ""}
            onChange={(e) => setDraft({ ...draft, employee_min: e.target.value ? Number(e.target.value) : null })}
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Employés max</label>
          <input
            type="number"
            value={draft.employee_max ?? ""}
            onChange={(e) => setDraft({ ...draft, employee_max: e.target.value ? Number(e.target.value) : null })}
            style={inp}
          />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Rationale</label>
        <textarea
          value={draft.rationale}
          onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
          rows={2}
          style={{ ...inp, resize: "vertical" }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnBase}>Annuler</button>
        <button onClick={() => onSave(draft)} style={{ ...btnBase, background: "#065F46", color: "#fff", border: "none" }}>
          <Check size={12} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

function priorityBg(p: 1 | 2 | 3): string {
  if (p === 1) return "#D1FAE5";
  if (p === 2) return "#FEF3C7";
  return "var(--surface-3)";
}
function priorityTx(p: 1 | 2 | 3): string {
  if (p === 1) return "#065F46";
  if (p === 2) return "#92400E";
  return "var(--text-5)";
}

// ── SuggestionCard : carte de résultat avec workflow ────────────────────────

function SuggestionCard({
  suggestion, onUpdate, onRemove, startTransition,
}: {
  suggestion: SuggestionWithRelations;
  onUpdate: (partial: Partial<SuggestionWithRelations> & { id: string }) => void;
  onRemove: (id: string) => void;
  startTransition: React.TransitionStartFunction;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const meta = STATUS_META[suggestion.status] ?? { bg: "var(--surface-3)", tx: "var(--text-5)" };
  const combined = suggestion.score_combined ?? suggestion.score_algo;

  const act = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setLoadingAction(key);
    setLocalError(null);
    const res = await fn();
    setLoadingAction(null);
    if (!res.success) setLocalError(res.error ?? "Erreur");
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {suggestion.organization && (
              <Link
                href={`/protected/organisations/${suggestion.organization.id}`}
                style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                {suggestion.organization.name}
                <ExternalLink size={11} color="var(--text-5)" />
              </Link>
            )}
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", background: meta.bg, color: meta.tx, textTransform: "uppercase", letterSpacing: ".04em" }}>
              {suggestionStatusLabel(suggestion.status)}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>
              {connectorSourceLabel(suggestion.source_connector)}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-4)", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {suggestion.organization?.organization_type && <span>{suggestion.organization.organization_type}</span>}
            {suggestion.organization?.sector && <span>· {suggestion.organization.sector}</span>}
            {suggestion.organization?.location && <span>· {suggestion.organization.location}</span>}
            {suggestion.contact && (
              <span style={{ color: "var(--text-3)", fontWeight: 500 }}>
                · Contact : {suggestion.contact.first_name} {suggestion.contact.last_name}
                {suggestion.contact.title ? ` (${suggestion.contact.title})` : ""}
              </span>
            )}
          </div>

          {suggestion.ai_explanation && !expanded && (
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.45, fontStyle: "italic" }}>
              {suggestion.ai_explanation.length > 180 ? suggestion.ai_explanation.slice(0, 180) + "…" : suggestion.ai_explanation}
            </p>
          )}
        </div>

        <div style={{ textAlign: "right", minWidth: 80 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(combined), lineHeight: 1 }}>
            {combined ?? "—"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".04em" }}>
            {suggestion.score_ai != null ? "combiné" : "algo"}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
            <ScoreBlock label="Algorithmique" value={suggestion.score_algo} />
            <ScoreBlock label="IA" value={suggestion.score_ai} />
            <ScoreBlock label="Combiné" value={suggestion.score_combined} />
            <ScoreBlock label="Confiance IA" value={suggestion.ai_confidence} />
          </div>
          {suggestion.ai_explanation && (
            <div style={{ marginBottom: 10 }}>
              <div style={lbl}>Analyse IA</div>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{suggestion.ai_explanation}</p>
            </div>
          )}
          {suggestion.ai_red_flags && suggestion.ai_red_flags.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...lbl, color: "#991B1B" }}>Points d&apos;attention</div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12.5, color: "var(--text-3)" }}>
                {suggestion.ai_red_flags.map((flag, idx) => <li key={idx}>{flag}</li>)}
              </ul>
            </div>
          )}
          {suggestion.outreach_brief && (
            <div>
              <div style={lbl}>Brief outreach IA</div>
              <pre style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--surface-2)", padding: 10, border: "1px solid var(--border)" }}>
                {suggestion.outreach_brief}
              </pre>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {suggestion.status === "suggested" && (
          <>
            <button
              onClick={() => act("approve", async () => {
                const res = await approveSuggestion(suggestion.id);
                if (res.success) onUpdate({ id: suggestion.id, status: "approved" });
                return res;
              })}
              disabled={!!loadingAction}
              style={{ ...btnBase, background: "#065F46", color: "#fff", border: "none" }}
            >
              {loadingAction === "approve" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
              Approuver
            </button>
            <button
              onClick={() => act("reject", async () => {
                const res = await rejectSuggestion(suggestion.id);
                if (res.success) onRemove(suggestion.id);
                return res;
              })}
              disabled={!!loadingAction}
              style={btnBase}
            >
              {loadingAction === "reject" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <X size={12} />}
              Rejeter
            </button>
            <button
              onClick={() => act("defer", async () => {
                const res = await deferSuggestion(suggestion.id);
                if (res.success) onUpdate({ id: suggestion.id, status: "deferred" });
                return res;
              })}
              disabled={!!loadingAction}
              style={btnBase}
            >
              <Clock size={12} /> Reporter
            </button>
          </>
        )}

        {suggestion.score_ai == null && suggestion.status !== "rejected" && (
          <button
            onClick={() => act("scoreAi", async () => {
              const res = await scoreSuggestionAI(suggestion.id);
              if (res.success) {
                onUpdate({ id: suggestion.id, score_ai: res.score_ai });
                setExpanded(true);
              }
              return res;
            })}
            disabled={!!loadingAction}
            style={{ ...btnBase, background: "#EEF2FF", color: "#3730A3", border: "1px solid #C7D2FE" }}
          >
            {loadingAction === "scoreAi" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={12} />}
            Scorer IA
          </button>
        )}

        {suggestion.status === "approved" && !suggestion.outreach_brief && (
          <button
            onClick={() => act("brief", async () => {
              const res = await generateOutreachBriefForSuggestion(suggestion.id);
              if (res.success) {
                onUpdate({
                  id: suggestion.id,
                  outreach_brief: `OBJET : ${res.email_subject}\n\nEMAIL :\n${res.email_body}\n\nLINKEDIN :\n${res.linkedin_message}`,
                  outreach_brief_generated_at: new Date().toISOString(),
                });
                setExpanded(true);
              }
              return res;
            })}
            disabled={!!loadingAction}
            style={{ ...btnBase, background: "#192348", color: "#fff", border: "none" }}
          >
            {loadingAction === "brief" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={12} />}
            Générer accroche IA
          </button>
        )}

        <button onClick={() => setExpanded(!expanded)} style={{ ...btnBase, marginLeft: "auto" }}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Réduire" : "Détails"}
        </button>
      </div>

      {localError && (
        <div style={{ marginTop: 8, padding: "6px 10px", background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: 11.5 }}>
          {localError}
        </div>
      )}
    </div>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{ padding: "6px 10px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(value) }}>{value ?? "—"}</div>
    </div>
  );
}
