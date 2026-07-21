/**
 * Analyse IA financière d'un dossier M&A.
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

import { formatBenchmarkForPrompt } from "@/lib/crm/financial-benchmarks";

export interface FinancialYear {
  fiscal_year: number;
  revenue: number | null;
  gross_margin: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  ebitda_normative: number | null;
  ebitda_normative_margin: number | null;
  addbacks_total: number | null;
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
  deal_type: string;          // ma_sell | ma_buy
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
  anomalies: string[];               // 0 à 5 anomalies détectées
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
    if (y.ebitda !== null) rows.push(`  EBITDA reporté: ${y.ebitda.toLocaleString("fr-FR")} ${c}`);
    if (y.ebitda_margin !== null) rows.push(`  Marge EBITDA reportée: ${y.ebitda_margin}%`);
    if (y.addbacks_total !== null && y.addbacks_total !== 0) rows.push(`  Σ retraitements normatifs: ${y.addbacks_total.toLocaleString("fr-FR")} ${c}`);
    if (y.ebitda_normative !== null) rows.push(`  EBITDA normatif: ${y.ebitda_normative.toLocaleString("fr-FR")} ${c}`);
    if (y.ebitda_normative_margin !== null) rows.push(`  Marge EBITDA normative: ${y.ebitda_normative_margin}%`);
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

  // CA de l'année la plus récente pour calibrer la décote PME
  const latestRevenue = input.years.length > 0 ? input.years[0].revenue : null;
  const benchmarkBlock = formatBenchmarkForPrompt(input.sector, latestRevenue);

  return `Tu es un analyste financier M&A senior pour un cabinet de conseil PME France. Évalue la performance financière de ce dossier selon 4 critères, chacun noté sur 25 points :

1. CROISSANCE REVENUE (0-25) : évolution YoY du chiffre d'affaires. +30% YoY soutenu = 20-25. Stagnation = 5-10. Décroissance = 0-5.
2. MARGE EBITDA (0-25) : niveau et évolution de la rentabilité. Si l'EBITDA normatif est fourni, raisonne sur lui (capacité bénéficiaire récurrente). Compare au benchmark sectoriel ci-dessous.
3. BILAN (0-25) : solidité financière. Cash > dette nette, equity positif = 20-25. Dette nette / EBITDA > LBO max sectoriel = 0-5.
4. COMPARABLES (0-25) : positionnement vs multiples sectoriels. Note 20-25 si la valeur calculée est cohérente avec la fourchette du secteur, plus bas sinon.

${benchmarkBlock}

RÈGLES IMPÉRATIVES DE VALORISATION — à respecter strictement :
- Utilise UNIQUEMENT les multiples APRÈS DÉCOTE fournis ci-dessus. N'invente JAMAIS d'autres multiples.
- Méthode principale : EV = EBITDA normatif (ou reporté si normatif absent) × multiple EV/EBITDA "après décote".
  • valuation_low  = EBITDA × multiple bas après décote
  • valuation_high = EBITDA × multiple haut après décote
- Si l'EBITDA est négatif ou ≤ 0 : utilise EV = Revenue × multiple EV/Revenue après décote.
- Si la marge EBITDA dépasse la borne haute sectorielle de plus de 50 % (ex: 30 % en transport), c'est probablement une donnée erronée : signale-le dans "notes" et reste sur la borne haute.
- Plafond de sécurité : la valorisation ne doit JAMAIS dépasser 5 fois le chiffre d'affaires de l'année N, sauf pour SaaS/Cybersécurité/Marketplace/Deeptech.
- Tu DOIS vérifier mentalement la cohérence : pour une PME à 600k€ CA en Transport, une valo de 4M€ EV serait aberrante (EV/EBITDA ~50x au lieu de 4-6x).

Contexte du dossier :
- Nom : ${input.deal_name}
- Type : ${input.deal_type}
- Secteur : ${sector}
- Stade : ${stage}
- Devise : ${c}
- CA dernière année (pour calibrage décote) : ${latestRevenue != null ? latestRevenue.toLocaleString("fr-FR") + " " + c : "non disponible"}

Données financières (du plus récent au plus ancien) :

${yearsBlock}

DÉTECTION D'ANOMALIES — liste obligatoire (peut être vide) :
- EBITDA en croissance >300 % YoY → "EBITDA +Xx % YoY, vérifier la saisie"
- Marge brute > 90 % en industrie / transport / retail → "Marge brute Y % incohérente avec le secteur"
- Marge EBITDA > 50 % hors SaaS → "Marge EBITDA Z % anormalement élevée pour le secteur"
- revenue_recurring > revenue → "Récurrent supérieur au CA total"
- Dette nette / EBITDA > LBO max sectoriel → "Endettement supérieur au plafond LBO"
- Equity négatif → "Capitaux propres négatifs, signal de fragilité"
- Variation YoY > 100 % sur EBITDA sans variation revenue → "Évolution EBITDA incohérente avec revenue"

Réponds EXCLUSIVEMENT avec un bloc JSON valide au format suivant, sans aucun texte avant ou après :

{
  "score": <total 0-100>,
  "valuation_low": <nombre en ${c}, jamais null si on a un revenue ou un EBITDA>,
  "valuation_high": <nombre en ${c}>,
  "notes": "<6 à 8 phrases en français : 1) explicite le multiple et la métrique utilisés pour la valo, 2) points forts, 3) points d'attention, 4) anomalies si EBITDA aberrant, 5) recommandation>",
  "breakdown": {
    "growth": <0-25>,
    "margin": <0-25>,
    "balance": <0-25>,
    "comparables": <0-25>
  },
  "anomalies": [<liste de 0 à 5 anomalies détectées, chacune en 1 phrase courte française>]
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
  // anomalies : tolérant — accepte tableau de strings ou absent (→ tableau vide)
  if (o.anomalies !== undefined && !Array.isArray(o.anomalies)) return false;
  if (Array.isArray(o.anomalies)) {
    const allStrings = o.anomalies.every(a => typeof a === "string");
    if (!allStrings) return false;
  }
  // Normaliser anomalies à [] si absent
  if (o.anomalies === undefined) o.anomalies = [];
  return true;
}
