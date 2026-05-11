/**
 * lib/ai/matching-brain.ts — Cerveau IA du matching (M2d)
 *
 * Deux fonctions :
 *   1. scoreSuggestionWithAI() : évalue le fit d'une organisation suggérée
 *      pour un dossier. Retourne score 0-100, explication, red flags,
 *      confidence. Complète le scoring algorithmique existant.
 *
 *   2. generateOutreachDraft() : rédige une accroche de prise de contact
 *      (email + LinkedIn) personnalisée à partir du dossier et du contact
 *      décideur de l'organisation cible.
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 * Appel : fetch direct API Anthropic (pattern cohérent avec
 * financial-scoring.ts et brief-engine.ts).
 *
 * Retourne null si clé API absente ou réponse invalide. L'appelant décide
 * d'afficher un warning.
 */

export interface MatchingBrainDealContext {
  name: string;
  deal_type: string;
  sector: string | null;
  executive_summary: string | null;
  motivation_narrative: string | null;
  key_differentiators: string[] | null;
  key_risks: string[] | null;
  // Critères M&A buy-side
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  strategic_rationale: string | null;
  // Critères Fundraising
  target_raise_amount: number | null;
  round_type: string | null;
  // Financier synthétique
  latest_revenue: number | null;
  latest_ebitda: number | null;
  currency: string;
}

export interface MatchingBrainOrgProfile {
  name: string;
  organization_type: string | null;
  sector: string | null;
  description: string | null;
  employee_count: number | null;
  company_stage: string | null;
  location: string | null;
  website: string | null;
  // Champs investisseur pertinents si l'org est un fonds
  investor_sectors: string[] | null;
  investor_stages: string[] | null;
  investor_ticket_min: number | null;
  investor_ticket_max: number | null;
}

export interface MatchingBrainInput {
  deal: MatchingBrainDealContext;
  organization: MatchingBrainOrgProfile;
  role_suggested: string;
}

export interface MatchingBrainOutput {
  score_ai: number;        // 0-100
  explanation: string;     // 2-3 phrases
  red_flags: string[];     // max 3
  confidence: number;      // 0-100
  notes: string | null;
}

// ── Helpers de formatage ─────────────────────────────────────────────────────

function fmtAmount(n: number | null | undefined, c: string): string {
  if (n == null) return "non renseigné";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${c}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${c}`;
  return `${n} ${c}`;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

// ── Scoring IA ───────────────────────────────────────────────────────────────

const SCORING_SYSTEM_PROMPT = `Tu es analyste senior en M&A, fundraising et recrutement. Tu évalues le fit stratégique entre un dossier et une organisation suggérée comme cible, acquéreur, investisseur, candidat ou partenaire.

Règles impératives :
- Langue : français professionnel, sobre, factuel.
- Jamais d'invention : tu évalues uniquement sur les données fournies.
- Pas de tiret cadratin (—) dans les textes : virgule ou point.
- Tu réponds uniquement par un objet JSON valide, sans texte hors JSON, sans backticks.`;

function buildScoringPrompt(input: MatchingBrainInput): string {
  const d = input.deal;
  const o = input.organization;
  const parts: string[] = [];

  parts.push(`Dossier : ${d.name}`);
  parts.push(`Type : ${d.deal_type}`);
  parts.push(`Rôle suggéré de la cible : ${input.role_suggested}`);
  if (d.sector) parts.push(`Secteur dossier : ${d.sector}`);

  if (d.executive_summary) parts.push(`\nPitch dossier :\n${d.executive_summary}`);
  if (d.motivation_narrative) parts.push(`\nMotivation :\n${d.motivation_narrative}`);
  if (d.key_differentiators?.length) {
    parts.push(`\nDifférenciateurs :\n- ${d.key_differentiators.join("\n- ")}`);
  }
  if (d.key_risks?.length) {
    parts.push(`\nRisques / points d'attention :\n- ${d.key_risks.join("\n- ")}`);
  }

  if (d.deal_type === "ma_buy") {
    if (d.target_sectors?.length)   parts.push(`Secteurs visés : ${d.target_sectors.join(", ")}`);
    if (d.excluded_sectors?.length) parts.push(`Secteurs exclus : ${d.excluded_sectors.join(", ")}`);
    if (d.target_revenue_min || d.target_revenue_max) {
      parts.push(`Fourchette revenue cible : ${fmtAmount(d.target_revenue_min, d.currency)} à ${fmtAmount(d.target_revenue_max, d.currency)}`);
    }
    if (d.strategic_rationale) parts.push(`\nRationale stratégique :\n${d.strategic_rationale}`);
  }

  if (d.deal_type === "fundraising") {
    if (d.target_raise_amount) parts.push(`Montant recherché : ${fmtAmount(d.target_raise_amount, d.currency)}`);
    if (d.round_type) parts.push(`Type de tour : ${d.round_type}`);
  }

  if (d.latest_revenue != null || d.latest_ebitda != null) {
    parts.push(`\nDernier exercice dossier : revenue ${fmtAmount(d.latest_revenue, d.currency)}, EBITDA ${fmtAmount(d.latest_ebitda, d.currency)}`);
  }

  parts.push(`\n─────────\nOrganisation suggérée : ${o.name}`);
  if (o.organization_type) parts.push(`Type : ${o.organization_type}`);
  if (o.sector)            parts.push(`Secteur : ${o.sector}`);
  if (o.company_stage)     parts.push(`Taille : ${o.company_stage}`);
  if (o.employee_count)    parts.push(`Effectifs : ${o.employee_count}`);
  if (o.location)          parts.push(`Localisation : ${o.location}`);
  if (o.website)           parts.push(`Site : ${o.website}`);
  if (o.description)       parts.push(`Description :\n${o.description}`);

  if (o.investor_sectors?.length)  parts.push(`Secteurs d'investissement : ${o.investor_sectors.join(", ")}`);
  if (o.investor_stages?.length)   parts.push(`Stades d'investissement : ${o.investor_stages.join(", ")}`);
  if (o.investor_ticket_min || o.investor_ticket_max) {
    parts.push(`Ticket : ${fmtAmount(o.investor_ticket_min, d.currency)} à ${fmtAmount(o.investor_ticket_max, d.currency)}`);
  }

  parts.push(`
Évalue le fit stratégique de cette organisation pour ce dossier dans son rôle suggéré.

Produire strictement ce JSON :
{
  "score_ai": <entier 0 à 100>,
  "explanation": "2 à 3 phrases factuelles justifiant le score",
  "red_flags": ["point 1", "point 2"],
  "confidence": <entier 0 à 100, baisse si peu de données disponibles>,
  "notes": null ou "avertissement additionnel"
}

Si tu n'as pas assez d'éléments pour évaluer sérieusement, baisse la confidence et explique-le dans notes.`);

  return parts.join("\n");
}

function parseScoringResponse(raw: string): MatchingBrainOutput | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      score_ai: typeof parsed.score_ai === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score_ai))) : 0,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      red_flags: Array.isArray(parsed.red_flags)
        ? parsed.red_flags.filter((v: unknown): v is string => typeof v === "string").slice(0, 3)
        : [],
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 0,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
    };
  } catch {
    return null;
  }
}

export async function scoreSuggestionWithAI(
  input: MatchingBrainInput,
): Promise<MatchingBrainOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = buildScoringPrompt(input);

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
        max_tokens: 800,
        system: SCORING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string") return null;
    return parseScoringResponse(text);
  } catch {
    return null;
  }
}

// ── Brief d'outreach ─────────────────────────────────────────────────────────

export interface OutreachDraftInput {
  deal: MatchingBrainDealContext;
  organization: MatchingBrainOrgProfile;
  contact: {
    first_name: string;
    last_name: string;
    title: string | null;
  } | null;
  role_suggested: string;
  score_ai: number | null;
  score_ai_explanation: string | null;
}

export interface OutreachDraftOutput {
  email_subject: string;
  email_body: string;
  linkedin_message: string;
  reasoning: string | null;
}

const OUTREACH_SYSTEM_PROMPT = `Tu rédiges des accroches de prise de contact sobres et efficaces pour le M&A, le fundraising et le recrutement. Ton style :
- Français professionnel, direct, sans fioritures, jamais alarmiste
- Pas de tiret cadratin (—) : virgule ou point
- Pas de superlatifs gratuits ni de formules commerciales agressives
- L'accroche mène à un RDV de 20 minutes, pas à une décision
- Tu t'appuies uniquement sur les informations fournies
- Output : JSON strict uniquement, rien d'autre`;

function buildOutreachPrompt(input: OutreachDraftInput): string {
  const d = input.deal;
  const o = input.organization;
  const c = input.contact;
  const parts: string[] = [];

  parts.push(`Rôle recherché : ${input.role_suggested}`);
  parts.push(`\nDossier :`);
  parts.push(`- Nom : ${d.name}`);
  parts.push(`- Type : ${d.deal_type}`);
  if (d.sector) parts.push(`- Secteur : ${d.sector}`);
  if (d.executive_summary) parts.push(`- Pitch : ${d.executive_summary}`);
  if (d.key_differentiators?.length) parts.push(`- Différenciateurs : ${d.key_differentiators.join("; ")}`);
  if (d.target_raise_amount) parts.push(`- Montant recherché : ${fmtAmount(d.target_raise_amount, d.currency)}`);
  if (d.round_type) parts.push(`- Round : ${d.round_type}`);
  if (d.latest_revenue != null) parts.push(`- Revenue dernier exercice : ${fmtAmount(d.latest_revenue, d.currency)}`);

  parts.push(`\nDestinataire (organisation) :`);
  parts.push(`- Nom : ${o.name}`);
  if (o.organization_type) parts.push(`- Type : ${o.organization_type}`);
  if (o.sector) parts.push(`- Secteur : ${o.sector}`);
  if (o.description) parts.push(`- Description : ${o.description}`);
  if (o.investor_ticket_min || o.investor_ticket_max) {
    parts.push(`- Ticket investisseur : ${fmtAmount(o.investor_ticket_min, d.currency)} à ${fmtAmount(o.investor_ticket_max, d.currency)}`);
  }

  if (c) {
    parts.push(`\nContact cible :`);
    parts.push(`- Nom : ${c.first_name} ${c.last_name}`);
    if (c.title) parts.push(`- Titre : ${c.title}`);
  }

  if (input.score_ai_explanation) {
    parts.push(`\nPourquoi c'est pertinent : ${input.score_ai_explanation}`);
  }

  parts.push(`
Rédige le JSON suivant :
{
  "email_subject": "objet concis, 5 à 8 mots, pas de clickbait",
  "email_body": "corps de l'email, 80 à 120 mots, 3 paragraphes courts. Présentation sujet, angle de pertinence pour le destinataire, proposition de RDV.",
  "linkedin_message": "version LinkedIn, 40 à 60 mots, ton plus direct",
  "reasoning": "1 phrase expliquant l'angle choisi"
}`);

  return parts.join("\n");
}

function parseOutreachResponse(raw: string): OutreachDraftOutput | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.email_subject !== "string" || typeof parsed.email_body !== "string") return null;
    return {
      email_subject: parsed.email_subject,
      email_body: parsed.email_body,
      linkedin_message: typeof parsed.linkedin_message === "string" ? parsed.linkedin_message : "",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : null,
    };
  } catch {
    return null;
  }
}

export async function generateOutreachDraft(
  input: OutreachDraftInput,
): Promise<OutreachDraftOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = buildOutreachPrompt(input);

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
        max_tokens: 1200,
        system: OUTREACH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string") return null;
    return parseOutreachResponse(text);
  } catch {
    return null;
  }
}
