// Radar de cédabilité (phase 2, temps 4).
// Score 0-100 DÉTERMINISTE et transparent : chaque point est justifié dans
// `raisons`, affiché tel quel à l'utilisateur. Pas d'IA ici (décision carte
// phase 2) : le radar doit être auditable, gratuit et recalculable à volonté.
//
// Axes :
//   - Âge du dirigeant principal   (0-40) — le cœur du signal de transmission
//   - Ancienneté de l'entreprise   (0-15) — patrimoine établi, cessible
//   - Santé financière             (0-25) — marge nette du dernier exercice
//   - Fraîcheur des données        (0-10) — comptes récents disponibles
//   - Ajustements signaux          (± )   — procédure collective, cession déjà
//     actée, radiation : ces événements écrasent ou pénalisent le score.
//
// Piège détecté en recette (2026-07-30, cas SCIERIE FOREST) : quand un
// membre de la famille a déjà repris les commandes (même nom, une
// génération d'écart), le dirigeant le plus âgé reste listé et gonflait
// l'axe âge. Détection « relève familiale » : l'axe âge se calcule alors
// sur le repreneur, et la raison l'affiche noir sur blanc.

import { computeAgeFromBirth } from "@/lib/connectors/recherche-entreprises";

export interface DirigeantForCedabilite {
  nom: string | null;
  prenoms: string | null;
  qualite: string | null;
  date_de_naissance: string | null;
}

export interface FicheForCedabilite {
  age_dirigeant_principal: number | null;
  date_creation: string | null; // ISO
  finances: Record<string, { ca?: number | null; resultat_net?: number | null }> | null;
  dirigeants?: DirigeantForCedabilite[] | null;
  /** Bénéficiaires effectifs (Pappers, v68) : nourrit l'axe concentration. */
  actionnariat?: Array<{ type?: string | null; pourcentage_parts?: number | null }> | null;
}

export interface ReleveFamiliale {
  jeune: { label: string; age: number };
  senior: { label: string; age: number };
}

const QUALITE_DIRECTION_RE = /g[ée]rant|pr[ée]sident|directeur g[ée]n[ée]ral/i;
const QUALITE_EXCLUE_RE = /commissaire/i;

/**
 * Relève familiale probable : deux dirigeants personnes physiques du même
 * nom, une génération d'écart (>= 20 ans), le senior en âge de transmettre
 * (>= 60 ans) et le plus jeune occupant un poste de direction. Dans ce cas
 * la transmission est vraisemblablement déjà réglée en interne.
 */
export function detectReleveFamiliale(
  dirigeants: DirigeantForCedabilite[] | null | undefined,
  now: Date = new Date(),
): ReleveFamiliale | null {
  const candidats = (dirigeants ?? [])
    .filter((d) => d.nom && !(d.qualite && QUALITE_EXCLUE_RE.test(d.qualite)))
    .map((d) => ({
      nom: (d.nom as string).trim(),
      label: [d.prenoms?.split(" ")[0], d.nom].filter(Boolean).join(" "),
      qualite: d.qualite,
      age: computeAgeFromBirth(d.date_de_naissance, now),
    }))
    .filter((d): d is typeof d & { age: number } => d.age != null);

  const byNom = new Map<string, typeof candidats>();
  for (const c of candidats) {
    const key = c.nom.toLowerCase();
    byNom.set(key, [...(byNom.get(key) ?? []), c]);
  }

  for (const group of byNom.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.age - b.age);
    const jeune = sorted[0];
    const senior = sorted[sorted.length - 1];
    if (senior.age < 60) continue;
    if (senior.age - jeune.age < 20) continue;
    // Le repreneur doit tenir un poste de direction (tolérance si qualité absente).
    if (jeune.qualite && !QUALITE_DIRECTION_RE.test(jeune.qualite)) continue;
    return {
      jeune: { label: jeune.label, age: jeune.age },
      senior: { label: senior.label, age: senior.age },
    };
  }
  return null;
}

export interface SignauxForCedabilite {
  /** Types de signaux portant ce SIREN (ex. ["depot_comptes"]). */
  types: string[];
}

export interface CedabiliteResult {
  score: number;        // 0-100
  raisons: string[];    // justification humaine de chaque composante
}

export function computeCedabilite(
  fiche: FicheForCedabilite,
  signaux: SignauxForCedabilite = { types: [] },
  now: Date = new Date(),
): CedabiliteResult {
  const raisons: string[] = [];
  let score = 0;

  // ── Signaux éliminatoires d'abord ───────────────────────────────────────
  if (signaux.types.includes("radiation")) {
    return { score: 0, raisons: ["Société radiée (signal BODACC)"] };
  }
  if (signaux.types.includes("vente_cession")) {
    return { score: 0, raisons: ["Cession déjà publiée au BODACC : trop tard"] };
  }

  // ── Âge du dirigeant principal (0-40) ───────────────────────────────────
  // Relève familiale détectée : le signal de transmission est éteint, l'axe
  // âge se calcule sur le repreneur (naturellement bas), raison affichée.
  const releve = detectReleveFamiliale(fiche.dirigeants, now);
  if (releve) {
    raisons.push(
      `Relève familiale probable : ${releve.jeune.label} (${releve.jeune.age} ans) aux commandes, même nom que ${releve.senior.label} (${releve.senior.age} ans)`,
    );
  }
  const age = releve ? releve.jeune.age : fiche.age_dirigeant_principal;
  if (age == null) {
    raisons.push("Âge dirigeant inconnu (0/40)");
  } else if (age >= 65 && age <= 70) {
    score += 40; raisons.push(`+40 dirigeant ${age} ans, fenêtre de transmission`);
  } else if (age > 70) {
    score += 38; raisons.push(`+38 dirigeant ${age} ans, transmission urgente`);
  } else if (age >= 60) {
    score += 35; raisons.push(`+35 dirigeant ${age} ans, transmission proche`);
  } else if (age >= 55) {
    score += 22; raisons.push(`+22 dirigeant ${age} ans, horizon 5 ans`);
  } else if (age >= 50) {
    score += 10; raisons.push(`+10 dirigeant ${age} ans, horizon lointain`);
  } else {
    raisons.push(`Dirigeant ${age} ans, pas d'enjeu de transmission (0/40)`);
  }

  // ── Ancienneté de l'entreprise (0-15) ───────────────────────────────────
  const founded = fiche.date_creation ? parseInt(fiche.date_creation.slice(0, 4), 10) : NaN;
  const anciennete = Number.isFinite(founded) ? now.getUTCFullYear() - founded : null;
  if (anciennete == null) {
    raisons.push("Ancienneté inconnue (0/15)");
  } else if (anciennete >= 30) {
    score += 15; raisons.push(`+15 entreprise établie (${anciennete} ans)`);
  } else if (anciennete >= 20) {
    score += 12; raisons.push(`+12 entreprise mature (${anciennete} ans)`);
  } else if (anciennete >= 10) {
    score += 8; raisons.push(`+8 entreprise installée (${anciennete} ans)`);
  } else if (anciennete >= 5) {
    score += 4; raisons.push(`+4 entreprise jeune (${anciennete} ans)`);
  } else {
    raisons.push(`Entreprise récente (${anciennete} ans, 0/15)`);
  }

  // ── Santé financière (0-25) — marge nette du dernier exercice publié ────
  const years = Object.keys(fiche.finances ?? {}).sort().reverse();
  const latestYear = years[0];
  const latest = latestYear ? fiche.finances![latestYear] : null;
  const ca = latest?.ca ?? null;
  const rn = latest?.resultat_net ?? null;
  if (ca == null || ca <= 0) {
    score += 8; raisons.push("Finances non publiées (8/25 par défaut)");
  } else if (rn == null) {
    score += 12; raisons.push(`+12 CA ${latestYear} connu, résultat non publié`);
  } else {
    const marge = rn / ca;
    if (marge >= 0.08) {
      score += 25; raisons.push(`+25 marge nette ${(marge * 100).toFixed(1)}% (${latestYear})`);
    } else if (marge >= 0.03) {
      score += 18; raisons.push(`+18 marge nette ${(marge * 100).toFixed(1)}% (${latestYear})`);
    } else if (marge >= 0) {
      score += 10; raisons.push(`+10 marge nette faible ${(marge * 100).toFixed(1)}% (${latestYear})`);
    } else {
      score += 3; raisons.push(`+3 exercice ${latestYear} déficitaire`);
    }
  }

  // ── Fraîcheur des données (0-10) ────────────────────────────────────────
  if (latestYear) {
    const yearNum = parseInt(latestYear, 10);
    const lag = now.getUTCFullYear() - yearNum;
    if (lag <= 1) {
      score += 10; raisons.push(`+10 comptes récents (${latestYear})`);
    } else if (lag === 2) {
      score += 6; raisons.push(`+6 comptes ${latestYear}`);
    } else {
      raisons.push(`Comptes anciens (${latestYear}, 0/10)`);
    }
  }

  // ── Concentration du capital (0-5) — barème routine Vectis 2026-07-31 ───
  // Un ou deux bénéficiaires effectifs personnes physiques qui tiennent
  // l'essentiel du capital : décision de cession simple, pas de minoritaires
  // à convaincre. Ne s'évalue qu'après enrichissement Pappers.
  const partsPhysiques = (fiche.actionnariat ?? [])
    .filter((a) => a.type !== "morale")
    .map((a) => a.pourcentage_parts ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => b - a);
  if (partsPhysiques.length > 0) {
    const top2 = partsPhysiques.slice(0, 2).reduce((s, p) => s + p, 0);
    if (top2 >= 80) {
      score += 5;
      raisons.push(`+5 capital concentré (${partsPhysiques.length === 1 ? "un actionnaire" : "deux actionnaires"} ≈ ${Math.round(Math.min(100, top2))} %)`);
    }
  }

  // ── Ajustements signaux ─────────────────────────────────────────────────
  if (signaux.types.includes("procedure_collective")) {
    score -= 30;
    raisons.push("-30 procédure collective en cours (canal distressed, pas cession classique)");
  }
  if (signaux.types.includes("depot_comptes")) {
    score += 5;
    raisons.push("+5 dépôt de comptes récent (données fraîches à jour)");
  }
  // Barème routine Vectis (2026-07-31) : signaux d'événement BODACC.
  if (signaux.types.includes("location_gerance")) {
    score += 8;
    raisons.push("+8 fonds donné en location-gérance (transmission amorcée)");
  }
  if (signaux.types.includes("changement_dirigeant")) {
    score += 4;
    raisons.push("+4 changement récent dans la direction (BODACC)");
  }

  return { score: Math.max(0, Math.min(100, score)), raisons };
}

/** Bandes d'affichage du radar. */
export function cedabiliteBand(score: number | null): { label: string; bg: string; tx: string } {
  if (score == null) return { label: "Non scoré", bg: "var(--surface-3)", tx: "var(--text-5)" };
  if (score >= 70) return { label: "Chaude", bg: "#FEE2E2", tx: "#991B1B" };
  if (score >= 50) return { label: "Tiède", bg: "#FEF3C7", tx: "#92400E" };
  if (score >= 30) return { label: "À suivre", bg: "#DBEAFE", tx: "#1D4ED8" };
  return { label: "Froide", bg: "var(--surface-3)", tx: "var(--text-5)" };
}
