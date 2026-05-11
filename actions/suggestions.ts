"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  runApolloSearchForDeal,
  type ApolloSearchCriteria,
} from "@/lib/connectors/apollo";
import {
  scoreSuggestionWithAI,
  generateOutreachDraft,
  type MatchingBrainDealContext,
  type MatchingBrainOrgProfile,
} from "@/lib/ai/matching-brain";
import { isScreeningReady } from "@/lib/crm/matching-maps";
import {
  defaultSuggestionRoleForDealType,
  type SuggestionRole,
} from "@/lib/crm/matching-maps";

// ── Types de retour ──────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true } & T)
  | { success: false; error: string };

export interface SuggestTargetsResult {
  success: true;
  batch_id: string;
  fetched: number;
  suggestions_created: number;
  suggestions_enriched: number;
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface DealFullContext {
  id: string;
  user_id: string;
  name: string;
  deal_type: string;
  sector: string | null;
  currency: string;
  screening_status: string | null;
  executive_summary: string | null;
  motivation_narrative: string | null;
  key_differentiators: string[] | null;
  key_risks: string[] | null;
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_stage: string | null;
  strategic_rationale: string | null;
  target_raise_amount: number | null;
  asking_price_min: number | null;
  asking_price_max: number | null;
  round_type: string | null;
  company_stage: string | null;
  company_geography: string | null;
  latest_revenue: number | null;
  latest_ebitda: number | null;
}

async function loadDealContext(dealId: string, userId: string): Promise<DealFullContext | null> {
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(`
      id, user_id, name, deal_type, sector, currency,
      screening_status, executive_summary, motivation_narrative,
      key_differentiators, key_risks,
      target_sectors, excluded_sectors, target_geographies,
      target_revenue_min, target_revenue_max, target_stage,
      strategic_rationale, target_raise_amount, round_type,
      asking_price_min, asking_price_max,
      company_stage, company_geography
    `)
    .eq("id", dealId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!deal) return null;

  const { data: fin } = await supabase
    .from("financial_data")
    .select("revenue, ebitda")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("fiscal_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...deal,
    currency: deal.currency ?? "EUR",
    latest_revenue: fin?.revenue ?? null,
    latest_ebitda: fin?.ebitda ?? null,
  };
}

function toMatchingBrainDealContext(d: DealFullContext): MatchingBrainDealContext {
  return {
    name: d.name,
    deal_type: d.deal_type,
    sector: d.sector,
    executive_summary: d.executive_summary,
    motivation_narrative: d.motivation_narrative,
    key_differentiators: d.key_differentiators,
    key_risks: d.key_risks,
    target_sectors: d.target_sectors,
    excluded_sectors: d.excluded_sectors,
    target_revenue_min: d.target_revenue_min,
    target_revenue_max: d.target_revenue_max,
    strategic_rationale: d.strategic_rationale,
    target_raise_amount: d.target_raise_amount,
    round_type: d.round_type,
    latest_revenue: d.latest_revenue,
    latest_ebitda: d.latest_ebitda,
    currency: d.currency,
  };
}

// Construit les critères Apollo à partir du dossier, calibrés par métier.
//
// M&A Sell : cherche des ACQUÉREURS potentiels pour la société vendue.
//   → corporates du même secteur (build-up) + PE/search funds actifs sur le segment
//   → géographie proche de la société vendue
//   → taille d'acquéreur cohérente avec le prix demandé (10-100× la taille cible)
//
// M&A Buy : cherche des CIBLES d'acquisition pour le client acheteur.
//   → secteurs visés (target_sectors)
//   → géographies visées (target_geographies)
//   → fourchette revenue/employés cible
//
// Fundraising : cherche des INVESTISSEURS potentiels pour la société qui lève.
//   → VC / PE / FO / business angels avec thèse sectorielle alignée
//   → géographie d'investissement couvrant le pays de la société
//   → ticket aligné avec target_raise_amount (typiquement 10-30% du round)
function buildApolloCriteriaForDeal(d: DealFullContext): ApolloSearchCriteria {
  const criteria: ApolloSearchCriteria = { per_page: 25, page: 1 };

  if (d.deal_type === "ma_buy") {
    criteria.sectors = d.target_sectors?.length ? d.target_sectors : (d.sector ? [d.sector] : []);
    criteria.geographies = d.target_geographies?.length ? d.target_geographies : (d.company_geography ? [d.company_geography] : []);
    // Conversion revenue → employés (approximation : 1 employé = 150k€ CA)
    if (d.target_revenue_min) criteria.employee_min = Math.max(1, Math.floor(d.target_revenue_min / 200_000));
    if (d.target_revenue_max) criteria.employee_max = Math.ceil(d.target_revenue_max / 100_000);
    criteria.company_stage = d.target_stage;

  } else if (d.deal_type === "ma_sell") {
    // On cherche des acquéreurs : corporates du même secteur + PE
    criteria.sectors = d.sector ? [d.sector] : [];
    criteria.geographies = d.company_geography ? [d.company_geography] : ["france"];
    criteria.keywords = ["acquisition", "build-up", "private equity", "corporate development"];
    // Un acquéreur doit être significativement plus gros que la cible
    if (d.latest_revenue) {
      criteria.employee_min = Math.max(50, Math.floor((d.latest_revenue * 10) / 200_000));
      criteria.employee_max = Math.ceil((d.latest_revenue * 100) / 100_000);
    } else if (d.asking_price_min) {
      criteria.employee_min = Math.max(50, Math.floor((d.asking_price_min * 3) / 200_000));
    }

  } else if (d.deal_type === "fundraising") {
    // On cherche des investisseurs : VC / PE / BA / FO / CVC
    criteria.sectors = d.sector ? [d.sector] : [];
    criteria.geographies = d.company_geography ? [d.company_geography] : ["france", "europe"];
    criteria.keywords = ["venture capital", "private equity", "family office", "business angel", "corporate venture"];
    // Taille des fonds cibles : larges structures (50-5000 employés)
    criteria.employee_min = 5;
    criteria.employee_max = 500;
  }

  return criteria;
}

// Expose les critères résolus sous une forme lisible pour l'UI (aperçu
// avant lancement de la recherche). Transparence + calibration côté user.
export interface CriteriaPreview {
  deal_type: string;
  mission: string;              // "Rechercher des acquéreurs pour…"
  sectors: string[];
  geographies: string[];
  keywords: string[];
  employee_range: string | null;
  notes: string | null;
}

export async function previewSuggestionCriteria(
  dealId: string,
): Promise<{ success: true; preview: CriteriaPreview } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const deal = await loadDealContext(dealId, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };

  const criteria = buildApolloCriteriaForDeal(deal);

  const missionByType: Record<string, string> = {
    ma_sell: `Rechercher des acquéreurs pour ${deal.name}`,
    ma_buy: `Rechercher des cibles pour ${deal.name}`,
    fundraising: `Rechercher des investisseurs pour ${deal.name}`,
    recruitment: `Rechercher des candidats pour ${deal.name}`,
    cfo_advisor: `Rechercher des partenaires pour ${deal.name}`,
  };

  const employeeRange =
    criteria.employee_min != null && criteria.employee_max != null
      ? `${criteria.employee_min} à ${criteria.employee_max} employés`
      : criteria.employee_min != null
      ? `≥ ${criteria.employee_min} employés`
      : null;

  let notes: string | null = null;
  if (!criteria.sectors?.length) notes = "Aucun secteur précisé. La recherche sera moins ciblée. Renseigne le secteur sur le dossier ou les critères cibles pour améliorer la pertinence.";
  else if (!criteria.geographies?.length) notes = "Aucune géographie précisée. Renseigne le pays d'intervention pour filtrer.";

  return {
    success: true,
    preview: {
      deal_type: deal.deal_type,
      mission: missionByType[deal.deal_type] ?? `Rechercher pour ${deal.name}`,
      sectors: criteria.sectors ?? [],
      geographies: criteria.geographies ?? [],
      keywords: criteria.keywords ?? [],
      employee_range: employeeRange,
      notes,
    },
  };
}

// Score algorithmique simplifié pour V1 du Module 2 : matching secteur (40)
// + matching taille (30) + matching géo (30). Sera remplacé par un appel
// aux fonctions existantes de lib/crm/ma-scoring et matching.ts en V2.
function computeQuickAlgoScore(deal: DealFullContext, org: MatchingBrainOrgProfile): number {
  let score = 0;

  // Secteur : 40 points
  const dealSectorsTargeted: string[] = [];
  if (deal.deal_type === "ma_buy") dealSectorsTargeted.push(...(deal.target_sectors ?? []));
  else if (deal.sector) dealSectorsTargeted.push(deal.sector);

  if (dealSectorsTargeted.length === 0) {
    score += 20; // neutre, pas d'info
  } else if (org.sector && dealSectorsTargeted.some(s => s.toLowerCase().includes(org.sector!.toLowerCase()) || org.sector!.toLowerCase().includes(s.toLowerCase()))) {
    score += 40;
  } else if (org.sector) {
    score += 10; // secteur renseigné mais non aligné
  }

  // Exclusions
  if (org.sector && deal.excluded_sectors?.some(s => s.toLowerCase() === org.sector!.toLowerCase())) {
    return 0; // drop-dead sur secteur exclu
  }

  // Taille : 30 points
  if (!org.employee_count && !org.company_stage) {
    score += 10;
  } else {
    score += 25;
  }

  // Géographie : 30 points (heuristique, amélioré en V2)
  if (!org.location) score += 10;
  else score += 25;

  return Math.min(100, score);
}

// ── Entry point : générer des suggestions pour un dossier ────────────────────

export async function suggestTargetsForDeal(
  dealId: string,
  opts: { withAI?: boolean; contactsPerOrg?: number } = {},
): Promise<SuggestTargetsResult | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const deal = await loadDealContext(dealId, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };

  if (!isScreeningReady(deal.screening_status)) {
    return {
      success: false,
      error: "Le dossier n'est pas encore prêt pour outreach (screening non validé).",
    };
  }

  const warnings: string[] = [];
  const criteria = buildApolloCriteriaForDeal(deal);
  const batchId = randomUUID();
  const roleSuggested: SuggestionRole = defaultSuggestionRoleForDealType(deal.deal_type);

  const apolloResult = await runApolloSearchForDeal({
    userId: user.id,
    dealId: dealId,
    criteria,
    contactsPerOrg: opts.contactsPerOrg ?? 3,
    triggeredBy: "manual",
  });

  if (apolloResult.status !== "success") {
    return {
      success: false,
      error: apolloResult.errorMessage || "Apollo n'a pas retourné de résultats",
    };
  }

  const admin = createAdminClient();
  let suggestionsCreated = 0;
  let suggestionsEnriched = 0;

  for (const apolloOrg of apolloResult.orgsUpserted) {
    // Charger le profil de l'org pour scoring
    const { data: orgProfile } = await admin
      .from("organizations")
      .select(`
        name, organization_type, sector, description,
        employee_count, company_stage, location, website,
        investor_sectors, investor_stages,
        investor_ticket_min, investor_ticket_max
      `)
      .eq("id", apolloOrg.orgId)
      .maybeSingle();

    if (!orgProfile) continue;

    const orgContext: MatchingBrainOrgProfile = {
      name: orgProfile.name,
      organization_type: orgProfile.organization_type,
      sector: orgProfile.sector,
      description: orgProfile.description,
      employee_count: orgProfile.employee_count,
      company_stage: orgProfile.company_stage,
      location: orgProfile.location,
      website: orgProfile.website,
      investor_sectors: orgProfile.investor_sectors,
      investor_stages: orgProfile.investor_stages,
      investor_ticket_min: orgProfile.investor_ticket_min,
      investor_ticket_max: orgProfile.investor_ticket_max,
    };

    const scoreAlgo = computeQuickAlgoScore(deal, orgContext);

    // Scoring IA optionnel (coûteux, à la demande)
    let scoreAi: number | null = null;
    let aiExplanation: string | null = null;
    let aiRedFlags: string[] | null = null;
    let aiConfidence: number | null = null;

    if (opts.withAI) {
      const brain = await scoreSuggestionWithAI({
        deal: toMatchingBrainDealContext(deal),
        organization: orgContext,
        role_suggested: roleSuggested,
      });
      if (brain) {
        scoreAi = brain.score_ai;
        aiExplanation = brain.explanation;
        aiRedFlags = brain.red_flags;
        aiConfidence = brain.confidence;
      } else {
        warnings.push(`Scoring IA indisponible pour ${orgProfile.name}`);
      }
    }

    const scoreCombined = scoreAi == null
      ? scoreAlgo
      : Math.round(scoreAlgo * 0.6 + scoreAi * 0.4);

    // Contact décideur principal : premier contact rattaché à cette org
    const contactId = apolloResult.contactsUpserted.find(c => c.orgId === apolloOrg.orgId)?.contactId ?? null;

    // Upsert via on conflict sur l'index unique partiel (deal_id, organization_id) WHERE status NOT IN ('rejected','contacted')
    const { data: existing } = await admin
      .from("deal_target_suggestions")
      .select("id, status")
      .eq("deal_id", dealId)
      .eq("organization_id", apolloOrg.orgId)
      .not("status", "in", '("rejected","contacted")')
      .maybeSingle();

    if (existing) {
      // Enrichissement : mise à jour scores + IA
      await admin
        .from("deal_target_suggestions")
        .update({
          score_algo: scoreAlgo,
          score_ai: scoreAi,
          score_combined: scoreCombined,
          ai_explanation: aiExplanation ?? undefined,
          ai_red_flags: aiRedFlags ?? undefined,
          ai_confidence: aiConfidence ?? undefined,
          contact_id: contactId ?? undefined,
        })
        .eq("id", existing.id);
      suggestionsEnriched++;
    } else {
      const { error: insertErr } = await admin
        .from("deal_target_suggestions")
        .insert({
          user_id: user.id,
          deal_id: dealId,
          organization_id: apolloOrg.orgId,
          contact_id: contactId,
          role_suggested: roleSuggested,
          source_connector: "apollo",
          external_reference: apolloOrg.apolloId,
          suggestion_batch_id: batchId,
          score_algo: scoreAlgo,
          score_ai: scoreAi,
          score_combined: scoreCombined,
          ai_explanation: aiExplanation,
          ai_red_flags: aiRedFlags ?? [],
          ai_confidence: aiConfidence,
          status: "suggested",
        });
      if (!insertErr) suggestionsCreated++;
    }
  }

  // Log total suggestions_created dans le connector_run
  if (apolloResult.runId) {
    await admin
      .from("connector_runs")
      .update({ suggestions_created: suggestionsCreated })
      .eq("id", apolloResult.runId);
  }

  revalidatePath(`/protected/dossiers/${dealId}`);

  return {
    success: true,
    batch_id: batchId,
    fetched: apolloResult.fetched,
    suggestions_created: suggestionsCreated,
    suggestions_enriched: suggestionsEnriched,
    warnings,
  };
}

// ── Workflow : approve / reject / defer ──────────────────────────────────────

async function setSuggestionStatus(
  suggestionId: string,
  status: "approved" | "rejected" | "deferred" | "contacted",
  notes?: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: suggestion, error: loadErr } = await supabase
    .from("deal_target_suggestions")
    .select("deal_id")
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr || !suggestion) return { success: false, error: "Suggestion introuvable" };

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewed_notes: notes ?? null,
    })
    .eq("id", suggestionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Si approuvée : upgrade le contact principal en role_in_dossier via deal_organizations
  // (facultatif V1, déjà géré par le consultant via onglet)
  revalidatePath(`/protected/dossiers/${suggestion.deal_id}`);
  return { success: true };
}

export async function approveSuggestion(suggestionId: string, notes?: string | null) {
  return setSuggestionStatus(suggestionId, "approved", notes);
}

export async function rejectSuggestion(suggestionId: string, notes?: string | null) {
  return setSuggestionStatus(suggestionId, "rejected", notes);
}

export async function deferSuggestion(suggestionId: string, notes?: string | null) {
  return setSuggestionStatus(suggestionId, "deferred", notes);
}

export async function markSuggestionContacted(suggestionId: string) {
  return setSuggestionStatus(suggestionId, "contacted");
}

// ── Scoring IA à la demande (sur une suggestion existante) ───────────────────

export async function scoreSuggestionAI(
  suggestionId: string,
): Promise<{ success: true; score_ai: number } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: suggestion } = await supabase
    .from("deal_target_suggestions")
    .select("id, deal_id, organization_id, role_suggested, score_algo")
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!suggestion) return { success: false, error: "Suggestion introuvable" };

  const deal = await loadDealContext(suggestion.deal_id, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };

  const { data: orgProfile } = await supabase
    .from("organizations")
    .select(`
      name, organization_type, sector, description,
      employee_count, company_stage, location, website,
      investor_sectors, investor_stages,
      investor_ticket_min, investor_ticket_max
    `)
    .eq("id", suggestion.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!orgProfile) return { success: false, error: "Organisation introuvable" };

  const brain = await scoreSuggestionWithAI({
    deal: toMatchingBrainDealContext(deal),
    organization: orgProfile as MatchingBrainOrgProfile,
    role_suggested: suggestion.role_suggested,
  });

  if (!brain) return { success: false, error: "L'IA n'a pas pu scorer (clé API ou réponse invalide)" };

  const scoreAlgo = suggestion.score_algo ?? 0;
  const scoreCombined = Math.round(scoreAlgo * 0.6 + brain.score_ai * 0.4);

  const { error } = await supabase
    .from("deal_target_suggestions")
    .update({
      score_ai: brain.score_ai,
      score_combined: scoreCombined,
      ai_explanation: brain.explanation,
      ai_red_flags: brain.red_flags,
      ai_confidence: brain.confidence,
    })
    .eq("id", suggestionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${suggestion.deal_id}`);
  return { success: true, score_ai: brain.score_ai };
}

// ── Génération d'un brief outreach IA sur une suggestion approuvée ───────────

export async function generateOutreachBriefForSuggestion(
  suggestionId: string,
): Promise<{ success: true; email_subject: string; email_body: string; linkedin_message: string }
  | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: suggestion } = await supabase
    .from("deal_target_suggestions")
    .select(`
      id, deal_id, organization_id, contact_id, role_suggested,
      score_ai, ai_explanation
    `)
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!suggestion) return { success: false, error: "Suggestion introuvable" };

  const deal = await loadDealContext(suggestion.deal_id, user.id);
  if (!deal) return { success: false, error: "Dossier introuvable" };

  const { data: orgProfile } = await supabase
    .from("organizations")
    .select(`
      name, organization_type, sector, description,
      employee_count, company_stage, location, website,
      investor_sectors, investor_stages,
      investor_ticket_min, investor_ticket_max
    `)
    .eq("id", suggestion.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!orgProfile) return { success: false, error: "Organisation introuvable" };

  let contact = null;
  if (suggestion.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name, title")
      .eq("id", suggestion.contact_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (c) contact = c;
  }

  const draft = await generateOutreachDraft({
    deal: toMatchingBrainDealContext(deal),
    organization: orgProfile as MatchingBrainOrgProfile,
    contact,
    role_suggested: suggestion.role_suggested,
    score_ai: suggestion.score_ai,
    score_ai_explanation: suggestion.ai_explanation,
  });

  if (!draft) return { success: false, error: "L'IA n'a pas pu générer de brief" };

  // Sauvegarde concaténée dans outreach_brief
  const combined = `OBJET : ${draft.email_subject}\n\nEMAIL :\n${draft.email_body}\n\nLINKEDIN :\n${draft.linkedin_message}${draft.reasoning ? `\n\nAngle : ${draft.reasoning}` : ""}`;

  await supabase
    .from("deal_target_suggestions")
    .update({
      outreach_brief: combined,
      outreach_brief_generated_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)
    .eq("user_id", user.id);

  revalidatePath(`/protected/dossiers/${suggestion.deal_id}`);

  return {
    success: true,
    email_subject: draft.email_subject,
    email_body: draft.email_body,
    linkedin_message: draft.linkedin_message,
  };
}
