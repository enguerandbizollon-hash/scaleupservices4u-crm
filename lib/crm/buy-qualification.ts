// Qualification d'un mandat d'ACQUISITION (ma_buy), pendant buy-side du
// screening de cession : avant d'ouvrir la recherche vers l'extérieur, le
// projet du repreneur doit être cadré (fiche, projet, critères, budget).
// Score déterministe et auditable, 0 à 100 : chaque point est justifié par un
// critère affiché tel quel dans l'UI. Module PUR (aucune I/O), testable.

import type { ScreeningScoreBreakdown } from "@/lib/crm/screening";

// Même seuil que le screening de cession : en dessous, le mandat n'est pas
// assez cadré pour être déclaré prêt.
export const BUY_QUALIFICATION_READY_MIN_SCORE = 60;

const MIN_CHARS_PROJET = 50;

/** Les champs du deal qui portent la qualification d'un mandat d'acquisition. */
export interface BuyQualificationSnapshot {
  /** Une fiche de cadrage a été importée et analysée (deals.cadrage_content). */
  cadrage_present: boolean;
  strategic_rationale: string | null;
  target_sectors: string[] | null;
  target_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  acquisition_budget_min: number | null;
  acquisition_budget_max: number | null;
  deal_timing: string | null;
  dirigeant_id: string | null;
  dirigeant_nom: string | null;
}

function hasText(v: string | null | undefined, min: number): boolean {
  return typeof v === "string" && v.trim().length >= min;
}

function hasItems(v: string[] | null | undefined): boolean {
  return Array.isArray(v) && v.some((x) => x && x.trim().length > 0);
}

/**
 * Score de qualification 0 à 100 d'un mandat d'acquisition. Reproductible
 * côté serveur comme côté client. Les clés `fillVia` de l'UI (où compléter)
 * sont portées par le composant, pas par le barème.
 */
export function computeBuyQualificationScore(s: BuyQualificationSnapshot): ScreeningScoreBreakdown {
  const items = [
    {
      key: "cadrage",
      label: "Fiche de cadrage importée",
      max: 15,
      filled: s.cadrage_present,
    },
    {
      key: "projet",
      label: "Projet du repreneur",
      max: 20,
      filled: hasText(s.strategic_rationale, MIN_CHARS_PROJET),
    },
    {
      key: "secteurs",
      label: "Secteurs cibles",
      max: 15,
      filled: hasItems(s.target_sectors),
    },
    {
      key: "geographie",
      label: "Géographie cible",
      max: 10,
      filled: hasItems(s.target_geographies),
    },
    {
      key: "ca_cible",
      label: "Fourchette de CA cible",
      max: 15,
      filled: s.target_revenue_min != null || s.target_revenue_max != null,
    },
    {
      key: "budget",
      label: "Apport / budget",
      max: 15,
      filled: s.acquisition_budget_min != null || s.acquisition_budget_max != null,
    },
    {
      key: "repreneur",
      label: "Repreneur identifié",
      max: 5,
      filled: !!(s.dirigeant_id || (s.dirigeant_nom && s.dirigeant_nom.trim())),
    },
    {
      key: "timing",
      label: "Horizon de reprise",
      max: 5,
      filled: !!s.deal_timing,
    },
  ];

  const enriched = items.map((i) => ({ ...i, earned: i.filled ? i.max : 0 }));
  const total = enriched.reduce((sum, i) => sum + i.earned, 0);
  return { total, items: enriched };
}
