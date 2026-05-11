"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createMandate } from "@/actions/mandates";
import { upsertFinancialData } from "@/actions/financial-data";

function ns(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createDealAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const name = ns(formData.get("name"));
  if (!name) throw new Error("Nom obligatoire");

  const { data: deal, error } = await supabase.from("deals").insert({
    name,
    deal_type:   ns(formData.get("deal_type"))   ?? "fundraising",
    deal_status: ns(formData.get("deal_status"))  ?? "open",
    deal_stage:  ns(formData.get("deal_stage"))   ?? "kickoff",
    priority_level: ns(formData.get("priority_level")) ?? "medium",
    sector:            ns(formData.get("sector")),
    location:          ns(formData.get("location")),
    description:       ns(formData.get("description")),
    target_amount:     ns(formData.get("target_amount")) ? Number(formData.get("target_amount")) : null,
    currency:          ns(formData.get("currency")) ?? "EUR",
    start_date:        ns(formData.get("start_date")),
    target_date:       ns(formData.get("target_date")),
    company_stage:     ns(formData.get("company_stage")),
    company_geography: ns(formData.get("company_geography")),
    mandate_id:        ns(formData.get("mandate_id")),
    client_organization_id: null,  // Les orgs se lient aux dossiers, pas l'inverse
    user_id: user.id,
  }).select("id").single();

  if (error) throw new Error(error.message);
  if (!deal?.id) throw new Error("Erreur création dossier");

  revalidatePath("/protected/dossiers");
  redirect(`/protected/dossiers/${deal.id}`);
}

export async function updateDealAction(formData: FormData) {
  const supabase = await createClient();
  const dealId = ns(formData.get("deal_id"));
  if (!dealId) throw new Error("ID manquant");

  // M5 : Lire le statut actuel avant mise à jour
  const { data: currentDeal } = await supabase
    .from("deals")
    .select("deal_status")
    .eq("id", dealId)
    .maybeSingle();

  const targetAmount = formData.get("target_amount");

  // Champs de base (toujours présents dans le form)
  const updateData: Record<string, unknown> = {
    name:           ns(formData.get("name")),
    deal_type:      ns(formData.get("deal_type")),
    deal_status:    ns(formData.get("deal_status")),
    deal_stage:     ns(formData.get("deal_stage")),
    priority_level: ns(formData.get("priority_level")),
    sector:         ns(formData.get("sector")),
    location:       ns(formData.get("location")),
    description:    ns(formData.get("description")),
    start_date:     ns(formData.get("start_date")),
    target_date:       ns(formData.get("target_date")),
    next_action_date:  ns(formData.get("next_action_date")),
    target_amount:     targetAmount ? Number(targetAmount) : null,
    currency:       ns(formData.get("currency")) ?? "EUR",
    mandate_id:     ns(formData.get("mandate_id")),
  };

  // Matching investisseur (fundraising / M&A) — seulement si champs présents dans le form
  if (formData.has("company_stage")) updateData.company_stage = ns(formData.get("company_stage"));
  if (formData.has("company_geography")) updateData.company_geography = ns(formData.get("company_geography"));

  // Recrutement — seulement si champs présents dans le form
  if (formData.has("job_title")) updateData.job_title = ns(formData.get("job_title"));
  if (formData.has("required_seniority")) updateData.required_seniority = ns(formData.get("required_seniority"));
  if (formData.has("required_location")) updateData.required_location = ns(formData.get("required_location"));
  if (formData.has("required_remote")) updateData.required_remote = ns(formData.get("required_remote"));
  if (formData.has("salary_min")) updateData.salary_min = formData.get("salary_min") ? Number(formData.get("salary_min")) : null;
  if (formData.has("salary_max")) updateData.salary_max = formData.get("salary_max") ? Number(formData.get("salary_max")) : null;

  const { error } = await supabase.from("deals").update(updateData).eq("id", dealId);

  if (error) throw new Error(error.message);

  // M5 trigger : deal_status → "won" → flaguer les candidats non-closing à revoir
  const newStatus = ns(formData.get("deal_status"));
  if (newStatus === "won" && currentDeal?.deal_status !== "won") {
    await supabase
      .from("deal_candidates")
      .update({ needs_review: true })
      .eq("deal_id", dealId)
      .neq("stage", "closing");
  }

  revalidatePath(`/protected/dossiers/${dealId}`);
  redirect(`/protected/dossiers/${dealId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Wizard de création de dossier (3 étapes)
//   1. Identité + dirigeant + mandat (création inline possible)
//   2. Spécificités par deal_type (Fundraising / M&A Sell / M&A Buy / RH / CFO)
//   3. Données financières initiales N-1 (optionnelles)
// ═══════════════════════════════════════════════════════════════════════════

export interface WizardDealPayload {
  // Step 1 — identité
  name: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  priority_level: string;
  sector: string | null;
  location: string | null;
  company_stage: string | null;
  company_geography: string | null;
  start_date: string | null;
  target_date: string | null;
  description: string | null;
  currency: string;

  // Liens existants ou créations
  // V54 : client_organization_id devient obligatoire (le dossier est toujours
  // rattaché à une organisation cliente = sujet du dossier).
  client_organization_id: string | null;
  // V54 : taille d'entreprise. Si renseignée, met à jour
  // organizations.company_stage de l'organisation cliente.
  client_organization_stage: string | null;
  dirigeant_id: string | null;
  dirigeant_nom: string | null;
  dirigeant_email: string | null;
  dirigeant_telephone: string | null;
  dirigeant_titre: string | null;
  mandate_id: string | null;
  // Création mandat inline (si non nul, on crée puis on lie)
  create_mandate?: {
    name: string;
    type: string;
    client_organization_id: string;
    start_date: string | null;
    target_close_date: string | null;
    currency: string;
  } | null;

  // Step 2 — spécificités
  // Fundraising
  target_raise_amount: number | null;
  pre_money_valuation: number | null;
  post_money_valuation: number | null;
  use_of_funds: string | null;
  runway_months: number | null;
  round_type: string | null;
  current_investors: string[] | null;
  // M&A Sell
  target_amount: number | null;
  asking_price_min: number | null;
  asking_price_max: number | null;
  partial_sale_ok: boolean | null;
  management_retention: boolean | null;       // flag pur (utilisé par ma-scoring)
  management_retention_notes: string | null;  // earn-out, durée, clauses (v44)
  deal_timing: string | null;
  // M&A Buy
  target_sectors: string[] | null;
  excluded_sectors: string[] | null;
  target_geographies: string[] | null;
  excluded_geographies: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ev_min: number | null;
  target_ev_max: number | null;
  target_stage: string | null;
  acquisition_budget_min: number | null;
  acquisition_budget_max: number | null;
  full_acquisition_required: boolean | null;
  strategic_rationale: string | null;
  // Recruitment
  job_title: string | null;
  required_seniority: string | null;
  required_location: string | null;
  required_remote: string | null;
  salary_min: number | null;
  salary_max: number | null;

  // Step 3 — données financières (optionnel)
  financial: {
    fiscal_year: number;
    revenue: number | null;
    gross_margin: number | null;
    ebitda: number | null;
    ebitda_margin: number | null;
    headcount: number | null;
    arr: number | null;
    mrr: number | null;
    nrr: number | null;
    churn_rate: number | null;
  } | null;
}

export type WizardResult =
  | { success: true; id: string; warnings: string[] }
  | { success: false; error: string };

export async function createDealWizardAction(
  payload: WizardDealPayload,
): Promise<WizardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const name = payload.name.trim();
  if (!name) return { success: false, error: "Nom du dossier obligatoire" };
  if (!payload.deal_type) return { success: false, error: "Type de mission obligatoire" };
  if (!payload.client_organization_id) {
    return { success: false, error: "Organisation cliente obligatoire (sujet du dossier)" };
  }

  const warnings: string[] = [];

  // V54 : mise à jour de la taille d'entreprise de l'organisation cliente
  // si renseignée depuis le wizard. Non bloquant.
  if (payload.client_organization_stage) {
    const { error: stageErr } = await supabase
      .from("organizations")
      .update({ company_stage: payload.client_organization_stage })
      .eq("id", payload.client_organization_id)
      .eq("user_id", user.id);
    if (stageErr) warnings.push(`Taille d'entreprise : ${stageErr.message}`);
  }

  // 1. Création mandat inline si demandée (avant le deal pour pouvoir le lier)
  let mandateId = payload.mandate_id;
  if (payload.create_mandate) {
    const m = payload.create_mandate;
    if (!m.name.trim() || !m.client_organization_id) {
      return { success: false, error: "Mandat : nom et client obligatoires" };
    }
    const res = await createMandate({
      name: m.name.trim(),
      type: m.type,
      client_organization_id: m.client_organization_id,
      start_date: m.start_date,
      target_close_date: m.target_close_date,
      currency: m.currency,
      status: "draft",
      priority: "medium",
    });
    if (!res.success) {
      return { success: false, error: `Mandat : ${res.error}` };
    }
    mandateId = res.id;
  }

  // 2. Création du deal avec tous les champs identité + spécificités
  const dealInsert: Record<string, unknown> = {
    user_id: user.id,
    name,
    deal_type: payload.deal_type,
    deal_status: payload.deal_status || "open",
    deal_stage: payload.deal_stage || "kickoff",
    priority_level: payload.priority_level || "medium",
    sector: payload.sector,
    location: payload.location,
    company_stage: payload.company_stage,
    company_geography: payload.company_geography,
    start_date: payload.start_date,
    target_date: payload.target_date,
    description: payload.description,
    currency: payload.currency || "EUR",
    mandate_id: mandateId,
    // V54 : le sujet du dossier = l'organisation cliente. FK directe sur deals.
    organization_id: payload.client_organization_id,
    client_organization_id: null, // legacy column, remplacée par organization_id
    // Dirigeant structuré
    dirigeant_id: payload.dirigeant_id,
    dirigeant_nom: payload.dirigeant_nom,
    dirigeant_email: payload.dirigeant_email,
    dirigeant_telephone: payload.dirigeant_telephone,
    dirigeant_titre: payload.dirigeant_titre,
  };

  // Spécificités par deal_type (on pousse tout, les colonnes nullable ignorent le reste)
  switch (payload.deal_type) {
    case "fundraising":
      dealInsert.target_raise_amount = payload.target_raise_amount;
      dealInsert.pre_money_valuation = payload.pre_money_valuation;
      dealInsert.post_money_valuation = payload.post_money_valuation;
      dealInsert.use_of_funds = payload.use_of_funds;
      dealInsert.runway_months = payload.runway_months;
      dealInsert.round_type = payload.round_type;
      dealInsert.current_investors = payload.current_investors?.length ? payload.current_investors : null;
      break;
    case "ma_sell":
      dealInsert.target_amount = payload.target_amount;
      dealInsert.asking_price_min = payload.asking_price_min;
      dealInsert.asking_price_max = payload.asking_price_max;
      dealInsert.partial_sale_ok = payload.partial_sale_ok;
      dealInsert.management_retention = payload.management_retention;
      dealInsert.management_retention_notes = payload.management_retention_notes;
      dealInsert.deal_timing = payload.deal_timing;
      break;
    case "ma_buy":
      dealInsert.target_sectors = payload.target_sectors?.length ? payload.target_sectors : null;
      dealInsert.excluded_sectors = payload.excluded_sectors?.length ? payload.excluded_sectors : null;
      dealInsert.target_geographies = payload.target_geographies?.length ? payload.target_geographies : null;
      dealInsert.excluded_geographies = payload.excluded_geographies?.length ? payload.excluded_geographies : null;
      dealInsert.target_revenue_min = payload.target_revenue_min;
      dealInsert.target_revenue_max = payload.target_revenue_max;
      dealInsert.target_ev_min = payload.target_ev_min;
      dealInsert.target_ev_max = payload.target_ev_max;
      dealInsert.target_stage = payload.target_stage;
      dealInsert.acquisition_budget_min = payload.acquisition_budget_min;
      dealInsert.acquisition_budget_max = payload.acquisition_budget_max;
      dealInsert.full_acquisition_required = payload.full_acquisition_required;
      dealInsert.strategic_rationale = payload.strategic_rationale;
      dealInsert.deal_timing = payload.deal_timing;
      break;
    case "recruitment":
      dealInsert.job_title = payload.job_title;
      dealInsert.required_seniority = payload.required_seniority;
      dealInsert.required_location = payload.required_location;
      dealInsert.required_remote = payload.required_remote;
      dealInsert.salary_min = payload.salary_min;
      dealInsert.salary_max = payload.salary_max;
      break;
    case "cfo_advisor":
      dealInsert.target_amount = payload.target_amount;
      break;
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .insert(dealInsert)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  if (!deal?.id) return { success: false, error: "Erreur création dossier" };

  // 3. V54 : la liaison client est maintenant capturée par deals.organization_id
  // (écrit à l'étape 2). Plus de double-saisie via deal_organizations role='client'.
  // Les autres rôles (banque, avocat, cible, acquéreur, investisseur...) restent
  // gérés via deal_organizations depuis deal-detail.tsx.

  // 4. Données financières N-1 (optionnel, non bloquant)
  if (payload.financial) {
    const f = payload.financial;
    const u = (v: number | null) => (v == null ? undefined : v);
    try {
      await upsertFinancialData({
        deal_id: deal.id,
        fiscal_year: f.fiscal_year,
        period_type: "annual",
        currency: payload.currency || "EUR",
        revenue: u(f.revenue),
        gross_margin: u(f.gross_margin),
        ebitda: u(f.ebitda),
        ebitda_margin: u(f.ebitda_margin),
        headcount: u(f.headcount),
        arr: u(f.arr),
        mrr: u(f.mrr),
        nrr: u(f.nrr),
        churn_rate: u(f.churn_rate),
        source: "manual",
      });
    } catch (e) {
      warnings.push(`Données financières non enregistrées : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  revalidatePath("/protected/dossiers");
  return { success: true, id: deal.id, warnings };
}
