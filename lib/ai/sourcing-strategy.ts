/**
 * lib/ai/sourcing-strategy.ts — Stratégie de sourcing IA (S1)
 *
 * Point d'entrée : generateSourcingPlan(input).
 *
 * Claude lit le dossier complet (screening, financier, critères, rôle cible)
 * et produit un plan structuré :
 *   - Profile summary : portrait de la cible idéale
 *   - Segments 2 à 5, priorisés, avec type d'acteur, mots-clés, géo, taille
 *   - Signaux de marché à surveiller (activité récente, annonces)
 *   - Exclusions explicites
 *   - Confiance + notes
 *
 * Ce plan est ensuite exécuté par l'orchestrateur (S2/S3) qui attaque le CRM
 * interne et les connecteurs externes en parallèle pour chaque segment.
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 * Retourne null si API indisponible ou JSON invalide. L'appelant affiche un
 * warning dans l'UI et permet à l'utilisateur de composer son plan à la main.
 */

// ── Types publics ────────────────────────────────────────────────────────────

export interface SourcingStrategyInput {
  deal: {
    name: string;
    deal_type: string;
    sector: string | null;
    currency: string;
    // Screening qualifié (V53)
    executive_summary: string | null;
    motivation_narrative: string | null;
    key_differentiators: string[] | null;
    key_risks: string[] | null;
    competitive_landscape: string | null;
    market_context: string | null;
    // Critères M&A Buy
    target_sectors: string[] | null;
    excluded_sectors: string[] | null;
    target_geographies: string[] | null;
    excluded_geographies: string[] | null;
    target_revenue_min: number | null;
    target_revenue_max: number | null;
    target_stage: string | null;
    strategic_rationale: string | null;
    // Fundraising
    target_raise_amount: number | null;
    round_type: string | null;
    use_of_funds: string | null;
    // M&A Sell
    asking_price_min: number | null;
    asking_price_max: number | null;
    // Géographie dossier
    company_geography: string | null;
    company_stage: string | null;
    // Financier synthétique
    latest_revenue: number | null;
    latest_ebitda: number | null;
    latest_revenue_growth: number | null;
  };
}

export type ActorType =
  | "corporate_strategic"
  | "corporate_build_up"
  | "private_equity"
  | "growth_equity"
  | "venture_capital"
  | "family_office"
  | "business_angel"
  | "search_fund"
  | "individual_acquirer"
  | "investment_bank"
  | "other";

export interface SourcingSegment {
  name: string;                // "Corporates du luxe"
  priority: 1 | 2 | 3;         // 1 = priorité haute
  actor_type: ActorType;
  keywords: string[];          // mots-clés de recherche pour Apollo/Harmonic
  geographies: string[];       // codes internes : france, europe, dach...
  employee_min: number | null;
  employee_max: number | null;
  rationale: string;           // 2 lignes, pourquoi ce segment
}

export interface SourcingPlan {
  profile_summary: string;     // 2 à 3 phrases, portrait de la cible idéale
  segments: SourcingSegment[]; // 2 à 5 segments
  signals_to_watch: string[];  // signaux de marché qui valideraient un match
  exclusions: string[];        // types d'acteurs ou profils à éviter
  confidence: number;          // 0-100
  notes: string | null;        // avertissement si données insuffisantes
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(n: number | null | undefined, currency: string): string {
  if (n == null) return "non renseigné";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es associé senior en M&A, fundraising et recrutement, avec 15 ans d'expérience de sourcing. Pour un dossier donné, tu construis une stratégie de recherche d'acteurs à contacter structurée, priorisée, actionnable.

Règles impératives :
- Langue : français professionnel, sobre, factuel, direct.
- Jamais d'invention. Tu t'appuies uniquement sur les informations fournies.
- Pas de tiret cadratin dans les textes : virgule ou point.
- Pas de superlatifs gratuits ni de termes commerciaux.
- Tu penses segments distincts, pas un segment fourre-tout.
- Pour chaque segment, les mots-clés doivent être opérationnels pour une recherche Apollo/LinkedIn (anglais + français si pertinent, termes que les acteurs utilisent pour se décrire).
- Tu priorises 2 à 5 segments maximum. Plus n'est pas mieux.
- Tu réponds uniquement par un objet JSON valide, sans texte hors JSON, sans backticks.`;

function buildUserPrompt(input: SourcingStrategyInput): string {
  const d = input.deal;
  const parts: string[] = [];

  parts.push(`Dossier : ${d.name}`);
  parts.push(`Type de mission : ${d.deal_type}`);
  if (d.sector) parts.push(`Secteur : ${d.sector}`);
  if (d.company_geography) parts.push(`Géographie : ${d.company_geography}`);
  if (d.company_stage) parts.push(`Taille : ${d.company_stage}`);

  if (d.executive_summary) parts.push(`\nPitch dossier :\n${d.executive_summary}`);
  if (d.motivation_narrative) parts.push(`\nMotivation :\n${d.motivation_narrative}`);
  if (d.key_differentiators?.length) parts.push(`\nDifférenciateurs :\n- ${d.key_differentiators.join("\n- ")}`);
  if (d.key_risks?.length) parts.push(`\nPoints d'attention :\n- ${d.key_risks.join("\n- ")}`);
  if (d.competitive_landscape) parts.push(`\nConcurrence :\n${d.competitive_landscape}`);
  if (d.market_context) parts.push(`\nContexte marché :\n${d.market_context}`);

  // Financier
  if (d.latest_revenue != null || d.latest_ebitda != null) {
    parts.push(`\nDernier exercice : revenue ${fmtAmount(d.latest_revenue, d.currency)}, EBITDA ${fmtAmount(d.latest_ebitda, d.currency)}${d.latest_revenue_growth != null ? `, croissance ${d.latest_revenue_growth}%` : ""}`);
  }

  // Critères spécifiques par type
  if (d.deal_type === "ma_sell") {
    if (d.asking_price_min || d.asking_price_max) {
      parts.push(`Fourchette prix demandé : ${fmtAmount(d.asking_price_min, d.currency)} à ${fmtAmount(d.asking_price_max, d.currency)}`);
    }
    parts.push(`\nObjectif : identifier des ACQUEREURS potentiels (corporates du secteur, PE, search funds, acquéreurs individuels selon profil).`);
  } else if (d.deal_type === "ma_buy") {
    if (d.target_sectors?.length) parts.push(`Secteurs cibles : ${d.target_sectors.join(", ")}`);
    if (d.excluded_sectors?.length) parts.push(`Secteurs exclus : ${d.excluded_sectors.join(", ")}`);
    if (d.target_geographies?.length) parts.push(`Géos cibles : ${d.target_geographies.join(", ")}`);
    if (d.target_revenue_min || d.target_revenue_max) {
      parts.push(`Fourchette revenue cible : ${fmtAmount(d.target_revenue_min, d.currency)} à ${fmtAmount(d.target_revenue_max, d.currency)}`);
    }
    if (d.target_stage) parts.push(`Taille cible : ${d.target_stage}`);
    if (d.strategic_rationale) parts.push(`\nRationale stratégique :\n${d.strategic_rationale}`);
    parts.push(`\nObjectif : identifier des CIBLES d'acquisition (PME/ETI selon critères, entreprises à vendre dans les segments visés).`);
  } else if (d.deal_type === "fundraising") {
    if (d.target_raise_amount) parts.push(`Montant recherché : ${fmtAmount(d.target_raise_amount, d.currency)}`);
    if (d.round_type) parts.push(`Type de tour : ${d.round_type}`);
    if (d.use_of_funds) parts.push(`\nUse of funds :\n${d.use_of_funds}`);
    parts.push(`\nObjectif : identifier des INVESTISSEURS potentiels (VC / PE / FO / CVC / BA avec thèse alignée).`);
  } else if (d.deal_type === "recruitment") {
    parts.push(`\nObjectif : identifier des PROFILS / VIVIERS de candidats pertinents pour le poste (cabinets de recrutement spécialisés, entreprises qui emploient ces profils, associations professionnelles).`);
  } else if (d.deal_type === "cfo_advisor") {
    parts.push(`\nObjectif : identifier des PARTENAIRES pertinents (experts-comptables de réseau, conseils financiers complémentaires, logiciels).`);
  }

  parts.push(`
Produis STRICTEMENT ce JSON :

{
  "profile_summary": "2 à 3 phrases décrivant la cible idéale, ce qui en fait un acteur pertinent pour ce dossier précis",
  "segments": [
    {
      "name": "Nom clair et opérationnel du segment",
      "priority": 1 | 2 | 3,
      "actor_type": "corporate_strategic | corporate_build_up | private_equity | growth_equity | venture_capital | family_office | business_angel | search_fund | individual_acquirer | investment_bank | other",
      "keywords": ["mot-clé opérationnel 1", "en anglais 2", "terme métier 3"],
      "geographies": ["france", "europe", "dach", ...],
      "employee_min": <nombre ou null>,
      "employee_max": <nombre ou null>,
      "rationale": "2 lignes maximum expliquant pourquoi ce segment pour ce dossier"
    }
  ],
  "signals_to_watch": ["signal 1 (ex: build-up récent dans le secteur)", "signal 2"],
  "exclusions": ["profil d'acteur à éviter 1", "exclusion 2"],
  "confidence": <entier 0 à 100>,
  "notes": null | "avertissement si données du dossier insuffisantes pour être vraiment précis"
}

Règles de qualité :
- 2 à 5 segments maximum, pas plus. Priorité 1 à 3 répartie intelligemment.
- Les keywords doivent permettre de trouver des acteurs réels dans une base comme Apollo. Évite les termes vagues.
- Les géos doivent utiliser les codes internes fournis quand c'est pertinent : france, suisse, dach, ue, europe, amerique_nord, amerique_sud, asie, moyen_orient, afrique, oceanie, global.
- employee_min/max ne sont pas obligatoires. Laisse null si tu n'as pas assez d'info.
- Si les données du dossier sont pauvres, baisse la confidence et explique-le dans notes plutôt que d'inventer.`);

  return parts.join("\n");
}

// ── Parsing + garde-fous ────────────────────────────────────────────────────

const VALID_ACTOR_TYPES: ActorType[] = [
  "corporate_strategic", "corporate_build_up", "private_equity",
  "growth_equity", "venture_capital", "family_office", "business_angel",
  "search_fund", "individual_acquirer", "investment_bank", "other",
];

function coerceActorType(v: unknown): ActorType {
  if (typeof v === "string" && (VALID_ACTOR_TYPES as string[]).includes(v)) return v as ActorType;
  return "other";
}

function coercePriority(v: unknown): 1 | 2 | 3 {
  if (v === 1 || v === 2 || v === 3) return v;
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3) return n as 1 | 2 | 3;
  return 2;
}

function parseSegment(raw: unknown): SourcingSegment | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  if (typeof r.rationale !== "string") return null;

  return {
    name: r.name.trim(),
    priority: coercePriority(r.priority),
    actor_type: coerceActorType(r.actor_type),
    keywords: Array.isArray(r.keywords)
      ? r.keywords.filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
      : [],
    geographies: Array.isArray(r.geographies)
      ? r.geographies.filter((v: unknown): v is string => typeof v === "string")
      : [],
    employee_min: typeof r.employee_min === "number" ? r.employee_min : null,
    employee_max: typeof r.employee_max === "number" ? r.employee_max : null,
    rationale: r.rationale,
  };
}

function parseResponse(raw: string): SourcingPlan | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    if (typeof parsed !== "object" || parsed === null) return null;

    const p = parsed as Record<string, unknown>;

    const segments: SourcingSegment[] = Array.isArray(p.segments)
      ? p.segments.map(parseSegment).filter((s): s is SourcingSegment => s !== null).slice(0, 5)
      : [];

    if (segments.length === 0) return null;

    return {
      profile_summary: typeof p.profile_summary === "string" ? p.profile_summary : "",
      segments,
      signals_to_watch: Array.isArray(p.signals_to_watch)
        ? p.signals_to_watch.filter((v: unknown): v is string => typeof v === "string")
        : [],
      exclusions: Array.isArray(p.exclusions)
        ? p.exclusions.filter((v: unknown): v is string => typeof v === "string")
        : [],
      confidence: typeof p.confidence === "number" ? Math.max(0, Math.min(100, Math.round(p.confidence))) : 0,
      notes: typeof p.notes === "string" ? p.notes : null,
    };
  } catch {
    return null;
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function generateSourcingPlan(
  input: SourcingStrategyInput,
): Promise<SourcingPlan | null> {
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
        max_tokens: 2500,
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

// ── Plan par défaut (fallback si IA indisponible) ────────────────────────────

// Permet au user de continuer à faire du sourcing même sans Claude, avec un
// plan minimal basé sur les critères du dossier. Sera proposé comme point de
// départ éditable dans l'UI.
export function buildFallbackPlan(input: SourcingStrategyInput): SourcingPlan {
  const d = input.deal;
  const segments: SourcingSegment[] = [];

  if (d.deal_type === "ma_sell") {
    segments.push({
      name: "Corporates du secteur",
      priority: 1,
      actor_type: "corporate_strategic",
      keywords: d.sector ? [d.sector, "acquisition", "build-up"] : ["acquisition", "build-up"],
      geographies: d.company_geography ? [d.company_geography] : ["france"],
      employee_min: 200,
      employee_max: null,
      rationale: "Acteurs industriels du secteur susceptibles de chercher des cibles pour consolidation ou intégration.",
    });
    segments.push({
      name: "PE mid-market",
      priority: 2,
      actor_type: "private_equity",
      keywords: ["private equity", "LBO", "mid-market"],
      geographies: d.company_geography ? [d.company_geography] : ["france"],
      employee_min: 20,
      employee_max: 500,
      rationale: "Fonds d'investissement avec thèse mid-market capables de reprise avec management.",
    });
  } else if (d.deal_type === "fundraising") {
    segments.push({
      name: "VC sectoriels",
      priority: 1,
      actor_type: "venture_capital",
      keywords: d.sector ? ["venture capital", d.sector] : ["venture capital"],
      geographies: d.company_geography ? [d.company_geography, "europe"] : ["france", "europe"],
      employee_min: 5,
      employee_max: 200,
      rationale: "Fonds VC ayant investi dans des sociétés du même secteur ou avec thèse alignée.",
    });
  } else if (d.deal_type === "ma_buy") {
    segments.push({
      name: "Cibles principales",
      priority: 1,
      actor_type: "other",
      keywords: d.target_sectors?.length ? d.target_sectors : (d.sector ? [d.sector] : []),
      geographies: d.target_geographies?.length ? d.target_geographies : (d.company_geography ? [d.company_geography] : ["france"]),
      employee_min: d.target_revenue_min ? Math.max(1, Math.floor(d.target_revenue_min / 200_000)) : null,
      employee_max: d.target_revenue_max ? Math.ceil(d.target_revenue_max / 100_000) : null,
      rationale: "Entreprises correspondant aux critères acquisition du mandat.",
    });
  }

  return {
    profile_summary: `Plan par défaut pour ${d.name}. Édite les segments selon tes priorités réelles, ou relance la génération IA.`,
    segments,
    signals_to_watch: [],
    exclusions: [],
    confidence: 0,
    notes: "Plan généré sans IA (clé API manquante ou erreur). Ajuste manuellement.",
  };
}
