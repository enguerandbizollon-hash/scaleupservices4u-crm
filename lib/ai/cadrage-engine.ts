/**
 * lib/ai/cadrage-engine.ts — Extraction IA d'une fiche de cadrage buy-side.
 *
 * Le repreneur (client acquéreur) fournit un brief de recherche : secteurs
 * et codes NAF, fourchette de CA, géographie, âge du dirigeant recherché,
 * conditions (achat de titres, majoritaire, accompagnement), apport. L'IA
 * l'extrait du PDF (content block « document », support PDF natif de Claude,
 * comme lib/ai/document-extraction.ts) vers une sortie structurée.
 *
 * UNIQUEMENT des faits de la fiche : un critère absent reste null/vide, il ne
 * s'invente pas. Le mapping vers les critères du dossier et les filtres de
 * chasse est PUR et testable dans lib/crm/cadrage-map.ts.
 */

import { callClaudeRaw, isClaudeConfigured } from "@/lib/ai/anthropic";

export interface CadrageContent {
  repreneur_nom: string | null;
  projet: string | null;                 // résumé du projet de reprise
  secteurs: string[];                     // libellés secteurs recherchés
  naf_codes: string[];                    // codes NAF complets ("62.02A")
  ca_min: number | null;                  // CA cible en EUR
  ca_max: number | null;
  effectif_min: number | null;
  effectif_max: number | null;
  departements: string[];                 // codes ("38", "69")
  regions: string[];                      // libellés région si donnés
  dirigeant_age_min: number | null;
  dirigeant_age_max: number | null;
  full_acquisition: boolean | null;       // majoritaire / titres à 100 %
  management_retention: boolean | null;   // accompagnement / cédant reste
  apport: number | null;                  // apport / capacité en EUR
  confidence: number;                     // 0-100
}

const CADRAGE_TOOL = {
  name: "extract_cadrage",
  description: "Extrait les critères de recherche d'une fiche de cadrage de repreneur (buy-side M&A). Chaque critère est optionnel : renseigne uniquement ce qui figure dans la fiche.",
  input_schema: {
    type: "object",
    properties: {
      repreneur_nom: { type: ["string", "null"], description: "Nom du repreneur / porteur du projet si identifiable." },
      projet: { type: ["string", "null"], description: "Résumé du projet de reprise en 1-2 phrases factuelles." },
      secteurs: { type: "array", items: { type: "string" }, description: "Libellés des secteurs recherchés (ex : « Agence digitale », « Génie climatique »)." },
      naf_codes: { type: "array", items: { type: "string" }, description: "Codes NAF complets cités (ex : « 62.02A », « 43.22B »). Format XX.XXY." },
      ca_min: { type: ["number", "null"], description: "Chiffre d'affaires cible minimum en EUR (500K€ => 500000)." },
      ca_max: { type: ["number", "null"], description: "Chiffre d'affaires cible maximum en EUR (1,5 M€ => 1500000)." },
      effectif_min: { type: ["integer", "null"], description: "Effectif minimum recherché." },
      effectif_max: { type: ["integer", "null"], description: "Effectif maximum recherché." },
      departements: { type: "array", items: { type: "string" }, description: "Codes de département visés (ex : « 38 », « 69 »). Déduis-les des localisations citées." },
      regions: { type: "array", items: { type: "string" }, description: "Régions citées si présentes (ex : « Auvergne-Rhône-Alpes »)." },
      dirigeant_age_min: { type: ["integer", "null"], description: "Âge minimum du dirigeant cible si mentionné (ex : cédant proche de la retraite)." },
      dirigeant_age_max: { type: ["integer", "null"], description: "Âge maximum du dirigeant cible si mentionné." },
      full_acquisition: { type: ["boolean", "null"], description: "true si prise de participation totale ou majoritaire / achat de 100 % des titres ; false si minoritaire assumé ; null si non précisé." },
      management_retention: { type: ["boolean", "null"], description: "true si accompagnement du cédant souhaité / management en place à conserver ; null si non précisé." },
      apport: { type: ["number", "null"], description: "Apport personnel ou capacité d'investissement en EUR (300k => 300000)." },
      confidence: { type: "integer", description: "Confiance globale dans l'extraction (0-100)." },
    },
    required: ["secteurs", "naf_codes", "confidence"],
  },
} as const;

const SYSTEM_PROMPT = `Tu es analyste M&A. Tu lis une FICHE DE CADRAGE d'un repreneur (client acquéreur) et tu en extrais les critères de recherche de cible.

Règles impératives :
- UNIQUEMENT des faits de la fiche, jamais d'invention. Un critère absent reste null (ou tableau vide).
- Montants en EUR sans abréviation : « 1,5 M€ » => 1500000, « 500K » => 500000, « 300k » => 300000.
- Codes NAF au format XX.XXY (ex : 62.02A). Recopie-les tels quels.
- Départements : déduis les codes (« Isère » => 38, « Rhône » => 69, « Vienne/Bourgoin-Jallieu » => 38).
- full_acquisition = true pour « achat de titres », « participation totale », « majoritaire », « ultra-majoritaire ».
- management_retention = true pour « accompagnement du cédant », « manager en place à conserver ».
- Français sobre, pas de tiret cadratin. Appelle l'outil extract_cadrage une seule fois.`;

export interface ExtractCadrageResult {
  ok: boolean;
  data?: CadrageContent;
  error?: string;
}

/** Extrait la fiche de cadrage d'un PDF. Échec explicite si clé absente / PDF trop lourd / réponse mal formée. */
export async function extractCadrageFromPdf(input: { pdfBuffer: Buffer; contextHint?: string }): Promise<ExtractCadrageResult> {
  if (!isClaudeConfigured()) return { ok: false, error: "ANTHROPIC_API_KEY manquante" };
  if (input.pdfBuffer.length > 30 * 1024 * 1024) {
    return { ok: false, error: "PDF trop volumineux (> 30 MB), limite Anthropic 32 MB" };
  }

  const base64Pdf = input.pdfBuffer.toString("base64");
  const userMessage = input.contextHint
    ? `Contexte : ${input.contextHint}\n\nExtrais la fiche de cadrage via l'outil extract_cadrage.`
    : `Extrais la fiche de cadrage via l'outil extract_cadrage.`;

  const res = await callClaudeRaw({
    maxTokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [CADRAGE_TOOL],
    toolChoice: { type: "tool", name: "extract_cadrage" },
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
      { type: "text", text: userMessage },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };
  const toolUse = res.content.find((c) => c.type === "tool_use" && c.name === "extract_cadrage");
  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    return { ok: false, error: "Pas de tool_use dans la réponse" };
  }
  return { ok: true, data: validateCadrageContent(toolUse.input as Record<string, unknown>) };
}

// ── Sanitisation (pure, testable) ────────────────────────────────────────────

function isNum(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }
function numOrNull(v: unknown): number | null { return isNum(v) ? v : null; }
function intOrNull(v: unknown): number | null { return isNum(v) ? Math.round(v) : null; }
function boolOrNull(v: unknown): boolean | null { return typeof v === "boolean" ? v : null; }
function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()))].slice(0, max);
}

/** Normalise et borne la sortie du modèle. Export pour tests. */
export function validateCadrageContent(raw: Record<string, unknown>): CadrageContent {
  const conf = raw.confidence;
  return {
    repreneur_nom: str(raw.repreneur_nom),
    projet: str(raw.projet),
    secteurs: strArr(raw.secteurs, 12),
    naf_codes: [...new Set(strArr(raw.naf_codes, 20).map((c) => c.toUpperCase().replace(/\s/g, "")))],
    ca_min: numOrNull(raw.ca_min),
    ca_max: numOrNull(raw.ca_max),
    effectif_min: intOrNull(raw.effectif_min),
    effectif_max: intOrNull(raw.effectif_max),
    departements: strArr(raw.departements, 30),
    regions: strArr(raw.regions, 20),
    dirigeant_age_min: intOrNull(raw.dirigeant_age_min),
    dirigeant_age_max: intOrNull(raw.dirigeant_age_max),
    full_acquisition: boolOrNull(raw.full_acquisition),
    management_retention: boolOrNull(raw.management_retention),
    apport: numOrNull(raw.apport),
    confidence: isNum(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : 0,
  };
}
