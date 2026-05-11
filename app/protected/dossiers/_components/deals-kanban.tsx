"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { updateDealStageAction } from "@/actions/deals";
import { ViewToggle } from "@/components/dossiers/ViewToggle";
import { DealHealthBadge } from "@/components/dossiers/DealHealthBadge";
import { computeDealHealth, isDormant, DORMANT_THRESHOLD_DAYS } from "@/lib/crm/health-score";
import {
  DEAL_STAGES_BY_TYPE,
  DEAL_STAGES_MAIN_BY_TYPE,
  stageLabel,
  type DealTypeKey,
} from "@/lib/crm/matching-maps";

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
  screening_status: string | null;
  organization_id?: string | null;
  mandate_id?: string | null;
  dirigeant_id?: string | null;
  dirigeant_nom?: string | null;
}

// Mini pill de statut screening (V53) — non bloquant, purement informatif
const SCREENING_PILL: Record<string, { bg: string; tx: string; label: string }> = {
  not_started:        { bg: "var(--surface-3)", tx: "var(--text-5)", label: "À screener" },
  drafting:           { bg: "#FEF3C7",          tx: "#92400E",        label: "Screening…" },
  ready_for_outreach: { bg: "#D1FAE5",          tx: "#065F46",        label: "Prêt outreach" },
  on_hold:            { bg: "var(--surface-3)", tx: "var(--text-5)", label: "Pause" },
};

interface Props {
  deals: KanbanDeal[];
  lastActivityByDeal?: Record<string, string | null>;
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

// V55 : libellés de stages centralisés dans matching-maps.ts (stageLabel)

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

export function DealsKanban({ deals: initialDeals, lastActivityByDeal = {} }: Props) {
  const [deals, setDeals] = useState<KanbanDeal[]>(initialDeals);
  const [dormantFilter, setDormantFilter] = useState<"all" | "active" | "dormant">("all");
  // V55 : un kanban = un métier. Par défaut, on sélectionne le premier type
  // présent dans les dossiers ouverts pour éviter un écran vide.
  const firstType = useMemo<DealTypeKey>(() => {
    const open = initialDeals.find(d => d.deal_status === "open");
    const t = (open?.deal_type ?? initialDeals[0]?.deal_type ?? "fundraising") as DealTypeKey;
    return (t in DEAL_STAGES_BY_TYPE ? t : "fundraising") as DealTypeKey;
  }, [initialDeals]);
  const [typeFilter, setTypeFilter] = useState<DealTypeKey>(firstType);
  const [showClosed, setShowClosed] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "high_medium">("all");
  const [, startTransition] = useTransition();

  // V55 : filtrage strict par type (un kanban = un métier). Statut closed
  // toggle (won/lost masqués par défaut). Filtre priorité optionnel.
  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (d.deal_type !== typeFilter) return false;
      if (!showClosed && (d.deal_status === "won" || d.deal_status === "lost")) return false;
      if (priorityFilter === "high" && d.priority_level !== "high") return false;
      if (priorityFilter === "high_medium" && d.priority_level !== "high" && d.priority_level !== "medium") return false;
      if (dormantFilter !== "all") {
        const dormant = isDormant(lastActivityByDeal[d.id] ?? null, d.deal_status);
        if (dormantFilter === "dormant" && !dormant) return false;
        if (dormantFilter === "active" && dormant) return false;
      }
      return true;
    });
  }, [deals, typeFilter, showClosed, priorityFilter, dormantFilter, lastActivityByDeal]);

  const dormantCount = useMemo(() => {
    return deals.filter(d => d.deal_type === typeFilter && isDormant(lastActivityByDeal[d.id] ?? null, d.deal_status)).length;
  }, [deals, typeFilter, lastActivityByDeal]);

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

  // V55 : stades du métier sélectionné + stades post-opération si non vides
  // (ex. post_closing en fundraising/ma_sell, probation en recruitment).
  const visibleStages: string[] = useMemo(() => {
    const main = [...DEAL_STAGES_MAIN_BY_TYPE[typeFilter]];
    const allForType = DEAL_STAGES_BY_TYPE[typeFilter];
    for (const stage of allForType) {
      if (!main.includes(stage) && byStage[stage]?.length) main.push(stage);
    }
    return main;
  }, [byStage, typeFilter]);

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

  async function moveDealToStage(dealId: string, newStage: string) {
    const current = deals.find(d => d.id === dealId);
    if (!current) return;
    if (current.deal_stage === newStage) return;
    // V55 : valider que le nouveau stage est dans la séquence du type du dossier.
    const typeKey = (current.deal_type in DEAL_STAGES_BY_TYPE ? current.deal_type : "fundraising") as DealTypeKey;
    if (!DEAL_STAGES_BY_TYPE[typeKey].includes(newStage)) return;

    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_stage: newStage } : d));

    startTransition(async () => {
      const res = await updateDealStageAction(dealId, newStage);
      if (!res.success) {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_stage: current.deal_stage } : d));
        // eslint-disable-next-line no-alert
        alert(`Erreur : ${res.error}`);
      }
    });
  }

  function moveDeal(dealId: string, dir: "prev" | "next") {
    const current = deals.find(d => d.id === dealId);
    if (!current) return;
    const typeKey = (current.deal_type in DEAL_STAGES_BY_TYPE ? current.deal_type : "fundraising") as DealTypeKey;
    const stages = [...DEAL_STAGES_BY_TYPE[typeKey]];
    const idx = stages.indexOf(current.deal_stage);
    if (idx === -1) return;
    const newIdx = dir === "prev" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;
    void moveDealToStage(dealId, stages[newIdx]!);
  }

  // ── Drag & drop natif HTML5 ────────────────────────────────────────────────
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, dealId: string) {
    e.dataTransfer.setData("text/deal-id", dealId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stage: string) {
    if (!e.dataTransfer.types.includes("text/deal-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) setDragOverStage(stage);
  }
  function handleDragLeave(stage: string) {
    if (dragOverStage === stage) setDragOverStage(null);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>, stage: string) {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData("text/deal-id");
    if (!dealId) return;
    void moveDealToStage(dealId, stage);
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
          <ViewToggle current="kanban" />
          <Link href="/protected/dossiers/nouveau" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
            <Plus size={14}/> Nouveau dossier
          </Link>
        </div>
      </div>

      {/* V55 : un kanban par métier, un seul type à la fois */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {(Object.entries(TYPE_META) as [string, typeof TYPE_META[string]][]).map(([t, meta]) => {
          if (!(t in DEAL_STAGES_BY_TYPE)) return null;
          const n = typeCounts[t] ?? 0;
          const active = typeFilter === t;
          return (
            <button key={t} type="button" onClick={() => setTypeFilter(t as DealTypeKey)}
              style={pillBtn(active, meta.tx)}>
              {meta.icon} {meta.label} ({n})
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>Activité</span>
          {(["all", "active", "dormant"] as const).map(d => {
            const label =
              d === "all" ? "Tous" :
              d === "active" ? "Actifs" :
              `Dormants${dormantCount > 0 ? ` (${dormantCount})` : ""}`;
            const active = dormantFilter === d;
            const isWarn = d === "dormant";
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDormantFilter(d)}
                style={{
                  padding: "4px 10px", borderRadius: 16,
                  border: "1px solid " + (active ? (isWarn ? "#B45309" : "var(--text-1)") : "var(--border)"),
                  background: active ? (isWarn ? "#FEF3C7" : "var(--text-1)") : "var(--surface-2)",
                  color: active ? (isWarn ? "#92400E" : "var(--bg)") : "var(--text-3)",
                  fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>Priorité</span>
          {(["all", "high", "high_medium"] as const).map(p => {
            const label = p === "all" ? "Toutes" : p === "high" ? "Haute" : "Haute + Moyenne";
            const active = priorityFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                style={{
                  padding: "4px 10px", borderRadius: 16,
                  border: "1px solid " + (active ? "var(--text-1)" : "var(--border)"),
                  background: active ? "var(--text-1)" : "var(--surface-2)",
                  color: active ? "var(--bg)" : "var(--text-3)",
                  fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
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
            const label = stageLabel(stageValue);
            const isDragOver = dragOverStage === stageValue;
            return (
              <div
                key={stageValue}
                style={{ flex: 1, minWidth: 220 }}
                onDragOver={(e) => handleDragOver(e, stageValue)}
                onDragLeave={() => handleDragLeave(stageValue)}
                onDrop={(e) => handleDrop(e, stageValue)}
              >
                {/* Colonne header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", marginBottom: 6,
                  background: isDragOver ? "#DBEAFE" : "var(--surface-2)",
                  borderRadius: 9,
                  border: `1px solid ${isDragOver ? "#1D4ED8" : "var(--border)"}`,
                  transition: "background .12s, border-color .12s",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isDragOver ? "#1D4ED8" : "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
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
                <div style={{
                  display: "flex", flexDirection: "column", gap: 6, minHeight: 60,
                  padding: isDragOver ? 6 : 0,
                  borderRadius: 9,
                  background: isDragOver ? "rgba(29, 78, 216, .06)" : "transparent",
                  transition: "background .12s",
                }}>
                  {cards.length === 0 ? (
                    <div style={{ height: 52, border: `1px dashed ${isDragOver ? "#1D4ED8" : "var(--border)"}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 11, color: isDragOver ? "#1D4ED8" : "var(--text-6, var(--text-5))" }}>
                        {isDragOver ? "Déposer ici" : "—"}
                      </span>
                    </div>
                  ) : (
                    cards.map(d => (
                      <KanbanCard
                        key={d.id}
                        deal={d}
                        lastActivityDate={lastActivityByDeal[d.id] ?? null}
                        onMove={moveDeal}
                        onDragStart={(e) => handleDragStart(e, d.id)}
                      />
                    ))
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

function KanbanCard({ deal, lastActivityDate, onMove, onDragStart }: {
  deal: KanbanDeal;
  lastActivityDate: string | null;
  onMove: (dealId: string, dir: "prev" | "next") => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const meta = TYPE_META[deal.deal_type] ?? TYPE_META.fundraising;
  const prioColor = PRIO_COLOR[deal.priority_level] ?? PRIO_COLOR.low;
  const amount = fmtAmount(deal.target_amount, deal.currency);
  // V55 : navigation prev/next utilise la séquence du type du dossier
  const typeKey = (deal.deal_type in DEAL_STAGES_BY_TYPE ? deal.deal_type : "fundraising") as DealTypeKey;
  const stages = DEAL_STAGES_BY_TYPE[typeKey];
  const idx = stages.indexOf(deal.deal_stage);
  const hasPrev = idx > 0;
  const hasNext = idx !== -1 && idx < stages.length - 1;
  const inactive = deal.deal_status !== "open";

  return (
    <div
      draggable={!inactive}
      onDragStart={inactive ? undefined : onDragStart}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${prioColor}`,
        borderRadius: 9,
        padding: "10px 11px",
        opacity: inactive ? 0.55 : 1,
        display: "flex", flexDirection: "column", gap: 5,
        cursor: inactive ? "default" : "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <Link href={`/protected/dossiers/${deal.id}`}
          style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--text-1)", textDecoration: "none", minWidth: 0, lineHeight: 1.3 }}>
          {deal.name}
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "1px 6px", background: meta.bg, color: meta.tx }}>
            {meta.icon}
          </span>
          <DealHealthBadge
            health={computeDealHealth(deal, { last_activity_date: lastActivityDate })}
            size="sm" showLabel={false}
          />
        </div>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {deal.screening_status && SCREENING_PILL[deal.screening_status] && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: "1px 6px",
            background: SCREENING_PILL[deal.screening_status]!.bg,
            color: SCREENING_PILL[deal.screening_status]!.tx,
            borderRadius: 3,
          }}>
            {SCREENING_PILL[deal.screening_status]!.label}
          </span>
        )}
        {isDormant(lastActivityDate, deal.deal_status) && (
          <span
            title={`Aucune activité depuis ${DORMANT_THRESHOLD_DAYS} jours ou plus`}
            style={{
              fontSize: 10, fontWeight: 700,
              padding: "1px 6px",
              background: "#FEE2E2", color: "#991B1B",
              borderRadius: 3,
            }}
          >
            DORMANT
          </span>
        )}
      </div>

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
