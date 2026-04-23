/**
 * Analyse IA financière d'un dossier M&A / Fundraising.
 *
 * Consomme : données financières N, N-1, N-2 (table financial_data) +
 * contexte deal (secteur, type, devise).
 *
 * Produit : score 0-100 selon 4 critères (CLAUDE.md §Matching M&A),
 * fourchette valorisation, notes narratives.
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 * Appel : fetch direct vers l'API Anthropic (pattern cohérent avec
 * lib/ai/action-summary.ts).
 */

export interface FinancialYear {
  fiscal_year: number;
  revenue: number | null;
  gross_margin: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  net_debt: number | null;
  equity: number | null;
  cash: number | null;
  headcount: number | null;
  arr: number | null;
  mrr: number | null;
  nrr: number | null;
  churn_rate: number | null;
}

export interface FinancialScoringInput {
  deal_name: string;
  deal_type: string;          // fundraising | ma_sell | ma_buy | cfo_advisor
  sector: string | null;
  currency: string;           // EUR | CHF | USD | GBP
  company_stage: string | null;
  years: FinancialYear[];     // triées N le plus récent → N-2
}

export interface FinancialScoringBreakdown {
  growth: number;        // 0-25
  margin: number;        // 0-25
  balance: number;       // 0-25
  comparables: number;   // 0-25
}

export interface FinancialScoringResult {
  score: number;                     // 0-100 (somme du breakdown)
  valuation_low: number | null;      // fourchette basse (devise native)
  valuation_high: number | null;     // fourchette haute
  notes: string;                     // narratif 4-8 lignes
  breakdown: FinancialScoringBreakdown;
}

/**
 * Retourne null si l'API n'est pas configurée, le LLM échoue, ou le JSON
 * de réponse est malformé. L'appelant décide d'afficher un warning.
 */
export async function analyzeDealFinancials(
  input: FinancialScoringInput,
): Promise<FinancialScoringResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (input.years.length === 0) return null;

  const prompt = buildPrompt(input);

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
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json.content?.[0]?.text;
    if (typeof text !== "string") return null;

    return parseResult(text);
  } catch {
    return null;
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(input: FinancialScoringInput): string {
  const c = input.currency;
  const yearsBlock = input.years.map(y => {
    const rows: string[] = [`Exercice ${y.fiscal_year}`];
    if (y.revenue !== null) rows.push(`  Revenue: ${y.revenue.toLocaleString("fr-FR")} ${c}`);
    if (y.gross_margin !== null) rows.push(`  Marge brute: ${y.gross_margin}%`);
    if (y.ebitda !== null) rows.push(`  EBITDA: ${y.ebitda.toLocaleString("fr-FR")} ${c}`);
    if (y.ebitda_margin !== null) rows.push(`  Marge EBITDA: ${y.ebitda_margin}%`);
    if (y.net_debt !== null) rows.push(`  Dette nette: ${y.net_debt.toLocaleString("fr-FR")} ${c}`);
    if (y.equity !== null) rows.push(`  Fonds propres: ${y.equity.toLocaleString("fr-FR")} ${c}`);
    if (y.cash !== null) rows.push(`  Trésorerie: ${y.cash.toLocaleString("fr-FR")} ${c}`);
    if (y.headcount !== null) rows.push(`  Effectif: ${y.headcount}`);
    if (y.arr !== null) rows.push(`  ARR: ${y.arr.toLocaleString("fr-FR")} ${c}`);
    if (y.mrr !== null) rows.push(`  MRR: ${y.mrr.toLocaleString("fr-FR")} ${c}`);
    if (y.nrr !== null) rows.push(`  NRR: ${y.nrr}%`);
    if (y.churn_rate !== null) rows.push(`  Churn: ${y.churn_rate}%`);
    return rows.join("\n");
  }).join("\n\n");

  const sector = input.sector ?? "non précisé";
  const stage = input.company_stage ?? "non précisé";

  return `Tu es un analyste financier M&A senior pour un cabinet de conseil. Évalue la performance financière de ce dossier selon 4 critères, chacun noté sur 25 points :

1. CROISSANCE REVENUE (0-25) : évolution YoY du chiffre d'affaires. +30% YoY soutenu = 20-25. Stagnation = 5-10. Décroissance = 0-5.
2. MARGE EBITDA (0-25) : niveau et évolution de la rentabilité. >20% en SaaS ou >10% en industrie = 20-25. Marge négative = 0-5.
3. BILAN (0-25) : solidité financière. Cash > dette nette, equity positif, working capital sain = 20-25. Sur-endettement = 0-5.
4. COMPARABLES (0-25) : positionnement vs multiples sectoriels. Applique les multiples EV/Revenue et EV/EBITDA du secteur (${sector}) pour produire une fourchette de valorisation réaliste.

Contexte du dossier :
- Nom : ${input.deal_name}
- Type : ${input.deal_type}
- Secteur : ${sector}
- Stade : ${stage}
- Devise : ${c}

Données financières (du plus récent au plus ancien) :

${yearsBlock}

Réponds EXCLUSIVEMENT avec un bloc JSON valide au format suivant, sans aucun texte avant ou après :

{
  "score": <total 0-100>,
  "valuation_low": <nombre en ${c} ou null si impossible>,
  "valuation_high": <nombre en ${c} ou null si impossible>,
  "notes": "<4 à 8 phrases en français : points forts, points d'attention, hypothèses de valorisation, recommandations>",
  "breakdown": {
    "growth": <0-25>,
    "margin": <0-25>,
    "balance": <0-25>,
    "comparables": <0-25>
  }
}`;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function parseResult(text: string): FinancialScoringResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!isValidResult(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidResult(v: unknown): v is FinancialScoringResult {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!isNum(o.score)) return false;
  if (o.valuation_low !== null && !isNum(o.valuation_low)) return false;
  if (o.valuation_high !== null && !isNum(o.valuation_high)) return false;
  if (typeof o.notes !== "string") return false;
  const b = o.breakdown;
  if (!b || typeof b !== "object") return false;
  const bo = b as Record<string, unknown>;
  if (!isNum(bo.growth) || !isNum(bo.margin) || !isNum(bo.balance) || !isNum(bo.comparables)) return false;
  return true;
}
