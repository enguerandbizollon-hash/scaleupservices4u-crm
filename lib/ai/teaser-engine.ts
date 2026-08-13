/**
 * lib/ai/teaser-engine.ts — Génération du teaser anonymisé (Deal OS, C).
 *
 * Le teaser est LE document d'approche : une page, anonyme, qui donne
 * envie sans permettre d'identifier la société. Claude génère un contenu
 * structuré (tool_choice forcé, pattern document-extraction), puis le
 * code ANONYMISE : le nom de la société, ses variantes et le SIREN sont
 * scrubbés mécaniquement. On ne fait jamais confiance au modèle seul
 * pour la confidentialité.
 */

import { callClaudeRaw, isClaudeConfigured } from "@/lib/ai/anthropic";

// ── Contenu structuré ────────────────────────────────────────────────────────

export interface TeaserContent {
  titre: string;                                    // "Société de charpente industrielle, région AuRA"
  accroche: string;                                 // 2-3 lignes d'ouverture
  activite: string;                                 // paragraphe activité/modèle, anonyme
  chiffres_cles: { label: string; valeur: string }[];
  points_forts: string[];
  operation: string;                                // contexte et périmètre de la cession
  localisation: string;                             // région, jamais la ville exacte
}

export interface TeaserInput {
  // Identité RÉELLE (sert au prompt et à la liste d'interdits, jamais au rendu)
  company_name: string;
  siren: string | null;
  ville: string | null;
  // Matière
  sector: string | null;
  location_region: string | null;
  description: string | null;
  executive_summary: string | null;
  key_differentiators: string[] | null;
  deal_context: string | null;
  partial_sale_ok: boolean | null;
  management_retention: boolean | null;
  asking_price_min: number | null;
  asking_price_max: number | null;
  finances: Array<{ fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null; headcount: number | null }>;
  synthese_fiche: string | null;                    // synthèse 360 si disponible
}

const TEASER_TOOL = {
  name: "render_teaser",
  description: "Rend le contenu structuré du teaser anonymisé",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string", description: "Titre anonyme : nature de l'activité + région. JAMAIS le nom de la société." },
      accroche: { type: "string", description: "2-3 lignes qui donnent envie, factuelles, sobres." },
      activite: { type: "string", description: "Paragraphe activité, modèle, clients types, positionnement. Anonyme." },
      chiffres_cles: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, valeur: { type: "string" } },
          required: ["label", "valeur"],
        },
        description: "4 à 6 chiffres (CA, EBITDA, effectif, croissance, ancienneté...). Arrondis, jamais au centime.",
      },
      points_forts: { type: "array", items: { type: "string" }, description: "3 à 5 points forts factuels." },
      operation: { type: "string", description: "Contexte de l'opération et périmètre envisagé (cession totale/partielle, accompagnement), sans détail identifiant." },
      localisation: { type: "string", description: "Région uniquement, jamais la ville." },
    },
    required: ["titre", "accroche", "activite", "chiffres_cles", "points_forts", "operation", "localisation"],
  },
};

const SYSTEM_PROMPT = `Tu rédiges des teasers M&A pour Vectis Finance, boutique small cap française. Un teaser est ANONYME : il présente la société sans permettre de l'identifier.

Règles absolues :
- JAMAIS le nom de la société, le SIREN, la ville exacte, le nom des dirigeants ou des marques identifiantes : écrire « la Société »
- Localisation au niveau RÉGION uniquement
- Chiffres arrondis (1,6 M EUR, pas 1 612 345 EUR)
- Français sobre, direct, professionnel, pas de superlatifs, pas de tiret cadratin
- Uniquement des faits fournis : aucune invention. Une donnée absente ne s'invente pas, elle s'omet.`;

const fmtM = (n: number | null | undefined) =>
  n == null ? null : Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M EUR` : `${Math.round(n / 1_000)} k EUR`;

export function buildTeaserPrompt(input: TeaserInput): string {
  const finLines = input.finances.map((f) =>
    `  ${f.fiscal_year} : CA ${fmtM(f.revenue) ?? "n.d."}${f.ebitda != null ? `, EBITDA ${fmtM(f.ebitda)}` : ""}${f.net_income != null ? `, RN ${fmtM(f.net_income)}` : ""}${f.headcount != null ? `, ${f.headcount} pers.` : ""}`,
  );
  return [
    `Société réelle (pour ton contexte seulement, INTERDITE dans le rendu) : ${input.company_name}${input.ville ? `, ${input.ville}` : ""}`,
    `Secteur : ${input.sector ?? "n.d."} · Région à utiliser : ${input.location_region ?? "France"}`,
    input.description ? `Description interne : ${input.description}` : "",
    input.executive_summary ? `Pitch screening : ${input.executive_summary}` : "",
    input.synthese_fiche ? `Synthèse 360 :\n${input.synthese_fiche}` : "",
    input.key_differentiators?.length ? `Différenciateurs : ${input.key_differentiators.join(" · ")}` : "",
    finLines.length ? `Finances (exercices réels) :\n${finLines.join("\n")}` : "Finances : non disponibles",
    `Contexte de l'opération : ${input.deal_context ?? "non précisé"}`,
    `Cession partielle acceptée : ${input.partial_sale_ok == null ? "n.d." : input.partial_sale_ok ? "oui" : "non, cession totale"}`,
    `Le management reste : ${input.management_retention == null ? "n.d." : input.management_retention ? "oui" : "non"}`,
    input.asking_price_min != null || input.asking_price_max != null
      ? `Prix demandé (NE PAS le mettre dans le teaser, contexte seulement) : ${fmtM(input.asking_price_min) ?? "?"} à ${fmtM(input.asking_price_max) ?? "?"}`
      : "",
    "",
    "Génère le teaser anonymisé via l'outil render_teaser.",
  ].filter(Boolean).join("\n");
}

// ── Anonymisation par code (jamais de confiance aveugle au modèle) ───────────

/** Mots identifiants à scrubber : nom de société (mots > 2 lettres) + SIREN. */
export function forbiddenTokens(companyName: string, siren: string | null): string[] {
  const STOP = new Set(["sarl", "sas", "sasu", "sa", "eurl", "sci", "ets", "etablissements", "établissements", "societe", "société", "groupe", "les", "des", "de", "du", "la", "le", "et"]);
  const words = companyName
    .split(/[\s\-']+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  return [...words, ...(siren ? [siren] : [])];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remplace toute occurrence d'un token interdit par un libellé neutre
 * (« la Société » par défaut ; « le Repreneur » côté profil de reprise). */
export function anonymizeText(text: string, tokens: string[], replacement = "la Société"): string {
  let out = text;
  for (const t of tokens) {
    out = out.replace(new RegExp(escapeRe(t), "gi"), replacement);
  }
  // Nettoyage des doublons créés par le scrub.
  const rep = escapeRe(replacement);
  return out.replace(new RegExp(`(${rep})(\\s+${rep})+`, "g"), "$1").replace(/\s{2,}/g, " ").trim();
}

export function anonymizeTeaser(content: TeaserContent, tokens: string[]): TeaserContent {
  const a = (s: string) => anonymizeText(s, tokens);
  return {
    titre: a(content.titre),
    accroche: a(content.accroche),
    activite: a(content.activite),
    chiffres_cles: content.chiffres_cles.map((c) => ({ label: a(c.label), valeur: a(c.valeur) })),
    points_forts: content.points_forts.map(a),
    operation: a(content.operation),
    localisation: a(content.localisation),
  };
}

/** Validation structurelle de la sortie du modèle. */
export function validateTeaserContent(raw: unknown): TeaserContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  if (!str(r.titre) || !str(r.accroche) || !str(r.activite) || !str(r.operation) || !str(r.localisation)) return null;
  const chiffres = Array.isArray(r.chiffres_cles)
    ? r.chiffres_cles.filter((c): c is { label: string; valeur: string } =>
        typeof c === "object" && c !== null && str((c as Record<string, unknown>).label) && str((c as Record<string, unknown>).valeur))
    : [];
  const points = Array.isArray(r.points_forts) ? r.points_forts.filter(str) : [];
  if (chiffres.length === 0 || points.length === 0) return null;
  return {
    titre: r.titre.trim(),
    accroche: r.accroche.trim(),
    activite: r.activite.trim(),
    chiffres_cles: chiffres,
    points_forts: points,
    operation: r.operation.trim(),
    localisation: r.localisation.trim(),
  };
}

/** Génération complète : IA structurée puis anonymisation par code. */
export async function generateTeaserContent(input: TeaserInput): Promise<TeaserContent | null> {
  if (!isClaudeConfigured()) return null;

  const res = await callClaudeRaw({
    prompt: buildTeaserPrompt(input),
    system: SYSTEM_PROMPT,
    maxTokens: 2000,
    tools: [TEASER_TOOL],
    toolChoice: { type: "tool", name: "render_teaser" },
  });
  if (!res.ok) return null;

  const toolUse = res.content.find((b) => b.type === "tool_use" && b.name === "render_teaser");
  const validated = validateTeaserContent(toolUse?.input);
  if (!validated) return null;

  return anonymizeTeaser(validated, forbiddenTokens(input.company_name, input.siren));
}
