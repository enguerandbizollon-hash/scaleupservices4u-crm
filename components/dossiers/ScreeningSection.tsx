"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchDealScreening,
  updateDealScreening,
  validateScreening,
  invalidateScreening,
  putScreeningOnHold,
  setScreeningStatus,
  type ScreeningPayload,
} from "@/actions/screening";
import {
  SCREENING_STATUSES,
  type ScreeningStatus,
} from "@/lib/crm/matching-maps";
import {
  CheckCircle2, Pause, Play, AlertCircle, Loader2, Pencil, X, Check,
  Plus, Trash2, Sparkles,
} from "lucide-react";
import { suggestScreeningBrief } from "@/actions/ai/screening-brief";
import type { ScreeningBriefSuggestion } from "@/lib/ai/brief-engine";

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<ScreeningStatus, { bg: string; tx: string; border: string; label: string }> = {
  not_started:        { bg: "var(--surface-3)", tx: "var(--text-4)", border: "var(--border)",      label: "À démarrer" },
  drafting:           { bg: "#FEF3C7",          tx: "#92400E",        border: "#FCD34D",            label: "En rédaction" },
  ready_for_outreach: { bg: "#D1FAE5",          tx: "#065F46",        border: "#6EE7B7",            label: "Prêt pour outreach" },
  on_hold:            { bg: "var(--surface-3)", tx: "var(--text-4)",  border: "var(--border)",      label: "En pause" },
};

function scoreColor(score: number): string {
  if (score >= 60) return "#10B981"; // vert
  if (score >= 40) return "#F59E0B"; // orange
  return "#EF4444";                   // rouge
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

// ── Composant principal ──────────────────────────────────────────────────────

interface Props {
  dealId: string;
}

export function ScreeningSection({ dealId }: Props) {
  const [payload, setPayload] = useState<ScreeningPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<ScreeningBriefSuggestion | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await fetchDealScreening(dealId);
    setPayload(data);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const handleAction = useCallback(
    async (fn: () => Promise<{ success: true } | { success: false; error: string }>) => {
      setErrorMsg(null);
      startTransition(async () => {
        const res = await fn();
        if (!res.success) setErrorMsg(res.error);
        await reload();
      });
    },
    [reload],
  );

  const runBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    const res = await suggestScreeningBrief(dealId);
    setBriefLoading(false);
    if (!res.success) {
      setBriefError(res.error);
      return;
    }
    setBrief(res.suggestion);
  }, [dealId]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 13, marginTop: 8 }}>Chargement du screening…</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
        <AlertCircle size={20} />
        <p style={{ fontSize: 13, marginTop: 8 }}>Impossible de charger le screening.</p>
      </div>
    );
  }

  const { snapshot, breakdown } = payload;
  const statusMeta = STATUS_META[snapshot.screening_status];
  const isReady = snapshot.screening_status === "ready_for_outreach";
  const isOnHold = snapshot.screening_status === "on_hold";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Bandeau statut + score + actions */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        padding: 18,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px",
                background: statusMeta.bg, color: statusMeta.tx,
                border: `1px solid ${statusMeta.border}`,
                textTransform: "uppercase", letterSpacing: ".04em",
              }}>
                {statusMeta.label}
              </span>
              {snapshot.screening_validated_at && (
                <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>
                  validé le {fmtDate(snapshot.screening_validated_at)}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
              Screening qualifié
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-4)", lineHeight: 1.45 }}>
              Un dossier doit être screené avant de déclencher suggestions proactives et campagnes sortantes. Score minimum requis : 60/100.
            </p>
          </div>

          <div style={{ minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(breakdown.total) }}>
                {breakdown.total}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-4)" }}>/ 100</span>
            </div>
            <div style={{ height: 6, background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{
                width: `${breakdown.total}%`,
                height: "100%",
                background: scoreColor(breakdown.total),
                transition: "width .25s",
              }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {!isReady && (
            <button
              disabled={isPending || breakdown.total < 60}
              onClick={() => handleAction(() => validateScreening(dealId))}
              style={{
                padding: "8px 14px",
                background: breakdown.total >= 60 ? "#065F46" : "var(--surface-3)",
                color: breakdown.total >= 60 ? "#fff" : "var(--text-5)",
                border: "none",
                cursor: breakdown.total >= 60 && !isPending ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
              title={breakdown.total < 60 ? "Score insuffisant (minimum 60/100)" : ""}
            >
              <CheckCircle2 size={14} />
              Valider le screening
            </button>
          )}
          {isReady && (
            <button
              disabled={isPending}
              onClick={() => handleAction(() => invalidateScreening(dealId))}
              style={{
                padding: "8px 14px",
                background: "var(--surface-2)", color: "var(--text-2)",
                border: "1px solid var(--border)", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <X size={14} />
              Invalider le screening
            </button>
          )}
          {!isOnHold && (
            <button
              disabled={isPending}
              onClick={() => handleAction(() => putScreeningOnHold(dealId))}
              style={{
                padding: "8px 14px",
                background: "var(--surface-2)", color: "var(--text-2)",
                border: "1px solid var(--border)", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Pause size={14} />
              Mettre en pause
            </button>
          )}
          {isOnHold && (
            <button
              disabled={isPending}
              onClick={() => handleAction(() => setScreeningStatus(dealId, "drafting"))}
              style={{
                padding: "8px 14px",
                background: "var(--surface-2)", color: "var(--text-2)",
                border: "1px solid var(--border)", cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Play size={14} />
              Reprendre
            </button>
          )}

          <button
            disabled={briefLoading || isPending}
            onClick={runBrief}
            style={{
              padding: "8px 14px",
              background: "#192348", color: "#fff",
              border: "none",
              cursor: briefLoading || isPending ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6,
              marginLeft: "auto",
            }}
          >
            {briefLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {briefLoading ? "Analyse IA en cours…" : "Générer un brouillon IA"}
          </button>
        </div>

        {briefError && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "#FEF3C7", border: "1px solid #FCD34D",
            color: "#92400E", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle size={14} /> {briefError}
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "#FEE2E2", border: "1px solid #FCA5A5",
            color: "#991B1B", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}
      </div>

      {/* Détail du score par critère */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
          Critères de complétude
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {breakdown.items.map((item) => (
            <div key={item.key} style={{
              padding: "8px 12px",
              background: item.filled ? "#ECFDF5" : "var(--surface-2)",
              border: `1px solid ${item.filled ? "#A7F3D0" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span style={{ fontSize: 12, color: item.filled ? "#065F46" : "var(--text-4)", fontWeight: item.filled ? 600 : 500 }}>
                {item.label}
              </span>
              <span style={{ fontSize: 11.5, color: item.filled ? "#065F46" : "var(--text-5)", fontWeight: 600 }}>
                {item.earned}/{item.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Éditeurs par champ */}
      <TextFieldEditor
        title="Pitch exécutif"
        hint="3 à 5 lignes lisibles par un tiers externe (fonds, acquéreur, candidat)."
        value={snapshot.executive_summary}
        minChars={80}
        onSave={async (value) => {
          await handleAction(() => updateDealScreening(dealId, { executive_summary: value }));
        }}
        disabled={isPending}
      />

      <TextFieldEditor
        title="Motivation"
        hint="Pourquoi cette opération maintenant ? Quel est le déclencheur ?"
        value={snapshot.motivation_narrative}
        minChars={50}
        onSave={async (value) => {
          await handleAction(() => updateDealScreening(dealId, { motivation_narrative: value }));
        }}
        disabled={isPending}
      />

      <ListFieldEditor
        title="Différenciateurs"
        hint="Au moins 2 différenciateurs clés."
        values={snapshot.key_differentiators ?? []}
        onSave={async (values) => {
          await handleAction(() => updateDealScreening(dealId, { key_differentiators: values }));
        }}
        disabled={isPending}
      />

      <ListFieldEditor
        title="Points d'attention"
        hint="Red flags, contraintes, éléments à adresser en priorité."
        values={snapshot.key_risks ?? []}
        onSave={async (values) => {
          await handleAction(() => updateDealScreening(dealId, { key_risks: values }));
        }}
        disabled={isPending}
      />

      <TextFieldEditor
        title="Concurrence"
        hint="Principaux concurrents et positionnement relatif."
        value={snapshot.competitive_landscape}
        minChars={50}
        onSave={async (value) => {
          await handleAction(() => updateDealScreening(dealId, { competitive_landscape: value }));
        }}
        disabled={isPending}
      />

      <TextFieldEditor
        title="Contexte marché"
        hint="Dynamique du secteur, tendances, fenêtre d'opportunité."
        value={snapshot.market_context}
        minChars={50}
        onSave={async (value) => {
          await handleAction(() => updateDealScreening(dealId, { market_context: value }));
        }}
        disabled={isPending}
      />

      {brief && (
        <BriefSuggestionsModal
          suggestion={brief}
          snapshot={snapshot}
          onClose={() => setBrief(null)}
          onApply={async (payload) => {
            await handleAction(() => updateDealScreening(dealId, payload));
            setBrief(null);
          }}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ── Modale de suggestions IA ────────────────────────────────────────────────

interface BriefModalProps {
  suggestion: ScreeningBriefSuggestion;
  snapshot: {
    executive_summary: string | null;
    motivation_narrative: string | null;
    competitive_landscape: string | null;
    market_context: string | null;
    key_differentiators: string[] | null;
    key_risks: string[] | null;
  };
  onClose: () => void;
  onApply: (payload: {
    executive_summary?: string;
    motivation_narrative?: string;
    competitive_landscape?: string;
    market_context?: string;
    key_differentiators?: string[];
    key_risks?: string[];
  }) => Promise<void>;
  isPending: boolean;
}

function BriefSuggestionsModal({ suggestion, snapshot, onClose, onApply, isPending }: BriefModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => ({
    executive_summary: !snapshot.executive_summary || snapshot.executive_summary.trim().length === 0,
    motivation_narrative: !snapshot.motivation_narrative || snapshot.motivation_narrative.trim().length === 0,
    competitive_landscape: !snapshot.competitive_landscape || snapshot.competitive_landscape.trim().length === 0,
    market_context: !snapshot.market_context || snapshot.market_context.trim().length === 0,
    key_differentiators: !snapshot.key_differentiators || snapshot.key_differentiators.length === 0,
    key_risks: !snapshot.key_risks || snapshot.key_risks.length === 0,
  }));

  const rows: Array<{ key: keyof typeof selected; label: string; current: string; proposed: string; isList: boolean }> = [
    {
      key: "executive_summary",
      label: "Pitch exécutif",
      current: snapshot.executive_summary ?? "",
      proposed: suggestion.executive_summary,
      isList: false,
    },
    {
      key: "motivation_narrative",
      label: "Motivation",
      current: snapshot.motivation_narrative ?? "",
      proposed: suggestion.motivation_narrative,
      isList: false,
    },
    {
      key: "key_differentiators",
      label: "Différenciateurs",
      current: (snapshot.key_differentiators ?? []).join("\n"),
      proposed: suggestion.key_differentiators.join("\n"),
      isList: true,
    },
    {
      key: "key_risks",
      label: "Points d'attention",
      current: (snapshot.key_risks ?? []).join("\n"),
      proposed: suggestion.key_risks.join("\n"),
      isList: true,
    },
    {
      key: "competitive_landscape",
      label: "Concurrence",
      current: snapshot.competitive_landscape ?? "",
      proposed: suggestion.competitive_landscape,
      isList: false,
    },
    {
      key: "market_context",
      label: "Contexte marché",
      current: snapshot.market_context ?? "",
      proposed: suggestion.market_context,
      isList: false,
    },
  ];

  const confidenceColor = suggestion.confidence >= 70 ? "#10B981" : suggestion.confidence >= 40 ? "#F59E0B" : "#EF4444";

  const applySelected = async () => {
    const payload: Parameters<typeof onApply>[0] = {};
    if (selected.executive_summary && suggestion.executive_summary) payload.executive_summary = suggestion.executive_summary;
    if (selected.motivation_narrative && suggestion.motivation_narrative) payload.motivation_narrative = suggestion.motivation_narrative;
    if (selected.competitive_landscape && suggestion.competitive_landscape) payload.competitive_landscape = suggestion.competitive_landscape;
    if (selected.market_context && suggestion.market_context) payload.market_context = suggestion.market_context;
    if (selected.key_differentiators && suggestion.key_differentiators.length > 0) payload.key_differentiators = suggestion.key_differentiators;
    if (selected.key_risks && suggestion.key_risks.length > 0) payload.key_risks = suggestion.key_risks;
    await onApply(payload);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border-2)",
        padding: 24, width: "100%", maxWidth: 920, maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sparkles size={16} color="#192348" />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Brouillon IA du screening</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-4)" }}>
              Cochez les champs à appliquer. Le contenu actuel est remplacé pour les champs cochés.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{
          padding: "10px 14px",
          background: "var(--surface-2)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Confiance IA
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: confidenceColor }}>
              {suggestion.confidence}/100
            </span>
          </div>
          {suggestion.notes && (
            <span style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>
              {suggestion.notes}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => {
            const hasContent = row.proposed && row.proposed.trim().length > 0;
            return (
              <div key={row.key} style={{
                padding: 14,
                background: "var(--surface)",
                border: `1px solid ${selected[row.key] && hasContent ? "#A7F3D0" : "var(--border-2)"}`,
              }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: hasContent ? "pointer" : "not-allowed" }}>
                  <input
                    type="checkbox"
                    disabled={!hasContent}
                    checked={hasContent ? selected[row.key] : false}
                    onChange={(e) => setSelected((s) => ({ ...s, [row.key]: e.target.checked }))}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                      {row.label}
                      {!hasContent && (
                        <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 500, color: "var(--text-5)", textTransform: "none", letterSpacing: 0 }}>
                          (aucune suggestion générée)
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--text-5)", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>
                          Actuel
                        </div>
                        <div style={{
                          fontSize: 12.5, color: row.current ? "var(--text-3)" : "var(--text-5)",
                          fontStyle: row.current ? "normal" : "italic",
                          whiteSpace: "pre-wrap", lineHeight: 1.45,
                        }}>
                          {row.current || "Non renseigné"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: "#065F46", marginBottom: 3, textTransform: "uppercase", letterSpacing: ".04em" }}>
                          Proposé IA
                        </div>
                        <div style={{
                          fontSize: 12.5, color: hasContent ? "var(--text-1)" : "var(--text-5)",
                          fontStyle: hasContent ? "normal" : "italic",
                          whiteSpace: "pre-wrap", lineHeight: 1.45,
                        }}>
                          {hasContent ? row.proposed : "Non proposé"}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-4)" }}>
            {selectedCount} champ{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px", background: "var(--surface-2)",
                border: "1px solid var(--border)", cursor: "pointer",
                fontSize: 13, color: "var(--text-2)",
              }}
            >
              Ignorer
            </button>
            <button
              onClick={applySelected}
              disabled={isPending || selectedCount === 0}
              style={{
                padding: "8px 14px",
                background: selectedCount > 0 && !isPending ? "#065F46" : "var(--surface-3)",
                color: selectedCount > 0 && !isPending ? "#fff" : "var(--text-5)",
                border: "none",
                cursor: selectedCount > 0 && !isPending ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Check size={13} />
              Appliquer la sélection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Éditeur de champ texte ───────────────────────────────────────────────────

function TextFieldEditor({
  title, hint, value, minChars, onSave, disabled,
}: {
  title: string;
  hint?: string;
  value: string | null;
  minChars: number;
  onSave: (value: string) => Promise<void>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const charCount = draft.trim().length;
  const isValid = charCount === 0 || charCount >= minChars;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            {title}
          </div>
          {hint && !editing && (
            <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>{hint}</div>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            disabled={disabled}
            style={{
              padding: "6px 10px", background: "var(--surface-2)",
              border: "1px solid var(--border)", cursor: "pointer",
              fontSize: 12, fontWeight: 500, color: "var(--text-2)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <Pencil size={12} /> Modifier
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: 10, fontSize: 13,
                border: "1px solid var(--border)",
                background: "var(--surface)", color: "var(--text-1)",
                fontFamily: "inherit", resize: "vertical", lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
              <span style={{ fontSize: 11.5, color: isValid ? "var(--text-5)" : "#991B1B" }}>
                {charCount} caractère{charCount > 1 ? "s" : ""}
                {charCount > 0 && charCount < minChars && ` (minimum ${minChars} pour être compté dans le score)`}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { setEditing(false); setDraft(value ?? ""); }}
                  style={{
                    padding: "6px 12px", background: "var(--surface-2)",
                    border: "1px solid var(--border)", cursor: "pointer",
                    fontSize: 12, color: "var(--text-3)",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  <X size={12} /> Annuler
                </button>
                <button
                  onClick={async () => {
                    await onSave(draft.trim());
                    setEditing(false);
                  }}
                  disabled={disabled}
                  style={{
                    padding: "6px 12px", background: "#065F46",
                    border: "none", color: "#fff", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Check size={12} /> Enregistrer
                </button>
              </div>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: value ? "var(--text-2)" : "var(--text-5)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {value && value.trim().length > 0 ? value : "Non renseigné"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Éditeur de champ liste ──────────────────────────────────────────────────

function ListFieldEditor({
  title, hint, values, onSave, disabled,
}: {
  title: string;
  hint?: string;
  values: string[];
  onSave: (values: string[]) => Promise<void>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (!editing) setDraft(values);
  }, [values, editing]);

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setDraft([...draft, v]);
    setNewItem("");
  };

  const removeItem = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            {title} {values.length > 0 && <span style={{ color: "var(--text-5)" }}>({values.length})</span>}
          </div>
          {hint && !editing && (
            <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>{hint}</div>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            disabled={disabled}
            style={{
              padding: "6px 10px", background: "var(--surface-2)",
              border: "1px solid var(--border)", cursor: "pointer",
              fontSize: 12, fontWeight: 500, color: "var(--text-2)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <Pencil size={12} /> Modifier
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        {editing ? (
          <>
            {draft.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {draft.map((item, idx) => (
                  <li key={idx} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 10px", background: "var(--surface-2)",
                    border: "1px solid var(--border)", gap: 8,
                  }}>
                    <span style={{ fontSize: 13, color: "var(--text-2)", flex: 1 }}>{item}</span>
                    <button
                      onClick={() => removeItem(idx)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", padding: 2 }}
                      aria-label="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                placeholder="Ajouter un élément…"
                style={{
                  flex: 1, padding: "8px 10px", fontSize: 13,
                  border: "1px solid var(--border)",
                  background: "var(--surface)", color: "var(--text-1)",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={addItem}
                disabled={!newItem.trim()}
                style={{
                  padding: "8px 12px",
                  background: newItem.trim() ? "var(--surface-2)" : "var(--surface-3)",
                  border: "1px solid var(--border)",
                  cursor: newItem.trim() ? "pointer" : "not-allowed",
                  fontSize: 12, color: "var(--text-2)",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setEditing(false); setDraft(values); setNewItem(""); }}
                style={{
                  padding: "6px 12px", background: "var(--surface-2)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  fontSize: 12, color: "var(--text-3)",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <X size={12} /> Annuler
              </button>
              <button
                onClick={async () => {
                  await onSave(draft);
                  setEditing(false);
                  setNewItem("");
                }}
                disabled={disabled}
                style={{
                  padding: "6px 12px", background: "#065F46",
                  border: "none", color: "#fff", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <Check size={12} /> Enregistrer
              </button>
            </div>
          </>
        ) : values.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-5)" }}>Non renseigné</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {values.map((item, idx) => (
              <li key={idx} style={{
                padding: "6px 10px", background: "var(--surface-2)",
                border: "1px solid var(--border)", fontSize: 13, color: "var(--text-2)",
              }}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
