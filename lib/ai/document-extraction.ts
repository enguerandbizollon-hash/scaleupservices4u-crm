/**
 * lib/ai/document-extraction.ts — Extraction IA depuis PDF (V58)
 *
 * Encode un PDF en base64 et l'envoie à l'API Anthropic via un content
 * block `type: "document"` (support natif Claude Sonnet 4 pour PDF).
 *
 * Utilise tool_use avec un schéma JSON unifié pour récupérer une sortie
 * structurée. Tous les champs sont nullable : l'IA remplit ce qu'elle
 * voit dans le document, le reste reste null.
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 *
 * Limites côté Anthropic :
 *  - PDF max 32 MB
 *  - 100 pages max
 *  - Le PDF doit être un PDF natif (pas un PDF-image illisible)
 */

// ── Schéma de sortie unifié (financial_data + métadonnées document) ──────────

export interface ExtractedFinancialYear {
  fiscal_year: number;
  currency: string | null;
  revenue: number | null;
  gross_profit: number | null;
  gross_margin: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  ebit: number | null;
  net_income: number | null;
  total_assets: number | null;
  net_debt: number | null;
  equity: number | null;
  cash: number | null;
  revenue_growth: number | null;
  ebitda_growth: number | null;
  headcount: number | null;
  arr: number | null;
  mrr: number | null;
  nrr: number | null;
  churn_rate: number | null;
  ltv: number | null;
  cac: number | null;
  // Retraitements EBITDA normatif — détectés depuis le doc si mentionnés
  // (charges exceptionnelles, rémunération dirigeant excédentaire, etc.)
  addback_owner_compensation: number | null;
  addback_exceptional_charges: number | null;
  addback_property_rent: number | null;
  addback_one_off_fees: number | null;
  addback_other: number | null;
  addback_notes: string | null;
}

export interface ExtractedDocumentInsights {
  company_name: string | null;
  summary: string;
  sector: string | null;
  business_model: string | null;
  key_differentiators: string[];
  key_risks: string[];
  inconsistencies: string[];
  detected_document_type: string | null;
  financial_years: ExtractedFinancialYear[];
  confidence: number;
}

// Tool_use spec : Claude doit appeler ce tool avec ses extractions
const EXTRACTION_TOOL = {
  name: "extract_document_data",
  description: "Extrait les données structurées d'un document financier ou commercial (bilan, P&L, business plan, teaser, IM). Tous les champs sont optionnels — renseigne uniquement ce qui est visible dans le document.",
  input_schema: {
    type: "object",
    properties: {
      company_name: {
        type: ["string", "null"],
        description: "Nom de l'entreprise concernée si identifiable",
      },
      summary: {
        type: "string",
        description: "Résumé narratif du document en 2-4 phrases factuelles, français, sans tiret cadratin",
      },
      sector: {
        type: ["string", "null"],
        description: "Secteur d'activité principal (SaaS, Fintech, Healthtech, Industrie, etc.)",
      },
      business_model: {
        type: ["string", "null"],
        description: "Modèle économique en 1 phrase",
      },
      key_differentiators: {
        type: "array",
        items: { type: "string" },
        description: "Différenciateurs stratégiques mentionnés, max 5",
      },
      key_risks: {
        type: "array",
        items: { type: "string" },
        description: "Points d'attention ou risques mentionnés, max 5",
      },
      inconsistencies: {
        type: "array",
        items: { type: "string" },
        description: "Incohérences détectées entre données du doc, max 3",
      },
      detected_document_type: {
        type: ["string", "null"],
        description: "Type de document détecté : bilan | pl | business_plan | teaser | im | presentation | rapport | autre",
      },
      financial_years: {
        type: "array",
        description: "Données financières par exercice. Un objet par fiscal_year présent dans le document.",
        items: {
          type: "object",
          properties: {
            fiscal_year: { type: "integer", description: "Année fiscale (ex: 2024)" },
            currency: { type: ["string", "null"], description: "EUR | USD | CHF | GBP" },
            revenue: { type: ["number", "null"], description: "Chiffre d'affaires en devise native" },
            gross_profit: { type: ["number", "null"] },
            gross_margin: { type: ["number", "null"], description: "Marge brute en pourcentage (ex: 65.5)" },
            ebitda: { type: ["number", "null"] },
            ebitda_margin: { type: ["number", "null"], description: "Marge EBITDA en pourcentage" },
            ebit: { type: ["number", "null"] },
            net_income: { type: ["number", "null"] },
            total_assets: { type: ["number", "null"] },
            net_debt: { type: ["number", "null"] },
            equity: { type: ["number", "null"] },
            cash: { type: ["number", "null"] },
            revenue_growth: { type: ["number", "null"], description: "Croissance revenue en %" },
            ebitda_growth: { type: ["number", "null"] },
            headcount: { type: ["integer", "null"] },
            arr: { type: ["number", "null"] },
            mrr: { type: ["number", "null"] },
            nrr: { type: ["number", "null"], description: "Net Revenue Retention en %" },
            churn_rate: { type: ["number", "null"], description: "Churn annuel en %" },
            ltv: { type: ["number", "null"] },
            cac: { type: ["number", "null"] },
            addback_owner_compensation: { type: ["number", "null"], description: "Rémunération dirigeant excédentaire vs marché (à ajouter à l'EBITDA pour normaliser)" },
            addback_exceptional_charges: { type: ["number", "null"], description: "Charges exceptionnelles non récurrentes (litiges, restructuration, indemnités). Toujours positif si l'opération les a déduites." },
            addback_property_rent: { type: ["number", "null"], description: "Retraitement loyer marché si la société occupe un bien dont elle est propriétaire ou paye un loyer hors marché à un actionnaire" },
            addback_one_off_fees: { type: ["number", "null"], description: "Frais ponctuels non récurrents (audit M&A, conseil, intégration, due diligence)" },
            addback_other: { type: ["number", "null"], description: "Autres ajustements normatifs explicitement mentionnés (somme algébrique)" },
            addback_notes: { type: ["string", "null"], description: "Justification courte des retraitements détectés, max 200 caractères" },
          },
          required: ["fiscal_year"],
        },
      },
      confidence: {
        type: "integer",
        description: "Confiance globale dans l'extraction (0 à 100). Baisser si peu de données ou si doc difficile.",
      },
    },
    required: ["summary", "financial_years", "confidence"],
  },
} as const;

const SYSTEM_PROMPT = `Tu es analyste M&A senior. Tu extrais des données structurées de documents financiers et commerciaux (bilans, P&L, business plans, teasers M&A, IM).

Règles impératives :
- Tu te bases UNIQUEMENT sur ce qui est lisible dans le document, jamais d'invention.
- Tous les champs non renseignés dans le doc doivent rester null (ne jamais inventer).
- Les pourcentages sont retournés en valeurs numériques (ex: 65 pour 65%, pas 0.65).
- Les montants en devise native, sans conversion.
- Tu appelles le tool extract_document_data une seule fois avec ta synthèse.
- Pas de tiret cadratin dans les textes, virgule ou point.
- Français professionnel, sobre, factuel.

Retraitements EBITDA normatif (M&A) — repère activement dans le doc :
- "Rémunération dirigeant excédentaire", "salaire excessif" → addback_owner_compensation
- "Charges exceptionnelles", "non récurrentes", "litiges", "restructuration" → addback_exceptional_charges
- "Loyer marché", "propriétaire occupant", "loyer théorique" → addback_property_rent
- "Frais audit M&A", "frais de conseil ponctuels", "frais d'intégration" → addback_one_off_fees
- Autres retraitements EBITDA normatif explicitement mentionnés → addback_other (somme algébrique)
- Justifie brièvement dans addback_notes (max 200 caractères)
- Si le document ne mentionne aucun retraitement, laisse les addback_* à null (ne JAMAIS inventer).`;

// ── Appel API ────────────────────────────────────────────────────────────────

export interface ExtractDocumentInput {
  pdfBuffer: Buffer;
  contextHint?: string; // ex: "Bilan FY2024 d'Acme SAS, dossier M&A"
}

export interface ExtractDocumentResult {
  ok: boolean;
  data?: ExtractedDocumentInsights;
  error?: string;
}

/**
 * Extrait les données structurées d'un PDF. Retourne `ok: false` avec un
 * message clair si l'extraction échoue (clé absente, taille trop grande,
 * timeout réseau, réponse mal formée).
 */
export async function extractDataFromPdf(
  input: ExtractDocumentInput,
): Promise<ExtractDocumentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY manquante" };

  // Limite Anthropic : 32 MB. On garde marge à 30 MB.
  if (input.pdfBuffer.length > 30 * 1024 * 1024) {
    return { ok: false, error: "PDF trop volumineux (> 30 MB), limite Anthropic 32 MB" };
  }

  const base64Pdf = input.pdfBuffer.toString("base64");
  const userMessage = input.contextHint
    ? `Contexte : ${input.contextHint}\n\nAnalyse ce document et extrais les données via l'outil extract_document_data.`
    : `Analyse ce document et extrais les données via l'outil extract_document_data.`;

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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "extract_document_data" },
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            { type: "text", text: userMessage },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `API Anthropic ${res.status} : ${text.slice(0, 200)}` };
    }

    const data = await res.json() as {
      content?: Array<{ type: string; name?: string; input?: unknown }>;
      stop_reason?: string;
    };

    const toolUse = data.content?.find(
      (c) => c.type === "tool_use" && c.name === "extract_document_data",
    );
    if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
      return { ok: false, error: "Pas de tool_use dans la réponse" };
    }

    const parsed = sanitizeExtraction(toolUse.input as Record<string, unknown>);
    return { ok: true, data: parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau Anthropic" };
  }
}

// ── Helpers de sanitisation ──────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isString).slice(0, max);
}
function asNumberOrNull(v: unknown): number | null {
  return isNumber(v) ? v : null;
}
function asStringOrNull(v: unknown): string | null {
  return isString(v) && v.trim() ? v.trim() : null;
}

function sanitizeFinancialYear(raw: unknown): ExtractedFinancialYear | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const fy = r.fiscal_year;
  if (!isNumber(fy) || fy < 1900 || fy > 2100) return null;

  return {
    fiscal_year: Math.round(fy),
    currency: asStringOrNull(r.currency),
    revenue: asNumberOrNull(r.revenue),
    gross_profit: asNumberOrNull(r.gross_profit),
    gross_margin: asNumberOrNull(r.gross_margin),
    ebitda: asNumberOrNull(r.ebitda),
    ebitda_margin: asNumberOrNull(r.ebitda_margin),
    ebit: asNumberOrNull(r.ebit),
    net_income: asNumberOrNull(r.net_income),
    total_assets: asNumberOrNull(r.total_assets),
    net_debt: asNumberOrNull(r.net_debt),
    equity: asNumberOrNull(r.equity),
    cash: asNumberOrNull(r.cash),
    revenue_growth: asNumberOrNull(r.revenue_growth),
    ebitda_growth: asNumberOrNull(r.ebitda_growth),
    headcount: isNumber(r.headcount) ? Math.round(r.headcount) : null,
    arr: asNumberOrNull(r.arr),
    mrr: asNumberOrNull(r.mrr),
    nrr: asNumberOrNull(r.nrr),
    churn_rate: asNumberOrNull(r.churn_rate),
    ltv: asNumberOrNull(r.ltv),
    cac: asNumberOrNull(r.cac),
    addback_owner_compensation: asNumberOrNull(r.addback_owner_compensation),
    addback_exceptional_charges: asNumberOrNull(r.addback_exceptional_charges),
    addback_property_rent: asNumberOrNull(r.addback_property_rent),
    addback_one_off_fees: asNumberOrNull(r.addback_one_off_fees),
    addback_other: asNumberOrNull(r.addback_other),
    addback_notes: asStringOrNull(r.addback_notes),
  };
}

function sanitizeExtraction(raw: Record<string, unknown>): ExtractedDocumentInsights {
  const yearsRaw = Array.isArray(raw.financial_years) ? raw.financial_years : [];
  const years = yearsRaw
    .map(sanitizeFinancialYear)
    .filter((y): y is ExtractedFinancialYear => y !== null);

  const confidenceRaw = raw.confidence;
  const confidence = isNumber(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : 0;

  return {
    company_name: asStringOrNull(raw.company_name),
    summary: isString(raw.summary) ? raw.summary.slice(0, 2000) : "",
    sector: asStringOrNull(raw.sector),
    business_model: asStringOrNull(raw.business_model),
    key_differentiators: asStringArray(raw.key_differentiators, 5),
    key_risks: asStringArray(raw.key_risks, 5),
    inconsistencies: asStringArray(raw.inconsistencies, 3),
    detected_document_type: asStringOrNull(raw.detected_document_type),
    financial_years: years,
    confidence,
  };
}
