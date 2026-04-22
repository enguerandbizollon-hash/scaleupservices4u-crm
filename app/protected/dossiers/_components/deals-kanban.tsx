"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { updateDealStageAction } from "@/actions/deals";
import { DEAL_STAGES, DEAL_STAGES_MAIN, type DealStage } from "@/lib/crm/matching-maps";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KanbanDeal {
  id: string;
  name: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  priority_level: string;
  sector: string | null;
  target_amount: number | null;
  target_date: string | null;
  currency: string | null;
  next_action_date: string | null;
}

interface Props {
  deals: KanbanDeal[];
}

// ── Présentation par deal_type ───────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string; bg: string; tx: string; border: string }> = {
  fundraising: { label: "Fundraising", icon: "📈", bg: "var(--fund-bg)",  tx: "var(--fund-tx)",  border: "var(--fund-mid)" },
  ma_sell:     { label: "M&A Sell",    icon: "🏢", bg: "var(--sell-bg)",  tx: "var(--sell-tx)",  border: "var(--sell-mid)" },
  ma_buy:      { label: "M&A Buy",     icon: "🎯", bg: "var(--buy-bg)",   tx: "var(--buy-tx)",   border: "var(--buy-mid)"  },
  cfo_advisor: { label: "CFO Advisor", icon: "💼", bg: "var(--cfo-bg)",   tx: "var(--cfo-tx)",   border: "var(--cfo-mid)"  },
  recruitment: { label: "Recrutement", icon: "👤", bg: "var(--rec-bg)",   tx: "var(--rec-tx)",   border: "var(--rec-mid)"  },
};

const PRIO_COLOR: Record<string, string> = {
  high:   "var(--rec-dot)",
  medium: "var(--sell-dot)",
  low:    "var(--border-2)",
};

const STAGE_LABEL_BY_VALUE = Object.fromEntries(DEAL_STAGES.map(s => [s.value, s.label])) as Record<string, string>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v: string | null): string {
  if (!v) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(v));
}

function fmtAmount(n: number | null, c: string | null): string | null {
  if (!n) return null;
  const cur = c ?? "EUR";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M ${cur}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k ${cur}`;
  return `${n} ${cur}`;
}

// ── Composant principal ──────────────────────────────────────────────────────

export function DealsKanban({ deals: initialDeals }: Props) {
  const [deals, setDeals] = useState<KanbanDeal[]>(initialDeals);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [, startTransition] = useTransition();

  // Filtrage par type + statut (closed si toggle off)
  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (typeFilter && d.deal_type !== typeFilter) return false;
      if (!showClosed && (d.deal_status === "won" || d.deal_status === "lost")) return false;
      return true;
    });
  }, [deals, typeFilter, showClosed]);

  // Regroupement par stage
  const byStage = useMemo(() => {
    const m: Record<string, KanbanDeal[]> = {};
    for (const d of filtered) {
      const k = d.deal_stage || "kickoff";
      if (!m[k]) m[k] = [];
      m[k].push(d);
    }
    return m;
  }, [filtered]);

  // Stages affichés : les 7 principaux toujours + post_closing/ongoing_support/search si non vides
  const visibleStages: DealStage[] = useMemo(() => {
    const base: DealStage[] = [...DEAL_STAGES_MAIN];
    for (const extra of ["post_closing", "ongoing_support", "search"] as DealStage[]) {
      if (byStage[extra]?.length) base.push(extra);
    }
    return base;
  }, [byStage]);

  // Distribution des deals pour compteurs
  const totalShown = filtered.length;
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of deals) {
      if (!showClosed && (d.deal_status === "won" || d.deal_status === "lost")) continue;
      m[d.deal_type] = (m[d.deal_type] ?? 0) + 1;
    }
    return m;
  }, [deals, showClosed]);

  async function moveDeal(dealId: string, dir: "prev" | "next") {
    const current = deals.find(d => d.id === dealId);
    if (!current) return;
    const stages: DealStage[] = [...DEAL_STAGES_MAIN]; // on limite les déplacements clavier aux 7 principaux
    const idx = stages.indexOf(current.deal_stage as DealStage);
    if (idx === -1) return;
    const newIdx = dir === "prev" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const newStage = stages[newIdx];

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_stage: newStage } : d));

    startTransition(async () => {
      const res = await updateDealStageAction(dealId, newStage);
      if (!res.success) {
        // Revert en cas d'erreur
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_stage: current.deal_stage } : d));
        // eslint-disable-next-line no-alert
        alert(`Erreur : ${res.error}`);
      }
    });
  }

  // ── Styles communs ─────────────────────────────────────────────────────────
  const pillBtn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 20,
    border: "1px solid " + (active ? (color ?? "var(--su-500, #1a56db)") : "var(--border)"),
    background: active ? (color ?? "var(--su-500, #1a56db)") : "var(--surface-2)",
    color: active ? "#fff" : "var(--text-3)",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Dossiers — Kanban</h1>
          <div style={{ fontSize: 12.5, color: "var(--text-5)", marginTop: 4 }}>
            {totalShown} dossier{totalShown > 1 ? "s" : ""} affiché{totalShown > 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/protected/dossiers?view=list" style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", textDecoration: "none" }}>
            Vue liste
          </Link>
          <Link href="/protected/dossiers/nouveau" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
            <Plus size={14}/> Nouveau dossier
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setTypeFilter(null)} style={pillBtn(typeFilter === null)}>
          Tous ({Object.values(typeCounts).reduce((s, n) => s + n, 0)})
        </button>
        {(Object.entries(TYPE_META) as [string, typeof TYPE_META[string]][]).map(([t, meta]) => {
          const n = typeCounts[t] ?? 0;
          if (n === 0) return null;
          const active = typeFilter === t;
          return (
            <button key={t} type="button" onClick={() => setTypeFilter(active ? null : t)}
              style={pillBtn(active, meta.tx)}>
              {meta.icon} {meta.label} ({n})
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-3)", cursor: "pointer" }}>
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
          Afficher clôturés (gagnés/perdus)
        </label>
      </div>

      {/* Kanban */}
      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, minWidth: `${visibleStages.length * 230}px` }}>
          {visibleStages.map(stageValue => {
            const cards = byStage[stageValue] ?? [];
            const label = STAGE_LABEL_BY_VALUE[stageValue] ?? stageValue;
            return (
              <div key={stageValue} style={{ flex: 1, minWidth: 220 }}>
                {/* Colonne header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", marginBottom: 6,
                  background: "var(--surface-2)", borderRadius: 9,
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                    background: cards.length > 0 ? "#DBEAFE" : "var(--surface-3)",
                    color: cards.length > 0 ? "#1D4ED8" : "var(--text-5)",
                  }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cartes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 60 }}>
                  {cards.length === 0 ? (
                    <div style={{ height: 52, border: "1px dashed var(--border)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-6, var(--text-5))" }}>—</span>
                    </div>
                  ) : (
                    cards.map(d => <KanbanCard key={d.id} deal={d} onMove={moveDeal} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Carte individuelle ──────────────────────────────────────────────────────

function KanbanCard({ deal, onMove }: {
  deal: KanbanDeal;
  onMove: (dealId: string, dir: "prev" | "next") => void;
}) {
  const meta = TYPE_META[deal.deal_type] ?? TYPE_META.fundraising;
  const prioColor = PRIO_COLOR[deal.priority_level] ?? PRIO_COLOR.low;
  const amount = fmtAmount(deal.target_amount, deal.currency);
  const stages: DealStage[] = [...DEAL_STAGES_MAIN];
  const idx = stages.indexOf(deal.deal_stage as DealStage);
  const hasPrev = idx > 0;
  const hasNext = idx !== -1 && idx < stages.length - 1;
  const inactive = deal.deal_status !== "open";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${prioColor}`,
      borderRadius: 9,
      padding: "10px 11px",
      opacity: inactive ? 0.55 : 1,
      display: "flex", flexDirection: "column", gap: 5,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <Link href={`/protected/dossiers/${deal.id}`}
          style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--text-1)", textDecoration: "none", minWidth: 0, lineHeight: 1.3 }}>
          {deal.name}
        </Link>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "1px 6px", background: meta.bg, color: meta.tx }}>
          {meta.icon}
        </span>
      </div>

      {(deal.sector || amount) && (
        <div style={{ fontSize: 11.5, color: "var(--text-4)" }}>
          {deal.sector && <span>{deal.sector}</span>}
          {deal.sector && amount && <span style={{ margin: "0 5px" }}>·</span>}
          {amount && <span style={{ fontWeight: 700, color: meta.tx }}>{amount}</span>}
        </div>
      )}

      {(deal.target_date || deal.next_action_date) && (
        <div style={{ fontSize: 10.5, color: "var(--text-5)" }}>
          {deal.next_action_date && <span>↻ {fmtDate(deal.next_action_date)}</span>}
          {deal.next_action_date && deal.target_date && <span style={{ margin: "0 5px" }}>·</span>}
          {deal.target_date && <span>🎯 {fmtDate(deal.target_date)}</span>}
        </div>
      )}

      {/* Actions déplacement */}
      <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
        <button type="button" onClick={() => onMove(deal.id, "prev")} disabled={!hasPrev || inactive}
          title="Étape précédente"
          style={{
            flex: 1, padding: "3px 0", border: "1px solid var(--border)", borderRadius: 5,
            background: "var(--surface-2)", color: hasPrev && !inactive ? "var(--text-3)" : "var(--text-6)",
            cursor: hasPrev && !inactive ? "pointer" : "default", opacity: hasPrev && !inactive ? 1 : 0.3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <ChevronLeft size={12} />
        </button>
        <button type="button" onClick={() => onMove(deal.id, "next")} disabled={!hasNext || inactive}
          title="Étape suivante"
          style={{
            flex: 1, padding: "3px 0", border: "1px solid var(--border)", borderRadius: 5,
            background: "var(--surface-2)", color: hasNext && !inactive ? "var(--text-3)" : "var(--text-6)",
            cursor: hasNext && !inactive ? "pointer" : "default", opacity: hasNext && !inactive ? 1 : 0.3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
