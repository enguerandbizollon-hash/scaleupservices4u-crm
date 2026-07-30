"use server";

// Prospection marché & univers (phase 2, temps 2).
// Profils de chasse (RLS user), compteur live, exécution → univers_entreprises
// (PK siren, upsert qui PRÉSERVE le statut de tri et first_seen_at),
// gestion des statuts et promotion vers organizations (dédup SIREN v64).
// NB : distinct de actions/screening.ts (screening de qualification d'un
// dossier, V53) — ici on parle du screening MARCHÉ (trouver des cédants).

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  countScreening,
  findDirigeantPrincipal,
  runScreening,
  type ScreeningFilters,
  type ScreeningHit,
} from "@/lib/connectors/recherche-entreprises";
import { sectorFromNaf } from "@/lib/crm/matching-maps";
import { computeCedabilite } from "@/lib/crm/cedabilite";
import {
  fetchEntreprisePappers,
  normalizeBeneficiaires,
  mergeFinancesPappers,
  isPappersConfigured,
  type ActionnaireNormalise,
} from "@/lib/connectors/pappers";

const UPSERT_BATCH = 500;

export type UniversStatut = "nouveau" | "a_approcher" | "approche" | "ecarte" | "promu";
const VALID_STATUTS: readonly UniversStatut[] = ["nouveau", "a_approcher", "approche", "ecarte", "promu"];

export type ProspectionActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Profils ──────────────────────────────────────────────────────────────────

export interface ScreeningProfileRow {
  id: string;
  name: string;
  filters: ScreeningFilters;
  last_run_at: string | null;
  last_total_results: number | null;
  watch_enabled: boolean;
}

export async function listScreeningProfiles(): Promise<ScreeningProfileRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("screening_profiles")
    .select("id, name, filters, last_run_at, last_total_results, watch_enabled")
    .order("created_at", { ascending: true });
  return (data ?? []) as ScreeningProfileRow[];
}

export async function saveScreeningProfile(input: {
  id?: string | null;
  name: string;
  filters: ScreeningFilters;
}): Promise<ProspectionActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  const name = input.name.trim();
  if (!name) return { success: false, error: "Nom du profil requis" };

  if (input.id) {
    const { error } = await supabase
      .from("screening_profiles")
      .update({ name, filters: input.filters, updated_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/protected/prospection");
    return { success: true, data: { id: input.id } };
  }

  const { data, error } = await supabase
    .from("screening_profiles")
    .insert({ user_id: user.id, name, filters: input.filters })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: { id: data.id } };
}

/** Active/désactive la veille hebdomadaire d'un profil (cron veille-profils). */
export async function toggleProfileWatch(
  id: string,
  enabled: boolean,
): Promise<ProspectionActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  const { error } = await supabase
    .from("screening_profiles")
    .update({ watch_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: undefined };
}

export async function deleteScreeningProfile(id: string): Promise<ProspectionActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  const { error } = await supabase.from("screening_profiles").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: undefined };
}

// ── Compteur live ────────────────────────────────────────────────────────────

export async function countScreeningAction(
  filters: ScreeningFilters,
): Promise<ProspectionActionResult<{ total: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  try {
    const total = await countScreening(filters);
    return { success: true, data: { total } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur API" };
  }
}

// ── Exécution → univers ──────────────────────────────────────────────────────

function universRowFromHit(hit: ScreeningHit, profileId: string | null, nowIso: string) {
  const { raw, normalized } = hit;
  const naf = normalized.activite_principale_code;
  const dirigeants = (raw.dirigeants ?? [])
    .filter((d) => !d.denomination && d.nom)
    .map((d) => ({
      nom: d.nom ?? null,
      prenoms: d.prenoms ?? null,
      qualite: d.qualite ?? d.type_dirigeant ?? null,
      date_de_naissance: d.date_de_naissance ?? null,
    }));

  return {
    siren: raw.siren,
    nom: normalized.name,
    naf,
    secteur: naf ? sectorFromNaf(naf) : null,
    departement: raw.siege?.departement ?? normalized.postal_code?.slice(0, 2) ?? null,
    ville: normalized.city,
    date_creation: raw.date_creation ?? null,
    effectif_code: raw.tranche_effectif_salarie ?? null,
    effectif_label: normalized.effectif_label,
    categorie: normalized.category,
    finances: raw.finances ?? {},
    dirigeants,
    age_dirigeant_principal: hit.dirigeant_principal?.age ?? null,
    source_profile_id: profileId,
    last_seen_at: nowIso,
    updated_at: nowIso,
    // statut et first_seen_at ABSENTS volontairement : préservés à l'upsert.
  };
}

export interface ProspectionRunSummary {
  imported: number;
  total_api: number;
  filtered_out: number;
  truncated: boolean;
  queries: number;
}

export async function runScreeningIngest(input: {
  profileId?: string | null;
  filters: ScreeningFilters;
}): Promise<ProspectionActionResult<ProspectionRunSummary>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  try {
    // Garde-fou timeout : un run manuel reste sous la fenêtre API (10 000).
    // Au-delà, on demande d'affiner — l'univers de 50k se construit par
    // plusieurs chasses, pas par une seule requête-monstre.
    const total = await countScreening(input.filters);
    if (total > 10_000) {
      return {
        success: false,
        error: `${total.toLocaleString("fr-FR")} résultats : affinez les filtres (maximum 10 000 par chasse).`,
      };
    }

    const result = await runScreening(input.filters, { maxResults: 10_000 });
    const nowIso = new Date().toISOString();
    const rows = result.hits.map((h) => universRowFromHit(h, input.profileId ?? null, nowIso));

    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const { error } = await supabase
        .from("univers_entreprises")
        .upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: "siren" });
      if (error) return { success: false, error: `Univers : ${error.message}` };
    }

    if (input.profileId) {
      await supabase
        .from("screening_profiles")
        .update({ last_run_at: nowIso, last_total_results: result.hits.length })
        .eq("id", input.profileId);
    }

    revalidatePath("/protected/prospection");
    return {
      success: true,
      data: {
        imported: rows.length,
        total_api: result.total_api,
        filtered_out: result.filtered_out,
        truncated: result.truncated,
        queries: result.queries,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur screening" };
  }
}

// ── Radar de cédabilité (temps 4) ────────────────────────────────────────────

/**
 * Recalcule le score de cédabilité de tout l'univers, par pages de 500,
 * en croisant les signaux BODACC portés par chaque SIREN. Déterministe,
 * relançable à volonté (gratuit).
 */
export async function recomputeCedabilite(): Promise<ProspectionActionResult<{ scored: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const nowIso = new Date().toISOString();
  let scored = 0;

  for (let from = 0; ; from += 500) {
    const { data: page, error } = await supabase
      .from("univers_entreprises")
      .select("siren, nom, age_dirigeant_principal, date_creation, finances, dirigeants")
      .order("siren", { ascending: true })
      .range(from, from + 499);
    if (error) return { success: false, error: error.message };
    if (!page || page.length === 0) break;

    const { data: sigs } = await supabase
      .from("signaux")
      .select("siren, signal_type")
      .in("siren", page.map((p) => p.siren));
    const typesBySiren = new Map<string, string[]>();
    for (const s of sigs ?? []) {
      const arr = typesBySiren.get(s.siren) ?? [];
      arr.push(s.signal_type);
      typesBySiren.set(s.siren, arr);
    }

    const updates = page.map((f) => {
      const r = computeCedabilite(
        {
          age_dirigeant_principal: f.age_dirigeant_principal,
          date_creation: f.date_creation,
          finances: f.finances,
          dirigeants: f.dirigeants,
        },
        { types: typesBySiren.get(f.siren) ?? [] },
      );
      // nom inclus : requis par le chemin INSERT de l'upsert (NOT NULL),
      // jamais emprunté en pratique puisque toutes les lignes existent.
      return {
        siren: f.siren,
        nom: f.nom,
        cedabilite_score: r.score,
        cedabilite_raisons: r.raisons,
        updated_at: nowIso,
      };
    });

    const { error: upErr } = await supabase
      .from("univers_entreprises")
      .upsert(updates, { onConflict: "siren" });
    if (upErr) return { success: false, error: upErr.message };

    scored += updates.length;
    if (page.length < 500) break;
  }

  revalidatePath("/protected/prospection");
  return { success: true, data: { scored } };
}

// ── Univers : tri et promotion ───────────────────────────────────────────────

export async function updateUniversStatut(
  siren: string,
  statut: UniversStatut,
): Promise<ProspectionActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (!VALID_STATUTS.includes(statut)) return { success: false, error: "Statut invalide" };

  const { error } = await supabase
    .from("univers_entreprises")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("siren", siren);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: undefined };
}

interface FichePourPromotion {
  siren: string;
  nom: string;
  naf: string | null;
  secteur: string | null;
  ville: string | null;
  date_creation: string | null;
}

/**
 * Garantit une organisation CRM pour une fiche univers.
 * Dédup par SIREN d'abord (règle v64) : si une organisation porte déjà ce
 * SIREN, on rattache sans créer de doublon. Partagé entre la promotion
 * simple et la création de dossier.
 */
async function ensureOrganizationFromFiche(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fiche: FichePourPromotion,
): Promise<{ orgId: string; created: boolean } | { error: string }> {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("siren", fiche.siren)
    .maybeSingle();
  if (existing?.id) return { orgId: existing.id, created: false };

  const foundedYear = fiche.date_creation ? parseInt(String(fiche.date_creation).slice(0, 4), 10) : null;
  const { data: org, error } = await supabase
    .from("organizations")
    .insert({
      user_id: userId,
      name: fiche.nom,
      organization_type: "other",
      base_status: "to_qualify",
      siren: fiche.siren,
      naf: fiche.naf,
      sector: fiche.secteur,
      location: fiche.ville,
      country: "France",
      founded_year: Number.isFinite(foundedYear as number) ? foundedYear : null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { orgId: org.id, created: true };
}

/**
 * Promotion d'une fiche univers vers une organisation CRM réelle.
 */
export async function promoteUniversToOrganization(
  siren: string,
): Promise<ProspectionActionResult<{ organization_id: string; created: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, ville, departement, date_creation")
    .eq("siren", siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const ensured = await ensureOrganizationFromFiche(supabase, user.id, fiche);
  if ("error" in ensured) return { success: false, error: ensured.error };

  const { error: linkErr } = await supabase
    .from("univers_entreprises")
    .update({ statut: "promu", organization_id: ensured.orgId, updated_at: new Date().toISOString() })
    .eq("siren", siren);
  if (linkErr) return { success: false, error: linkErr.message };

  revalidatePath("/protected/prospection");
  revalidatePath("/protected/organisations");
  return { success: true, data: { organization_id: ensured.orgId, created: ensured.created } };
}

// ── Fiche détail + création de dossier (retour d'usage 2026-07-29) ───────────
// « Quand on a trouvé une entreprise qui nous intéresse, la suite » :
// tout ce qui est déjà stocké devient visible (finances, dirigeants, raisons
// du score, signaux du SIREN), et la cible chaude devient un dossier en un clic.

export interface UniversDirigeant {
  nom: string | null;
  prenoms: string | null;
  qualite: string | null;
  date_de_naissance: string | null;
}

export interface UniversSignalItem {
  id: string;
  signal_type: string;
  signal_date: string;
  titre: string;
  severity: string;
}

export interface UniversFinanceYear {
  ca?: number | null;
  resultat_net?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  marge_nette?: number | null;
  dettes_financieres?: number | null;
  tresorerie?: number | null;
  caf?: number | null;
  effectif?: number | null;
  croissance_ca?: number | null;
}

export interface UniversFicheDetail {
  siren: string;
  nom: string;
  naf: string | null;
  secteur: string | null;
  departement: string | null;
  ville: string | null;
  date_creation: string | null;
  effectif_label: string | null;
  categorie: string | null;
  finances: Record<string, UniversFinanceYear>;
  dirigeants: UniversDirigeant[];
  age_dirigeant_principal: number | null;
  cedabilite_score: number | null;
  cedabilite_raisons: string[] | null;
  statut: string;
  organization_id: string | null;
  first_seen_at: string;
  actionnariat: ActionnaireNormalise[] | null;
  actionnariat_updated_at: string | null;
  signaux: UniversSignalItem[];
  deal: { id: string; name: string } | null;
}

export async function getUniversFicheDetail(
  siren: string,
): Promise<ProspectionActionResult<UniversFicheDetail>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: fiche, error } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, departement, ville, date_creation, effectif_label, categorie, finances, dirigeants, age_dirigeant_principal, cedabilite_score, cedabilite_raisons, statut, organization_id, first_seen_at, actionnariat, actionnariat_updated_at")
    .eq("siren", siren)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const { data: signaux } = await supabase
    .from("signaux")
    .select("id, signal_type, signal_date, titre, severity")
    .eq("siren", siren)
    .order("signal_date", { ascending: false })
    .limit(20);

  let deal: { id: string; name: string } | null = null;
  if (fiche.organization_id) {
    const { data: d } = await supabase
      .from("deals")
      .select("id, name")
      .eq("organization_id", fiche.organization_id)
      .eq("user_id", user.id)
      .eq("deal_status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    deal = d ?? null;
  }

  return {
    success: true,
    data: { ...(fiche as Omit<UniversFicheDetail, "signaux" | "deal">), signaux: (signaux ?? []) as UniversSignalItem[], deal },
  };
}

/**
 * Traduit le JSONB finances d'une fiche univers en lignes financial_data
 * du dossier (3 derniers exercices). CA/RN viennent de l'API gratuite,
 * EBITDA/dettes/trésorerie de Pappers quand la fiche a été enrichie.
 */
function financialRowsFromFiche(
  finances: Record<string, UniversFinanceYear> | null | undefined,
  dealId: string,
  orgId: string,
  userId: string,
) {
  const years = Object.keys(finances ?? {})
    .filter((y) => /^\d{4}$/.test(y))
    .sort()
    .reverse()
    .slice(0, 3);
  return years
    .map((y) => {
      const f = finances![y] ?? {};
      const netDebt = f.dettes_financieres != null && f.tresorerie != null
        ? f.dettes_financieres - f.tresorerie
        : null;
      const row = {
        user_id: userId,
        deal_id: dealId,
        organization_id: orgId,
        fiscal_year: parseInt(y, 10),
        period_type: "annual",
        currency: "EUR",
        revenue: f.ca ?? null,
        net_income: f.resultat_net ?? null,
        ebitda: f.ebitda ?? null,
        ebit: f.ebit ?? null,
        net_debt: netDebt,
        cash: f.tresorerie ?? null,
        headcount: f.effectif ?? null,
        revenue_growth: f.croissance_ca ?? null,
        is_forecast: false,
        source: "api",
      };
      // Une ligne sans aucune donnée n'apporte rien.
      const hasData = row.revenue != null || row.net_income != null || row.ebitda != null;
      return hasData ? row : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Import des exercices de la fiche prospection dans le financier d'un
 * dossier EXISTANT (né avant le zéro-ressaisie, ou vidé). N'écrit que si
 * le financier est vide : jamais de doublon, jamais d'écrasement.
 */
export async function importFinancesFromFiche(
  dealId: string,
): Promise<ProspectionActionResult<{ inserted: number; rows: Record<string, unknown>[] }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, organization_id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return { success: false, error: "Dossier introuvable" };
  if (!deal.organization_id) return { success: false, error: "Dossier sans organisation cliente : rattachez-la d'abord" };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, siren")
    .eq("id", deal.organization_id)
    .maybeSingle();
  if (!org?.siren) return { success: false, error: "L'organisation n'a pas de SIREN : pas de fiche prospection à importer" };

  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, finances")
    .eq("siren", org.siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Aucune fiche prospection pour ce SIREN" };

  const { count } = await supabase
    .from("financial_data")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", dealId);
  if ((count ?? 0) > 0) return { success: false, error: "Le financier contient déjà des exercices : import refusé pour ne rien écraser" };

  const rows = financialRowsFromFiche(fiche.finances, dealId, org.id, user.id);
  if (rows.length === 0) return { success: false, error: "La fiche prospection n'a aucun exercice publié" };

  const { data: inserted, error } = await supabase
    .from("financial_data")
    .insert(rows)
    .select("*");
  if (error) return { success: false, error: error.message };

  revalidatePath(`/protected/dossiers/${dealId}`);
  return { success: true, data: { inserted: inserted?.length ?? rows.length, rows: inserted ?? [] } };
}

/**
 * Enrichissement Pappers d'une fiche univers (Deal OS, chantier B) :
 * actionnariat (bénéficiaires effectifs, répartition + âges) et finances
 * profondes (EBE/EBITDA, dettes, trésorerie) fusionnées dans le JSONB
 * finances. Si la fiche est promue, l'organisation reçoit l'actionnariat.
 * Coût : 1 appel /entreprise (jetons Pappers).
 */
export async function enrichFicheFromPappers(
  siren: string,
): Promise<ProspectionActionResult<{ beneficiaires: number; annees_finances: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (!isPappersConfigured()) {
    return { success: false, error: "PAPPERS_API_KEY manquante dans .env.local" };
  }

  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, finances, organization_id")
    .eq("siren", siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const res = await fetchEntreprisePappers(siren);
  if (!res.ok) return { success: false, error: res.error };

  const actionnariat = normalizeBeneficiaires(res.fiche.beneficiaires_effectifs);
  const finances = mergeFinancesPappers(fiche.finances ?? {}, res.fiche.finances);
  const nowIso = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("univers_entreprises")
    .update({
      actionnariat: actionnariat.length > 0 ? actionnariat : null,
      actionnariat_updated_at: nowIso,
      finances,
      updated_at: nowIso,
    })
    .eq("siren", siren);
  if (upErr) return { success: false, error: upErr.message };

  if (fiche.organization_id && actionnariat.length > 0) {
    await supabase
      .from("organizations")
      .update({ actionnariat, actionnariat_updated_at: nowIso })
      .eq("id", fiche.organization_id);
  }

  revalidatePath("/protected/prospection");
  return {
    success: true,
    data: {
      beneficiaires: actionnariat.length,
      annees_finances: (res.fiche.finances ?? []).filter((f) => f.annee).length,
    },
  };
}

/**
 * La cible chaude devient un dossier M&A sell-side en un clic :
 * organisation garantie (dédup SIREN), dossier ouvert au stade kickoff avec
 * dirigeant principal prérempli, liaison pivot en rôle client. Si un dossier
 * ouvert existe déjà pour l'organisation, on le renvoie sans doubler.
 */
export async function createDossierFromUnivers(
  siren: string,
): Promise<ProspectionActionResult<{ deal_id: string; deal_name: string; organization_id: string; created_deal: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, ville, departement, date_creation, dirigeants, finances")
    .eq("siren", siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const ensured = await ensureOrganizationFromFiche(supabase, user.id, fiche);
  if ("error" in ensured) return { success: false, error: ensured.error };
  const orgId = ensured.orgId;

  const linkUnivers = () => supabase
    .from("univers_entreprises")
    .update({ statut: "promu", organization_id: orgId, updated_at: new Date().toISOString() })
    .eq("siren", siren);

  // Anti-doublon : un dossier ouvert existe déjà pour cette organisation.
  const { data: existingDeal } = await supabase
    .from("deals")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("deal_status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDeal) {
    await linkUnivers();
    revalidatePath("/protected/prospection");
    return {
      success: true,
      data: { deal_id: existingDeal.id, deal_name: existingDeal.name, organization_id: orgId, created_deal: false },
    };
  }

  // Dirigeant principal prérempli (même post-filtre qualité que le screening).
  const dirs = ((fiche.dirigeants ?? []) as UniversDirigeant[]).map((d) => ({
    nom: d.nom ?? undefined,
    prenoms: d.prenoms ?? undefined,
    qualite: d.qualite ?? undefined,
    date_de_naissance: d.date_de_naissance ?? undefined,
  }));
  const principal = findDirigeantPrincipal({ dirigeants: dirs });

  const dealName = `Cession ${fiche.nom}`;
  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      name: dealName,
      deal_type: "ma_sell",
      deal_status: "open",
      deal_stage: "kickoff",
      priority_level: "medium",
      organization_id: orgId,
      sector: fiche.secteur,
      location: fiche.ville,
      currency: "EUR",
      description: `Cible issue de la prospection marché (SIREN ${fiche.siren}).`,
      dirigeant_nom: principal ? [principal.prenoms, principal.nom].filter(Boolean).join(" ") : null,
      dirigeant_titre: principal?.qualite ?? null,
    })
    .select("id")
    .single();
  if (dealErr) return { success: false, error: dealErr.message };

  await supabase.from("deal_organizations").upsert(
    { deal_id: deal.id, organization_id: orgId, user_id: user.id, role_in_dossier: "client" },
    { onConflict: "deal_id,organization_id" },
  );

  // Zéro ressaisie (Deal OS, chantier B) : les exercices connus de la fiche
  // s'écrivent dans le financier du dossier le jour de sa naissance.
  const financialRows = financialRowsFromFiche(fiche.finances, deal.id, orgId, user.id);
  if (financialRows.length > 0) {
    await supabase.from("financial_data").insert(financialRows);
  }

  const { error: linkErr } = await linkUnivers();
  if (linkErr) return { success: false, error: linkErr.message };

  revalidatePath("/protected/prospection");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  return {
    success: true,
    data: { deal_id: deal.id, deal_name: dealName, organization_id: orgId, created_deal: true },
  };
}
