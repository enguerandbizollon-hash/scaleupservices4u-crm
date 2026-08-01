// Funnel acquéreur (plan R1, v73) : logique pure, testable, zéro I/O.
// Les 5 statuts de deal_target_suggestions restent l'axe DÉCISION ; la
// PROGRESSION d'approche se DÉRIVE des colonnes datées (la date non nulle
// la plus avancée gagne). Pattern maison : déterministe et auditable,
// comme lib/crm/cedabilite.ts.

export type FunnelStage =
  | "pre_approche"
  | "approuve"
  | "teaser_envoye"
  | "nda_signe"
  | "im_envoye"
  | "offre_recue";

export interface FunnelDates {
  teaser_sent_at?: string | null;
  nda_signed_at?: string | null;
  im_sent_at?: string | null;
  offer_received_at?: string | null;
}

export interface SuggestionForFunnel extends FunnelDates {
  status: string;
}

/** Les 4 étapes marquables, dans l'ordre du funnel. */
export const FUNNEL_STEPS = [
  { key: "teaser_envoye", field: "teaser_sent_at", event: "teaser_sent" },
  { key: "nda_signe", field: "nda_signed_at", event: "nda_signed" },
  { key: "im_envoye", field: "im_sent_at", event: "im_sent" },
  { key: "offre_recue", field: "offer_received_at", event: "offer_received" },
] as const;

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]["key"];
export type FunnelDateField = (typeof FUNNEL_STEPS)[number]["field"];

/**
 * Étape courante : la date non nulle la plus AVANCÉE l'emporte (une étape
 * peut être marquée sans les précédentes : un acquéreur peut signer le NDA
 * sans que le teaser soit passé par l'outil). À défaut de date, retombe
 * sur le statut : contacted = l'approche est partie (lignes d'avant v73),
 * approved = validé pas encore approché.
 */
export function computeFunnelStage(s: SuggestionForFunnel): FunnelStage {
  if (s.offer_received_at) return "offre_recue";
  if (s.im_sent_at) return "im_envoye";
  if (s.nda_signed_at) return "nda_signe";
  if (s.teaser_sent_at) return "teaser_envoye";
  if (s.status === "contacted") return "teaser_envoye";
  if (s.status === "approved") return "approuve";
  return "pre_approche";
}

/**
 * Règles de relance par étape (jours après le geste). NULL = pas de
 * relance automatique proposée. Appliquées AU GESTE (markFunnelStep),
 * jamais recalculées par le cron : le cron ne fait que réveiller quand
 * next_followup_at est échue.
 *   teaser envoyé sans réponse  → J+7
 *   NDA signé sans IM           → J+3 (relance interne : envoyer l'IM)
 *   IM envoyé sans offre        → J+10
 *   offre reçue                 → NULL (la suite se pilote au dossier)
 */
export const FOLLOWUP_RULES: Record<FunnelStage, number | null> = {
  pre_approche: null,
  approuve: null,
  teaser_envoye: 7,
  nda_signe: 3,
  im_envoye: 10,
  offre_recue: null,
};

/** Jours de re-relance après « relance faite ». */
export const FOLLOWUP_AFTER_DONE_DAYS = 7;

/** Date de prochaine relance proposée (YYYY-MM-DD) pour une étape. */
export function defaultNextFollowup(stage: FunnelStage, from: Date): string | null {
  const days = FOLLOWUP_RULES[stage];
  if (days == null) return null;
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** L'étape est-elle un geste SORTANT (alimente last_outreach_at) ? */
export function isOutboundStep(step: FunnelStepKey): boolean {
  return step === "teaser_envoye" || step === "im_envoye";
}
