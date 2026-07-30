/**
 * lib/ai/prospect-brief.ts — Synthèse M&A d'une fiche prospect (Deal OS, B2).
 *
 * Claude, armé de la recherche web côté serveur (outil web_search de l'API
 * Messages), trouve le site du prospect et rédige la fiche client M&A :
 * activité réelle, modèle, gouvernance, tendance financière, angle
 * d'approche, points d'attention. Entrée : tout ce que l'outil sait déjà
 * (identité, finances, dirigeants, actionnariat, signaux, radar).
 *
 * L'IA propose, l'utilisateur contrôle : la sortie est un JSON strict
 * (site + synthèse en texte), parsé avec tolérance, null si invalide.
 * Coût : ~2-3 recherches web + tokens Sonnet par fiche (quelques centimes).
 */

import { callClaudeRaw, isClaudeConfigured } from "@/lib/ai/anthropic";

export interface ProspectBriefInput {
  nom: string;
  siren: string;
  naf: string | null;
  secteur: string | null;
  ville: string | null;
  departement: string | null;
  date_creation: string | null;
  effectif_label: string | null;
  finances: Record<string, {
    ca?: number | null; resultat_net?: number | null; ebitda?: number | null;
    dettes_financieres?: number | null; tresorerie?: number | null;
  }>;
  dirigeants: Array<{ nom: string | null; prenoms: string | null; qualite: string | null }>;
  actionnariat: Array<{ nom: string; prenom: string | null; age: number | null; pourcentage_parts: number | null }> | null;
  cedabilite_raisons: string[] | null;
  signaux: Array<{ signal_type: string; signal_date: string; titre: string }>;
}

export interface ProspectBrief {
  website: string | null;
  synthese: string;
}

const SYSTEM_PROMPT = `Tu es analyste M&A small cap dans une boutique française (Vectis Finance). Tu prépares des fiches prospect pour un banquier d'affaires qui cible des cédants potentiels.

Ta mission : à partir des données fournies ET d'une recherche web (2-3 recherches maximum : site officiel, activité, actualité), rédiger la synthèse M&A de l'entreprise.

Règles de rédaction :
- Français sobre et direct, jamais alarmiste, pas de superlatifs
- Pas de tiret cadratin, utiliser virgule ou point
- Uniquement des faits sourcés (données fournies ou trouvées en ligne), jamais d'invention : si une information manque, l'écrire
- 10 à 15 lignes maximum, structurées en courts paragraphes titrés : Activité / Gouvernance et capital / Finances / Angle M&A

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{"website": "https://... ou null si introuvable", "synthese": "le texte de la synthèse avec \\n entre paragraphes"}`;

function fmtM(n: number | null | undefined): string {
  if (n == null) return "n.d.";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M EUR`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k EUR`;
  return `${n} EUR`;
}

export function buildProspectPrompt(input: ProspectBriefInput): string {
  const years = Object.keys(input.finances ?? {}).sort().reverse().slice(0, 3);
  const finLines = years.map((y) => {
    const f = input.finances[y] ?? {};
    return `  ${y} : CA ${fmtM(f.ca)}, RN ${fmtM(f.resultat_net)}${f.ebitda != null ? `, EBITDA ${fmtM(f.ebitda)}` : ""}${f.dettes_financieres != null ? `, dettes fi. ${fmtM(f.dettes_financieres)}` : ""}`;
  });
  const dirLines = (input.dirigeants ?? []).slice(0, 5).map(
    (d) => `  ${[d.prenoms, d.nom].filter(Boolean).join(" ")}${d.qualite ? ` (${d.qualite})` : ""}`,
  );
  const actLines = (input.actionnariat ?? []).map(
    (a) => `  ${[a.prenom, a.nom].filter(Boolean).join(" ")} : ${a.pourcentage_parts ?? "?"}%${a.age != null ? `, ${a.age} ans` : ""}`,
  );
  const sigLines = (input.signaux ?? []).slice(0, 5).map(
    (s) => `  ${s.signal_date} ${s.signal_type} : ${s.titre}`,
  );

  return [
    `Entreprise : ${input.nom} (SIREN ${input.siren})`,
    `Code NAF : ${input.naf ?? "n.d."} · Secteur estimé : ${input.secteur ?? "n.d."}`,
    `Localisation : ${input.ville ?? "n.d."}${input.departement ? ` (${input.departement})` : ""}`,
    `Création : ${input.date_creation ?? "n.d."} · Effectif : ${input.effectif_label ?? "n.d."}`,
    finLines.length ? `Finances publiées :\n${finLines.join("\n")}` : "Finances publiées : aucune",
    dirLines.length ? `Dirigeants :\n${dirLines.join("\n")}` : "Dirigeants : non renseignés",
    actLines.length ? `Actionnariat (bénéficiaires effectifs) :\n${actLines.join("\n")}` : "Actionnariat : non disponible",
    input.cedabilite_raisons?.length ? `Lecture du radar de cédabilité :\n  ${input.cedabilite_raisons.join("\n  ")}` : "",
    sigLines.length ? `Signaux BODACC récents :\n${sigLines.join("\n")}` : "",
    "",
    "Cherche le site officiel et l'activité réelle de cette entreprise, puis rédige la synthèse M&A au format JSON demandé.",
  ].filter(Boolean).join("\n");
}

/** Parse tolérant de la réponse (JSON nu ou entouré de code fences). */
export function parseProspectBrief(raw: string): ProspectBrief | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.synthese !== "string" || parsed.synthese.trim().length < 40) return null;
    const website = typeof parsed.website === "string" && /^https?:\/\//.test(parsed.website)
      ? parsed.website.trim()
      : null;
    return { website, synthese: parsed.synthese.trim() };
  } catch {
    return null;
  }
}

/**
 * Génère la synthèse avec recherche web. Retourne null si l'IA n'est pas
 * configurée ou si la réponse est inexploitable (l'appelant affiche un
 * message, le CRM continue).
 */
export async function generateProspectBrief(input: ProspectBriefInput): Promise<ProspectBrief | null> {
  if (!isClaudeConfigured()) return null;

  const res = await callClaudeRaw({
    prompt: buildProspectPrompt(input),
    system: SYSTEM_PROMPT,
    maxTokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  });
  if (!res.ok) return null;

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) return null;
  return parseProspectBrief(text);
}
