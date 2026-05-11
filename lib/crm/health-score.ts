// Health score automatique des dossiers
// Calcule un score 0-100 reflétant la santé d'un dossier selon 4 axes :
//   - Complétude fiche (30 pts) : org, dirigeant, mandat, financier
//   - Activité récente (30 pts) : dernière activité
//   - Avancement (20 pts) : stade dans la séquence du type
//   - Engagement commercial (20 pts) : tâches, prochaine action, fees
//
// Conçu pour être calculé côté server (page.tsx) ou côté client (kanban).
// Tous les signals sont optionnels : un signal absent compte 0 sur son axe.

import { DEAL_STAGES_BY_TYPE, type DealTypeKey } from "@/lib/crm/matching-maps";

export type HealthBand = "high" | "medium" | "low" | "critical";

export interface DealHealthInput {
  deal_type: string;
  deal_stage: string;
  deal_status: string;
  priority_level?: string | null;
  organization_id?: string | null;
  client_organization_id?: string | null;
  mandate_id?: string | null;
  dirigeant_id?: string | null;
  dirigeant_nom?: string | null;
  target_amount?: number | null;
  target_date?: string | null;
  next_action_date?: string | null;
}

export interface DealHealthSignals {
  // Date ISO de la dernière activité ou tâche
  last_activity_date?: string | null;
  // Nombre de tâches ouvertes (non done/cancelled)
  open_tasks_count?: number;
  // Nombre de tâches en retard
  overdue_tasks_count?: number;
  // Présence de données financières (au moins 1 ligne)
  has_financial_data?: boolean;
  // Présence de fees estimés > 0 sur le mandat lié
  has_fees_estimated?: boolean;
  // Nombre d'orgas liées (deal_organizations)
  linked_orgs_count?: number;
}

export interface DealHealthResult {
  score: number;       // 0-100
  band: HealthBand;
  reasons: string[];   // Liste des points contributifs (positifs et négatifs)
}

export function computeDealHealth(
  deal: DealHealthInput,
  signals: DealHealthSignals = {},
): DealHealthResult {
  let score = 0;
  const reasons: string[] = [];

  // Si le dossier est fermé : score neutre (non-applicable)
  if (deal.deal_status === "won") {
    return { score: 100, band: "high", reasons: ["Dossier gagné"] };
  }
  if (deal.deal_status === "lost") {
    return { score: 0, band: "critical", reasons: ["Dossier perdu"] };
  }
  if (deal.deal_status === "paused") {
    return { score: 30, band: "low", reasons: ["Dossier en pause"] };
  }

  // ── Complétude (30 pts) ─────────────────────────────────────────────────
  const hasOrg = !!(deal.organization_id || deal.client_organization_id || (signals.linked_orgs_count ?? 0) > 0);
  if (hasOrg) { score += 10; reasons.push("+10 organisation cliente"); }
  else { reasons.push("-10 sans organisation cliente"); }

  const hasDirigeant = !!(deal.dirigeant_id || deal.dirigeant_nom);
  if (hasDirigeant) { score += 10; reasons.push("+10 dirigeant identifié"); }
  else { reasons.push("-10 dirigeant manquant"); }

  if (deal.mandate_id) { score += 5; reasons.push("+5 mandat lié"); }
  if (signals.has_financial_data) { score += 5; reasons.push("+5 données financières"); }

  // ── Activité (30 pts) ──────────────────────────────────────────────────
  if (signals.last_activity_date) {
    const days = daysSince(signals.last_activity_date);
    if (days <= 7)       { score += 30; reasons.push(`+30 activité récente (${days}j)`); }
    else if (days <= 14) { score += 20; reasons.push(`+20 activité < 14j (${days}j)`); }
    else if (days <= 30) { score += 10; reasons.push(`+10 activité < 30j (${days}j)`); }
    else if (days <= 60) { score += 5;  reasons.push(`+5 activité < 60j (${days}j)`); }
    else                 { reasons.push(`Dormant depuis ${days}j`); }
  } else {
    reasons.push("Aucune activité enregistrée");
  }

  // ── Avancement (20 pts) ────────────────────────────────────────────────
  const typeKey = (deal.deal_type in DEAL_STAGES_BY_TYPE ? deal.deal_type : "fundraising") as DealTypeKey;
  const stages = DEAL_STAGES_BY_TYPE[typeKey];
  const idx = stages.indexOf(deal.deal_stage);
  if (idx >= 0 && stages.length > 1) {
    const ratio = idx / (stages.length - 1);
    const stagePts = Math.round(ratio * 20);
    score += stagePts;
    if (stagePts > 0) reasons.push(`+${stagePts} stade ${deal.deal_stage}`);
  }

  // ── Engagement commercial (20 pts) ─────────────────────────────────────
  const openTasks = signals.open_tasks_count ?? 0;
  if (openTasks > 0) { score += 10; reasons.push(`+10 ${openTasks} tâche${openTasks > 1 ? "s" : ""} ouverte${openTasks > 1 ? "s" : ""}`); }

  if (deal.next_action_date) { score += 5; reasons.push("+5 prochaine action planifiée"); }
  if (signals.has_fees_estimated) { score += 5; reasons.push("+5 fees estimés"); }

  // ── Pénalités (sur le total) ───────────────────────────────────────────
  const overdue = signals.overdue_tasks_count ?? 0;
  if (overdue > 0) {
    const penalty = Math.min(15, overdue * 5);
    score -= penalty;
    reasons.push(`-${penalty} ${overdue} tâche${overdue > 1 ? "s" : ""} en retard`);
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const band: HealthBand =
    score >= 75 ? "high" :
    score >= 50 ? "medium" :
    score >= 25 ? "low" :
    "critical";

  return { score, band, reasons };
}

function daysSince(d: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

// Métadonnées d'affichage par bande
export const HEALTH_META: Record<HealthBand, { label: string; bg: string; tx: string; dot: string }> = {
  high:     { label: "Saine",      bg: "#D1FAE5",          tx: "#065F46", dot: "#10B981" },
  medium:   { label: "Correcte",   bg: "#DBEAFE",          tx: "#1E40AF", dot: "#3B82F6" },
  low:      { label: "À pousser",  bg: "#FEF3C7",          tx: "#92400E", dot: "#F59E0B" },
  critical: { label: "Critique",   bg: "#FEE2E2",          tx: "#991B1B", dot: "#EF4444" },
};

// Seuil dormant : pas d'activité depuis ce nombre de jours
export const DORMANT_THRESHOLD_DAYS = 21;

export function isDormant(lastActivityDate: string | null | undefined, status: string): boolean {
  if (status !== "open") return false;
  if (!lastActivityDate) return true;
  return daysSince(lastActivityDate) >= DORMANT_THRESHOLD_DAYS;
}
