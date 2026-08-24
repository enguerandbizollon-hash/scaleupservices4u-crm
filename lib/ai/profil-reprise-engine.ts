/**
 * lib/ai/profil-reprise-engine.ts — Profil de reprise anonyme (livrable buy).
 *
 * Le pendant EXACT du teaser pour un mandat d'acquisition : une page anonyme
 * qui présente le REPRENEUR et son projet au dirigeant d'une cible approchée,
 * pour crédibiliser la démarche sans révéler son identité. Claude génère un
 * contenu structuré (tool_choice forcé, pattern teaser-engine), puis le code
 * ANONYMISE : le nom du repreneur est scrubbé mécaniquement. On ne fait
 * jamais confiance au modèle seul pour la confidentialité.
 */

import { callClaudeRaw, isClaudeConfigured } from "@/lib/ai/anthropic";
import { forbiddenTokens, anonymizeText } from "@/lib/ai/teaser-engine";

// ── Contenu structuré ────────────────────────────────────────────────────────

export interface ProfilRepriseContent {
  titre: string;                                    // "Repreneur individuel, services B2B, région lyonnaise"
  accroche: string;                                 // 2-3 lignes : la démarche, sérieuse et confidentielle
  profil: string;                                   // parcours et légitimité du repreneur, anonyme
  projet: string;                                   // le projet de reprise et la continuité proposée
  criteres: { label: string; valeur: string }[];    // secteurs, taille, géographie, type d'opération
  capacite: string;                                 // capacité financière (apport, financement), arrondie
  demarche: string;                                 // confidentialité, étapes proposées, calendrier
}

export interface ProfilRepriseInput {
  // Identité RÉELLE (sert au prompt et à la liste d'interdits, jamais au rendu)
  repreneur_nom: string | null;
  // Société du repreneur (organisation cliente du mandat) : scrubbée aussi,
  // c'est le second vecteur d'identification (revue 2026-08-15).
  repreneur_societe: string | null;
  repreneur_siren: string | null;
  // Matière
  projet: string | null;                            // strategic_rationale ou cadrage.projet
  secteurs: string[];                               // target_sectors (labels)
  geographies: string[];                            // labels lisibles (geoLabel déjà appliqué)
  ca_min: number | null;
  ca_max: number | null;
  apport: number | null;                            // acquisition_budget_min
  budget_max: number | null;
  full_acquisition: boolean | null;
  management_retention: boolean | null;             // accompagnement du cédant souhaité
  deal_timing: string | null;                       // label lisible
}

const PROFIL_TOOL = {
  name: "render_profil_reprise",
  description: "Rend le contenu structuré du profil de reprise anonyme",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string", description: "Titre anonyme : type de repreneur + secteurs visés + zone. JAMAIS son nom." },
      accroche: { type: "string", description: "2-3 lignes : un repreneur qualifié, accompagné par Vectis Finance, cherche à reprendre une entreprise ; démarche sérieuse et confidentielle." },
      profil: { type: "string", description: "Paragraphe : profil et légitimité du repreneur (expérience, ancrage), anonyme, écrire « le Repreneur »." },
      projet: { type: "string", description: "Paragraphe : le projet de reprise, la continuité proposée (équipe, clients, ancrage local)." },
      criteres: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, valeur: { type: "string" } },
          required: ["label", "valeur"],
        },
        description: "3 à 6 critères de la cible recherchée (secteurs, chiffre d'affaires, géographie, type d'opération).",
      },
      capacite: { type: "string", description: "Capacité financière : apport disponible et financement envisagé, montants ARRONDIS, ton factuel." },
      demarche: { type: "string", description: "La démarche proposée : échange confidentiel sans engagement, NDA, étapes, horizon de temps." },
    },
    required: ["titre", "accroche", "profil", "projet", "criteres", "capacite", "demarche"],
  },
};

const SYSTEM_PROMPT = `Tu rédiges des profils de reprise pour Vectis Finance, boutique M&A small cap française. Ce document se remet au DIRIGEANT d'une entreprise cible approchée : il présente le repreneur et son projet pour crédibiliser la démarche, SANS révéler son identité.

Règles absolues :
- JAMAIS le nom du repreneur ni d'élément qui l'identifie : écrire « le Repreneur »
- Ne JAMAIS présenter l'entreprise du destinataire comme étant à vendre : la démarche est une prise de contact confidentielle
- Chiffres arrondis (300 k EUR, pas 312 456 EUR)
- Français sobre, direct, professionnel, pas de superlatifs, pas de tiret cadratin
- Uniquement des faits fournis : aucune invention. Une donnée absente ne s'invente pas, elle s'omet.`;

const fmtM = (n: number | null | undefined) =>
  n == null ? null : Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M EUR` : `${Math.round(n / 1_000)} k EUR`;

export function buildProfilReprisePrompt(input: ProfilRepriseInput): string {
  return [
    input.repreneur_nom
      ? `Repreneur réel (pour ton contexte seulement, INTERDIT dans le rendu) : ${input.repreneur_nom}`
      : "Repreneur : personne physique accompagnée par Vectis Finance",
    input.repreneur_societe
      ? `Société du repreneur (INTERDITE dans le rendu, ne pas la nommer ni la décrire de façon identifiable) : ${input.repreneur_societe}`
      : "",
    input.projet ? `Projet de reprise : ${input.projet}` : "",
    input.secteurs.length ? `Secteurs visés : ${input.secteurs.join(" · ")}` : "",
    input.geographies.length ? `Zones visées : ${input.geographies.join(", ")}` : "",
    input.ca_min != null || input.ca_max != null
      ? `Taille de cible (CA) : ${fmtM(input.ca_min) ?? "?"} à ${fmtM(input.ca_max) ?? "?"}`
      : "",
    input.apport != null ? `Apport disponible : ${fmtM(input.apport)}` : "",
    input.budget_max != null ? `Budget maximum envisagé : ${fmtM(input.budget_max)}` : "",
    input.full_acquisition != null
      ? `Opération recherchée : ${input.full_acquisition ? "prise de contrôle majoritaire (achat de titres)" : "prise de participation, majoritaire ou minoritaire"}`
      : "",
    input.management_retention != null
      ? `Accompagnement du cédant : ${input.management_retention ? "souhaité pendant une période de transition" : "non requis"}`
      : "",
    input.deal_timing ? `Horizon de reprise : ${input.deal_timing}` : "",
    "",
    "Génère le profil de reprise anonyme via l'outil render_profil_reprise.",
  ].filter(Boolean).join("\n");
}

export function anonymizeProfilReprise(content: ProfilRepriseContent, tokens: string[]): ProfilRepriseContent {
  const a = (s: string) => anonymizeText(s, tokens, "le Repreneur");
  return {
    titre: a(content.titre),
    accroche: a(content.accroche),
    profil: a(content.profil),
    projet: a(content.projet),
    criteres: content.criteres.map((c) => ({ label: a(c.label), valeur: a(c.valeur) })),
    capacite: a(content.capacite),
    demarche: a(content.demarche),
  };
}

/** Validation structurelle de la sortie du modèle. */
export function validateProfilRepriseContent(raw: unknown): ProfilRepriseContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  if (!str(r.titre) || !str(r.accroche) || !str(r.profil) || !str(r.projet) || !str(r.capacite) || !str(r.demarche)) return null;
  const criteres = Array.isArray(r.criteres)
    ? r.criteres.filter((c): c is { label: string; valeur: string } =>
        typeof c === "object" && c !== null && str((c as Record<string, unknown>).label) && str((c as Record<string, unknown>).valeur))
    : [];
  if (criteres.length === 0) return null;
  return {
    titre: r.titre.trim(),
    accroche: r.accroche.trim(),
    profil: r.profil.trim(),
    projet: r.projet.trim(),
    criteres,
    capacite: r.capacite.trim(),
    demarche: r.demarche.trim(),
  };
}

/** Génération complète : IA structurée puis anonymisation par code. */
export async function generateProfilRepriseContent(input: ProfilRepriseInput): Promise<ProfilRepriseContent | null> {
  if (!isClaudeConfigured()) return null;

  const res = await callClaudeRaw({
    prompt: buildProfilReprisePrompt(input),
    system: SYSTEM_PROMPT,
    maxTokens: 2000,
    tools: [PROFIL_TOOL],
    toolChoice: { type: "tool", name: "render_profil_reprise" },
  });
  if (!res.ok) return null;

  const toolUse = res.content.find((b) => b.type === "tool_use" && b.name === "render_profil_reprise");
  const validated = validateProfilRepriseContent(toolUse?.input);
  if (!validated) return null;

  return anonymizeProfilReprise(validated, profilRepriseForbiddenTokens(input));
}

/**
 * Liste d'interdits du profil : nom de PERSONNE (mots dès 2 lettres) + société
 * du repreneur et son SIREN. Le filet mécanique ne dépend pas du modèle.
 */
export function profilRepriseForbiddenTokens(input: Pick<ProfilRepriseInput, "repreneur_nom" | "repreneur_societe" | "repreneur_siren">): string[] {
  return [
    ...(input.repreneur_nom ? forbiddenTokens(input.repreneur_nom, null, 2) : []),
    ...(input.repreneur_societe ? forbiddenTokens(input.repreneur_societe, input.repreneur_siren) : []),
  ];
}

/**
 * Le profil se génère UNIQUEMENT avec de la matière : sans projet ni critères,
 * et sans apport ni budget, le modèle (tool forcé, champs obligatoires) serait
 * contraint d'inventer un repreneur. Retourne le message à afficher, ou null.
 */
export function profilRepriseMissingMatter(input: ProfilRepriseInput): string | null {
  const hasProjet = !!input.projet?.trim() || input.secteurs.length > 0 || input.geographies.length > 0
    || input.ca_min != null || input.ca_max != null;
  const hasCapacite = input.apport != null || input.budget_max != null;
  if (!hasProjet && !hasCapacite) {
    return "Complétez d'abord le cadrage du mandat (projet ou critères, et apport ou budget) : sans matière, le profil serait inventé.";
  }
  if (!hasProjet) return "Renseignez le projet ou les critères de cible (secteurs, géographie, CA) avant de générer le profil.";
  if (!hasCapacite) return "Renseignez l'apport ou le budget d'acquisition (onglet Budget) : la capacité financière ne s'invente pas.";
  return null;
}
