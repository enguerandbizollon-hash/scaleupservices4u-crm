"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchBuyQualification,
  validateScreening,
  invalidateScreening,
  putScreeningOnHold,
  setScreeningStatus,
  type BuyQualificationPayload,
} from "@/actions/screening";
import { BUY_QUALIFICATION_READY_MIN_SCORE } from "@/lib/crm/buy-qualification";
import type { ScreeningStatus } from "@/lib/crm/matching-maps";
import { CheckCircle2, Pause, Play, AlertCircle, Loader2, X, ArrowRight } from "lucide-react";

// Qualification d'un mandat d'ACQUISITION : le pendant buy-side du screening.
// Rien ne se saisit ici : le score se lit sur les critères du dossier (fiche
// de cadrage, projet, cibles, budget) et chaque critère manquant renvoie vers
// l'écran où le compléter. Même machine à statuts que le screening de cession.

const STATUS_META: Record<ScreeningStatus, { bg: string; tx: string; border: string; label: string }> = {
  not_started:        { bg: "var(--surface-3)", tx: "var(--text-4)", border: "var(--border)", label: "À cadrer" },
  drafting:           { bg: "#FEF3C7",          tx: "#92400E",       border: "#FCD34D",       label: "En cadrage" },
  ready_for_outreach: { bg: "#D1FAE5",          tx: "#065F46",       border: "#6EE7B7",       label: "Prêt pour la recherche" },
  on_hold:            { bg: "var(--surface-3)", tx: "var(--text-4)", border: "var(--border)", label: "En pause" },
};

// Où compléter chaque critère du barème (clé -> pane de la fiche dossier).
const FILL_VIA: Record<string, { tab: "sourcing" | "dossier" | "financier"; label: string }> = {
  cadrage:    { tab: "sourcing",  label: "Marché, Cibles" },
  projet:     { tab: "dossier",   label: "Exécution, Dossier" },
  secteurs:   { tab: "dossier",   label: "Exécution, Dossier" },
  geographie: { tab: "dossier",   label: "Exécution, Dossier" },
  ca_cible:   { tab: "dossier",   label: "Exécution, Dossier" },
  budget:     { tab: "financier", label: "L'affaire, Budget" },
  repreneur:  { tab: "dossier",   label: "Exécution, Dossier" },
  timing:     { tab: "dossier",   label: "Exécution, Dossier" },
};

function scoreColor(score: number): string {
  if (score >= BUY_QUALIFICATION_READY_MIN_SCORE) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

interface Props {
  dealId: string;
  /** Ouvre un autre pane de la fiche dossier (renvois « Compléter »). */
  onOpenPane?: (tab: "sourcing" | "dossier" | "financier") => void;
}

export function BuyQualificationSection({ dealId, onOpenPane }: Props) {
  const [payload, setPayload] = useState<BuyQualificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const data = await fetchBuyQualification(dealId);
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

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 13, marginTop: 8 }}>Chargement de la qualification…</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
        <AlertCircle size={20} />
        <p style={{ fontSize: 13, marginTop: 8 }}>Impossible de charger la qualification.</p>
      </div>
    );
  }

  const { snapshot, breakdown } = payload;
  const statusMeta = STATUS_META[snapshot.screening_status];
  const isReady = snapshot.screening_status === "ready_for_outreach";
  const isOnHold = snapshot.screening_status === "on_hold";
  const canValidate = breakdown.total >= BUY_QUALIFICATION_READY_MIN_SCORE;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Bandeau statut + score + actions */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", padding: 18 }}>
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
              Qualification du mandat de recherche
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-4)", lineHeight: 1.45 }}>
              Le projet du repreneur doit être cadré avant d&apos;ouvrir la recherche : fiche de cadrage, critères de cible, budget.
              Score minimum requis : {BUY_QUALIFICATION_READY_MIN_SCORE}/100. Rien ne se saisit ici : chaque critère renvoie vers l&apos;écran où le compléter.
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
              <div style={{ width: `${breakdown.total}%`, height: "100%", background: scoreColor(breakdown.total), transition: "width .25s" }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {!isReady && (
            <button
              disabled={isPending || !canValidate}
              onClick={() => handleAction(() => validateScreening(dealId))}
              style={{
                padding: "8px 14px",
                background: canValidate ? "#065F46" : "var(--surface-3)",
                color: canValidate ? "#fff" : "var(--text-5)",
                border: "none",
                cursor: canValidate && !isPending ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
              title={!canValidate ? `Score insuffisant (minimum ${BUY_QUALIFICATION_READY_MIN_SCORE}/100)` : ""}
            >
              <CheckCircle2 size={14} />
              Valider la qualification
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
              Invalider
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
        </div>

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

      {/* Barème auditable : chaque critère, sa valeur, où le compléter */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
          Critères de qualification
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {breakdown.items.map((item) => {
            const via = FILL_VIA[item.key];
            return (
              <div key={item.key} style={{
                padding: "9px 12px",
                background: item.filled ? "#ECFDF5" : "var(--surface-2)",
                border: `1px solid ${item.filled ? "#A7F3D0" : "var(--border)"}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 12.5, color: item.filled ? "#065F46" : "var(--text-3)", fontWeight: item.filled ? 600 : 500, flex: 1 }}>
                  {item.label}
                </span>
                {!item.filled && via && onOpenPane && (
                  <button
                    type="button"
                    onClick={() => onOpenPane(via.tab)}
                    title={`Compléter via ${via.label}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 11.5, fontWeight: 600, color: "#1a56db",
                      fontFamily: "inherit", padding: 0,
                    }}
                  >
                    Compléter <ArrowRight size={11} />
                  </button>
                )}
                <span style={{ fontSize: 11.5, color: item.filled ? "#065F46" : "var(--text-5)", fontWeight: 700, flexShrink: 0 }}>
                  {item.earned}/{item.max}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
