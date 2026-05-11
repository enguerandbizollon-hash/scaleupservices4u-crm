/**
 * Brief Engine — génération IA des champs narratifs du screening dossier (V53d).
 *
 * Alimente le Module 1 (Screening qualifié) en proposant automatiquement
 * un pitch exécutif, une motivation, des différenciateurs, des risques, un
 * contexte concurrence et un contexte marché à partir :
 *   - des champs déjà saisis sur le dossier (name, description, sector, etc.)
 *   - des ai_summary des documents attachés (teasers, IM, BP, decks — calculés
 *     en V50 par lib/ai/presentation-analysis.ts et document-extraction.ts)
 *   - d'un snapshot financier (dernière année disponible dans financial_data)
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 * Appel : fetch direct API Anthropic, pattern cohérent avec
 * lib/ai/financial-scoring.ts et lib/ai/action-summary.ts.
 *
 * L'IA suggère, l'utilisateur valide. Aucun champ déjà rempli n'est
 * écrasé sans action explicite (la modale côté UI gère le choix).
 */

export interface BriefDocumentSummary {
  document_type: string;
  file_name: string;
  ai_summary: string | null;
}

export interface BriefFinancialSnapshot {
  fiscal_year: number;
  revenue: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  arr: number | null;
  nrr: number | null;
  headcount: number | null;
  currency: string;
}

export interface ScreeningBriefInput {
  deal_name: string;
  deal_type: string;
  sector: string | null;
  description: string | null;
  strategic_rationale: string | null;
  use_of_funds: string | null;
  company_stage: string | null;
  target_raise_amount: number | null;
  asking_price_min: number | null;
  asking_price_max: number | null;
  currency: string;
  documents: BriefDocumentSummary[];
  financial: BriefFinancialSnapshot | null;
}

export interface ScreeningBriefSuggestion {
  executive_summary: string;
  motivation_narrative: string;
  competitive_landscape: string;
  market_context: string;
  key_differentiators: string[];
  key_risks: string[];
  confidence: number;       // 0-100, estimation interne de qualité
  notes: string | null;     // avertissements éventuels (peu de données, etc.)
}

const SYSTEM_PROMPT = `Tu es analyste senior en M&A et fundraising. Tu produis des brouillons de qualification de dossier, sobres et factuels, basés uniquement sur les informations fournies.

Règles impératives :
- Langue : français professionnel, ton sobre, jamais alarmiste, pas de superlatifs gratuits.
- Jamais d'invention : si une information manque, formule-le honnêtement ("à préciser", "information non disponible").
- Pas de tiret cadratin (—) dans les textes, utilise virgule ou point.
- Pas de markdown dans les valeurs (pas de **gras**, pas de listes à puces dans les champs texte).
- Pour les champs liste (différenciateurs, risques), chaque élément est une phrase courte, complète, autonome.
- Tu réponds uniquement par un objet JSON valide, sans texte hors JSON, sans backticks.`;

function formatAmount(n: number | null | undefined, currency: string): string {
  if (n == null) return "non renseigné";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

function buildUserPrompt(input: ScreeningBriefInput): string {
  const parts: string[] = [];
  parts.push(`Dossier : ${input.deal_name}`);
  parts.push(`Type de mission : ${input.deal_type}`);
  if (input.sector) parts.push(`Secteur : ${input.sector}`);
  if (input.company_stage) parts.push(`Stade : ${input.company_stage}`);
  parts.push(`Devise : ${input.currency}`);

  if (input.description && input.description.trim()) {
    parts.push(`\nDescription existante :\n${input.description}`);
  }
  if (input.strategic_rationale && input.strategic_rationale.trim()) {
    parts.push(`\nRationale stratégique (M&A) :\n${input.strategic_rationale}`);
  }
  if (input.use_of_funds && input.use_of_funds.trim()) {
    parts.push(`\nUse of funds (fundraising) :\n${input.use_of_funds}`);
  }
  if (input.target_raise_amount) {
    parts.push(`Montant recherché : ${formatAmount(input.target_raise_amount, input.currency)}`);
  }
  if (input.asking_price_min || input.asking_price_max) {
    const range = `${formatAmount(input.asking_price_min, input.currency)} à ${formatAmount(input.asking_price_max, input.currency)}`;
    parts.push(`Fourchette de prix demandée : ${range}`);
  }

  if (input.financial) {
    const f = input.financial;
    const lines: string[] = [`\nDernier exercice disponible (${f.fiscal_year}) :`];
    if (f.revenue != null) lines.push(`- Revenue : ${formatAmount(f.revenue, f.currency)}`);
    if (f.ebitda != null) lines.push(`- EBITDA : ${formatAmount(f.ebitda, f.currency)}`);
    if (f.ebitda_margin != null) lines.push(`- Marge EBITDA : ${f.ebitda_margin}%`);
    if (f.arr != null) lines.push(`- ARR : ${formatAmount(f.arr, f.currency)}`);
    if (f.nrr != null) lines.push(`- NRR : ${f.nrr}%`);
    if (f.headcount != null) lines.push(`- Effectifs : ${f.headcount}`);
    if (lines.length > 1) parts.push(lines.join("\n"));
  }

  if (input.documents.length > 0) {
    parts.push(`\nDocuments attachés et résumés IA disponibles :`);
    for (const doc of input.documents) {
      if (doc.ai_summary && doc.ai_summary.trim()) {
        parts.push(`[${doc.document_type}] ${doc.file_name} :\n${doc.ai_summary.trim()}`);
      }
    }
  }

  parts.push(`
Objectif : générer un brouillon de screening qualifié. Voici la structure JSON attendue, strictement :

{
  "executive_summary": "Pitch 3 à 5 phrases, 300 à 500 caractères, lisible par un tiers qui ne connaît pas la société.",
  "motivation_narrative": "2 à 4 phrases expliquant pourquoi cette opération maintenant : déclencheur, urgence, contexte décisionnel.",
  "competitive_landscape": "2 à 4 phrases sur les principaux concurrents identifiables et le positionnement relatif de la société.",
  "market_context": "2 à 4 phrases sur la dynamique du secteur, les tendances, la fenêtre d'opportunité.",
  "key_differentiators": ["différenciateur 1 en une phrase", "différenciateur 2 en une phrase", "différenciateur 3 si applicable"],
  "key_risks": ["risque 1 en une phrase", "risque 2 si applicable"],
  "confidence": 0-100,
  "notes": "Avertissement si le matériel est insuffisant, ou null sinon."
}

Si un champ ne peut pas être rempli faute d'information, mets une chaîne vide (ou tableau vide) plutôt que d'inventer. Baisse le score de confiance en conséquence.`);

  return parts.join("\n");
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseResponse(raw: string): ScreeningBriefSuggestion | null {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;

    const result: ScreeningBriefSuggestion = {
      executive_summary: typeof parsed.executive_summary === "string" ? parsed.executive_summary : "",
      motivation_narrative: typeof parsed.motivation_narrative === "string" ? parsed.motivation_narrative : "",
      competitive_landscape: typeof parsed.competitive_landscape === "string" ? parsed.competitive_landscape : "",
      market_context: typeof parsed.market_context === "string" ? parsed.market_context : "",
      key_differentiators: Array.isArray(parsed.key_differentiators)
        ? parsed.key_differentiators.filter((v: unknown): v is string => typeof v === "string")
        : [],
      key_risks: Array.isArray(parsed.key_risks)
        ? parsed.key_risks.filter((v: unknown): v is string => typeof v === "string")
        : [],
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 0,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
    };
    return result;
  } catch {
    return null;
  }
}

// Retourne null si clé API absente, appel LLM en échec, ou JSON malformé.
// L'appelant décide d'afficher un message.
export async function generateScreeningBrief(
  input: ScreeningBriefInput,
): Promise<ScreeningBriefSuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userPrompt = buildUserPrompt(input);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string") return null;

    return parseResponse(text);
  } catch {
    return null;
  }
}
