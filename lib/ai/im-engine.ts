/**
 * lib/ai/im-engine.ts — Information Memorandum (plan R1 lot 6).
 *
 * L'IM est le document POST-NDA : nominatif (contrairement au teaser,
 * aucune anonymisation), plus profond, projections incluses. Claude
 * génère un contenu structuré (tool_choice forcé, pattern teaser-engine),
 * uniquement à partir des faits fournis : une donnée absente s'omet,
 * elle ne s'invente pas. L'utilisateur relit avant toute diffusion.
 */

import { callClaudeRaw, isClaudeConfigured } from "@/lib/ai/anthropic";

// ── Contenu structuré ────────────────────────────────────────────────────────

export interface IMContent {
  titre: string;                                    // "Information Memorandum : <Société>"
  resume: string;                                   // executive summary, 4-6 lignes
  societe_historique: string;                       // création, parcours, actionnariat
  activite_modele: string;                          // activité, modèle, clients types
  marche_position: string;                          // marché, concurrence, position
  chiffres_cles: { label: string; valeur: string }[];
  finances_commentees: string;                      // lecture des exercices + projections
  management_organisation: string;                  // équipe, organisation, dépendance dirigeant
  forces: string[];
  points_attention: string[];                       // risques honnêtes, formulés sobrement
  operation_envisagee: string;                      // périmètre, contexte, accompagnement
}

export interface IMInput {
  company_name: string;
  siren: string | null;
  ville: string | null;
  sector: string | null;
  description: string | null;
  // Screening (v53) : la matière narrative du dossier
  executive_summary: string | null;
  motivation_narrative: string | null;
  competitive_landscape: string | null;
  market_context: string | null;
  key_differentiators: string[] | null;
  key_risks: string[] | null;
  // Cadre de l'opération
  deal_context: string | null;
  partial_sale_ok: boolean | null;
  management_retention: boolean | null;
  dirigeant_nom: string | null;
  dirigeant_titre: string | null;
  // Finances : exercices réels PUIS projections (is_forecast)
  finances: Array<{ fiscal_year: number; revenue: number | null; ebitda: number | null; net_income: number | null; headcount: number | null; is_forecast: boolean }>;
  synthese_fiche: string | null;
}

const IM_TOOL = {
  name: "render_im",
  description: "Rend le contenu structuré de l'Information Memorandum",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string", description: "Titre : « Information Memorandum » suivi du nom de la société (l'IM est nominatif)." },
      resume: { type: "string", description: "Executive summary : 4 à 6 lignes, l'essentiel de l'opportunité." },
      societe_historique: { type: "string", description: "Création, parcours, jalons, actionnariat si connu." },
      activite_modele: { type: "string", description: "Activité, modèle économique, clients types, positionnement." },
      marche_position: { type: "string", description: "Marché, dynamique, concurrence, position de la société." },
      chiffres_cles: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, valeur: { type: "string" } },
          required: ["label", "valeur"],
        },
        description: "5 à 8 chiffres (CA, EBITDA, marge, effectif, ancienneté, croissance...). Arrondis.",
      },
      finances_commentees: { type: "string", description: "Lecture commentée des exercices fournis, projections signalées comme telles. Aucun chiffre inventé." },
      management_organisation: { type: "string", description: "Dirigeant, équipe, organisation, dépendance au dirigeant et accompagnement prévu." },
      forces: { type: "array", items: { type: "string" }, description: "4 à 6 forces factuelles." },
      points_attention: { type: "array", items: { type: "string" }, description: "2 à 4 points d'attention honnêtes, formulés sobrement (un IM crédible n'est pas une plaquette)." },
      operation_envisagee: { type: "string", description: "Périmètre de la cession, contexte, calendrier indicatif, accompagnement." },
    },
    required: ["titre", "resume", "societe_historique", "activite_modele", "marche_position", "chiffres_cles", "finances_commentees", "management_organisation", "forces", "points_attention", "operation_envisagee"],
  },
};

const SYSTEM_PROMPT = `Tu rédiges des Information Memorandum M&A pour Vectis Finance, boutique small cap française. L'IM est remis APRÈS signature d'un NDA : il est NOMINATIF (le nom de la société s'écrit en clair) et doit être crédible, donc honnête.

Règles absolues :
- Uniquement des faits fournis : AUCUNE invention. Une donnée absente s'omet, elle ne s'invente pas.
- Les projections (exercices marqués « projection ») se présentent TOUJOURS comme telles, jamais comme du réalisé.
- Chiffres arrondis (1,6 M EUR, pas 1 612 345 EUR).
- Français sobre, direct, professionnel, pas de superlatifs, pas de tiret cadratin.
- Les points d'attention sont réels et formulés factuellement : un IM sans risque n'est pas crédible.`;

const fmtM = (n: number | null | undefined) =>
  n == null ? null : Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M EUR` : `${Math.round(n / 1_000)} k EUR`;

export function buildIMPrompt(input: IMInput): string {
  const finLine = (f: IMInput["finances"][number]) =>
    `  ${f.fiscal_year}${f.is_forecast ? " (projection)" : ""} : CA ${fmtM(f.revenue) ?? "n.d."}${f.ebitda != null ? `, EBITDA ${fmtM(f.ebitda)}` : ""}${f.net_income != null ? `, RN ${fmtM(f.net_income)}` : ""}${f.headcount != null ? `, ${f.headcount} pers.` : ""}`;
  const reels = input.finances.filter(f => !f.is_forecast);
  const projections = input.finances.filter(f => f.is_forecast);

  return [
    `Société : ${input.company_name}${input.siren ? ` (SIREN ${input.siren})` : ""}${input.ville ? `, ${input.ville}` : ""}`,
    `Secteur : ${input.sector ?? "n.d."}`,
    input.dirigeant_nom ? `Dirigeant : ${input.dirigeant_nom}${input.dirigeant_titre ? `, ${input.dirigeant_titre}` : ""}` : "",
    input.description ? `Description interne : ${input.description}` : "",
    input.executive_summary ? `Pitch screening : ${input.executive_summary}` : "",
    input.motivation_narrative ? `Motivation de la cession : ${input.motivation_narrative}` : "",
    input.market_context ? `Contexte de marché : ${input.market_context}` : "",
    input.competitive_landscape ? `Paysage concurrentiel : ${input.competitive_landscape}` : "",
    input.synthese_fiche ? `Synthèse 360 :\n${input.synthese_fiche}` : "",
    input.key_differentiators?.length ? `Différenciateurs : ${input.key_differentiators.join(" · ")}` : "",
    input.key_risks?.length ? `Risques identifiés au screening : ${input.key_risks.join(" · ")}` : "",
    reels.length ? `Exercices réels :\n${reels.map(finLine).join("\n")}` : "Exercices réels : non disponibles",
    projections.length ? `Projections (à présenter comme telles) :\n${projections.map(finLine).join("\n")}` : "",
    `Contexte de l'opération : ${input.deal_context ?? "non précisé"}`,
    `Cession partielle acceptée : ${input.partial_sale_ok == null ? "n.d." : input.partial_sale_ok ? "oui" : "non, cession totale"}`,
    `Le management reste : ${input.management_retention == null ? "n.d." : input.management_retention ? "oui" : "non"}`,
    "",
    "Génère l'Information Memorandum via l'outil render_im.",
  ].filter(Boolean).join("\n");
}

/** Validation structurelle de la sortie du modèle. */
export function validateIMContent(raw: unknown): IMContent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const requiredStr = ["titre", "resume", "societe_historique", "activite_modele", "marche_position", "finances_commentees", "management_organisation", "operation_envisagee"] as const;
  for (const k of requiredStr) if (!str(r[k])) return null;
  const chiffres = Array.isArray(r.chiffres_cles)
    ? r.chiffres_cles.filter((c): c is { label: string; valeur: string } =>
        typeof c === "object" && c !== null && str((c as Record<string, unknown>).label) && str((c as Record<string, unknown>).valeur))
    : [];
  const forces = Array.isArray(r.forces) ? r.forces.filter(str) : [];
  const attention = Array.isArray(r.points_attention) ? r.points_attention.filter(str) : [];
  if (chiffres.length === 0 || forces.length === 0) return null;
  return {
    titre: (r.titre as string).trim(),
    resume: (r.resume as string).trim(),
    societe_historique: (r.societe_historique as string).trim(),
    activite_modele: (r.activite_modele as string).trim(),
    marche_position: (r.marche_position as string).trim(),
    chiffres_cles: chiffres,
    finances_commentees: (r.finances_commentees as string).trim(),
    management_organisation: (r.management_organisation as string).trim(),
    forces,
    points_attention: attention,
    operation_envisagee: (r.operation_envisagee as string).trim(),
  };
}

/** Génération complète (pas d'anonymisation : l'IM est nominatif). */
export async function generateIMContent(input: IMInput): Promise<IMContent | null> {
  if (!isClaudeConfigured()) return null;

  const res = await callClaudeRaw({
    prompt: buildIMPrompt(input),
    system: SYSTEM_PROMPT,
    maxTokens: 4000,
    tools: [IM_TOOL],
    toolChoice: { type: "tool", name: "render_im" },
  });
  if (!res.ok) return null;

  const toolUse = res.content.find((b) => b.type === "tool_use" && b.name === "render_im");
  return validateIMContent(toolUse?.input);
}
