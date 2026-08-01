// Score d'intention acheteur v1 (plan R1 lot 5). Chaleur d'un acquéreur
// sur UN mandat : distinct du score de matching (fit). Déterministe et
// auditable comme computeCedabilite : chaque point justifié dans raisons,
// affiché tel quel. Aucune IA.
//
// Axes :
//   - Étape atteinte      (0-50) : la progression du funnel est le signal
//     d'intention le plus dur (un NDA signé ne ment pas)
//   - Réactivité          (0-25) : délai entre l'envoi et la première
//     réponse entrante du fil Gmail
//   - Engagement          (0-15) : volume de messages entrants depuis l'envoi
//   - Fraîcheur           (0-10) : dernière interaction récente
//   - Malus silence       (-10)  : teaser parti depuis plus de 14 jours
//     sans aucune réponse

import type { FunnelStage } from "@/lib/crm/funnel";

export interface InboundSignals {
  /** Première réponse entrante postérieure à l'envoi (ISO), null si aucune. */
  first_reply_at: string | null;
  /** Nombre de messages entrants depuis l'envoi. */
  inbound_count: number;
  /** Dernière interaction, entrante ou sortante (ISO). */
  last_interaction_at: string | null;
  /** Le fil Gmail est-il connu ? (sinon les axes email sont non évalués) */
  thread_known: boolean;
}

export interface IntentInput {
  stage: FunnelStage;
  /** Date d'envoi de référence : teaser_sent_at, à défaut last_outreach_at. */
  sent_at: string | null;
  inbound: InboundSignals;
}

export interface IntentResult {
  score: number; // 0-100
  raisons: string[];
}

const STAGE_POINTS: Record<FunnelStage, { pts: number; label: string }> = {
  pre_approche: { pts: 0, label: "Pas encore approché" },
  approuve: { pts: 0, label: "Approuvé, pas encore approché" },
  teaser_envoye: { pts: 20, label: "teaser envoyé" },
  nda_signe: { pts: 35, label: "NDA signé" },
  im_envoye: { pts: 42, label: "IM envoyé" },
  offre_recue: { pts: 50, label: "offre reçue" },
};

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

export function computeIntentScore(input: IntentInput, now: Date = new Date()): IntentResult {
  const raisons: string[] = [];
  let score = 0;

  // ── Étape atteinte (0-50) ───────────────────────────────────────────────
  const stage = STAGE_POINTS[input.stage];
  if (stage.pts > 0) {
    score += stage.pts;
    raisons.push(`+${stage.pts} ${stage.label}`);
  } else {
    raisons.push(`${stage.label} (0/50)`);
  }

  // ── Signaux email : besoin d'un envoi de référence et d'un fil connu ────
  if (!input.sent_at) {
    raisons.push("Aucun envoi tracé : réactivité et engagement non évalués");
    return { score: Math.max(0, Math.min(100, score)), raisons };
  }
  if (!input.inbound.thread_known) {
    raisons.push("Fil Gmail inconnu : réactivité et engagement non évalués (créez le brouillon depuis l'outil)");
  } else {
    // ── Réactivité (0-25) ─────────────────────────────────────────────────
    if (input.inbound.first_reply_at) {
      const delai = Math.max(0, daysBetween(input.sent_at, input.inbound.first_reply_at));
      if (delai <= 3) { score += 25; raisons.push(`+25 première réponse en ${delai} j`); }
      else if (delai <= 7) { score += 15; raisons.push(`+15 première réponse en ${delai} j`); }
      else if (delai <= 14) { score += 8; raisons.push(`+8 première réponse en ${delai} j`); }
      else { raisons.push(`Première réponse tardive (${delai} j, 0/25)`); }
    } else {
      raisons.push("Aucune réponse reçue (0/25)");
    }

    // ── Engagement (0-15) ─────────────────────────────────────────────────
    const n = input.inbound.inbound_count;
    if (n >= 3) { score += 15; raisons.push(`+15 ${n} messages reçus`); }
    else if (n === 2) { score += 10; raisons.push("+10 2 messages reçus"); }
    else if (n === 1) { score += 6; raisons.push("+6 1 message reçu"); }

    // ── Malus silence ─────────────────────────────────────────────────────
    if (n === 0 && input.stage === "teaser_envoye") {
      const silence = daysBetween(input.sent_at, now.toISOString());
      if (silence > 14) {
        score -= 10;
        raisons.push(`-10 silence depuis ${silence} j`);
      }
    }
  }

  // ── Fraîcheur (0-10) : dernière interaction, sortante incluse ───────────
  const lastIso = input.inbound.last_interaction_at ?? input.sent_at;
  if (lastIso) {
    const jours = Math.max(0, daysBetween(lastIso, now.toISOString()));
    if (jours < 7) { score += 10; raisons.push(`+10 interaction récente (${jours} j)`); }
    else if (jours < 14) { score += 6; raisons.push(`+6 interaction < 14 j`); }
    else if (jours < 30) { score += 3; raisons.push(`+3 interaction < 30 j`); }
    else { raisons.push(`Dernière interaction il y a ${jours} j (0/10)`); }
  }

  return { score: Math.max(0, Math.min(100, score)), raisons };
}
