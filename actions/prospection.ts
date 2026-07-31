"use server";

// Prospection marché & univers (phase 2, temps 2).
// Profils de chasse (RLS user), compteur live, exécution → univers_entreprises
// (PK siren, upsert qui PRÉSERVE le statut de tri et first_seen_at),
// gestion des statuts et promotion vers organizations (dédup SIREN v64).
// NB : distinct de actions/screening.ts (screening de qualification d'un
// dossier, V53) — ici on parle du screening MARCHÉ (trouver des cédants).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  countScreening,
  findDirigeantPrincipal,
  runScreening,
  type ScreeningFilters,
} from "@/lib/connectors/recherche-entreprises";
import { computeCedabilite } from "@/lib/crm/cedabilite";
import { fetchSignalTypesBySiren, scoreUniversRows, recomputeCedabiliteForSirens } from "@/lib/crm/cedabilite-ingest";
import { universRowFromHit, mergeFinancesReingest } from "@/lib/crm/univers-ingest";
import { autofillScreeningDraft } from "@/lib/crm/screening-autofill";
import { enqueueNotification } from "@/lib/crm/notifications";
import { upsertContact, linkContactToOrganisation } from "./contacts";
import {
  fetchEntreprisePappers,
  normalizeBeneficiaires,
  mergeFinancesPappers,
  isPappersConfigured,
  type ActionnaireNormalise,
} from "@/lib/connectors/pappers";
import { generateProspectBrief } from "@/lib/ai/prospect-brief";

const UPSERT_BATCH = 500;

// Cycle de vie commercial d'une fiche (v72) : echange = discussion en cours,
// dormant = « pas maintenant », réveillé automatiquement à dormant_until.
export type UniversStatut = "nouveau" | "a_approcher" | "approche" | "echange" | "dormant" | "ecarte" | "promu";
const VALID_STATUTS: readonly UniversStatut[] = ["nouveau", "a_approcher", "approche", "echange", "dormant", "ecarte", "promu"];

/** Réveil par défaut d'une fiche mise en dormance sans date : 6 mois. */
const DORMANT_DEFAULT_DAYS = 180;

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
// Mapping hit → ligne : lib/crm/univers-ingest.ts (partagé avec la veille).

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
    const bruts = result.hits.map((h) => universRowFromHit(h, input.profileId ?? null, nowIso));

    // Les finances Pappers déjà acquises survivent à la re-chasse (fusion,
    // revue 2026-07-30) : l'API gratuite rafraîchit CA/RN sans rien effacer.
    const financesBySiren = new Map<string, Record<string, Record<string, number | null | undefined>>>();
    for (let i = 0; i < bruts.length; i += UPSERT_BATCH) {
      const { data: exist } = await supabase
        .from("univers_entreprises")
        .select("siren, finances")
        .in("siren", bruts.slice(i, i + UPSERT_BATCH).map((r) => r.siren));
      for (const e of exist ?? []) financesBySiren.set(e.siren, e.finances ?? {});
    }
    const fusionnes = bruts.map((r) => ({
      ...r,
      finances: mergeFinancesReingest(financesBySiren.get(r.siren), r.finances),
    }));

    // Radar calculé à l'ingestion (cran 1) : chaque fiche ressort scorée,
    // signaux BODACC croisés, sans attendre le bouton de recalcul.
    const typesBySiren = await fetchSignalTypesBySiren(supabase, fusionnes.map((r) => r.siren));
    const rows = scoreUniversRows(fusionnes, typesBySiren);

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

    let typesBySiren: Map<string, string[]>;
    try {
      typesBySiren = await fetchSignalTypesBySiren(supabase, page.map((p) => p.siren));
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Lecture des signaux en échec" };
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
  options?: { dormantUntil?: string | null },
): Promise<ProspectionActionResult<{ dormant_until: string | null }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (!VALID_STATUTS.includes(statut)) return { success: false, error: "Statut invalide" };

  // Dormant : une date de réveil TOUJOURS posée (défaut 6 mois), sinon la
  // fiche dormirait pour toujours. Tout autre statut efface la date.
  let dormantUntil: string | null = null;
  if (statut === "dormant") {
    const asked = options?.dormantUntil?.slice(0, 10) ?? null;
    dormantUntil = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)
      ? asked
      : new Date(Date.now() + DORMANT_DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("univers_entreprises")
    .update({ statut, dormant_until: dormantUntil, updated_at: new Date().toISOString() })
    .eq("siren", siren);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: { dormant_until: dormantUntil } };
}

/** Mémoire commerciale de l'approche (v72) : contexte, échéances évoquées. */
export async function updateUniversApprocheNote(
  siren: string,
  note: string,
): Promise<ProspectionActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("univers_entreprises")
    .update({ approche_note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("siren", siren);
  if (error) return { success: false, error: error.message };
  revalidatePath("/protected/prospection");
  return { success: true, data: undefined };
}

/**
 * Triage par lot (cran 2, audit 2026-07-30 : ~100 clics pour 20 fiches).
 * Passe un ensemble de fiches au même statut en une décision. Les fiches
 * promues sont intouchables (leur statut est le reflet d'un fait CRM).
 */
export async function updateUniversStatutBatch(
  sirens: string[],
  statut: UniversStatut,
): Promise<ProspectionActionResult<{ updated: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };
  if (!VALID_STATUTS.includes(statut) || statut === "promu") {
    return { success: false, error: "Statut invalide" };
  }
  const cleaned = [...new Set(sirens)].filter((s) => /^\d{9}$/.test(s));
  if (cleaned.length === 0) return { success: false, error: "Aucune fiche sélectionnée" };

  // Dormant en lot : même règle qu'à l'unité, réveil par défaut à 6 mois
  // (jamais de dormante sans date). Tout autre statut efface la date.
  const dormantUntil = statut === "dormant"
    ? new Date(Date.now() + DORMANT_DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10)
    : null;

  let updated = 0;
  for (let i = 0; i < cleaned.length; i += UPSERT_BATCH) {
    const { data, error } = await supabase
      .from("univers_entreprises")
      .update({ statut, dormant_until: dormantUntil, updated_at: new Date().toISOString() })
      .in("siren", cleaned.slice(i, i + UPSERT_BATCH))
      .neq("statut", "promu")
      .select("siren");
    if (error) return { success: false, error: error.message };
    updated += data?.length ?? 0;
  }
  revalidatePath("/protected/prospection");
  return { success: true, data: { updated } };
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

/**
 * Le dirigeant d'une fiche univers devient un contact CRM lié à
 * l'organisation (pipeline métier 2026-07-30 : « si l'entreprise
 * m'intéresse, je dois avoir les contacts du dirigeant »).
 * - L'organisation est créée si besoin (dédup SIREN) mais le statut de la
 *   fiche NE change PAS : obtenir un contact n'est pas encore promouvoir.
 * - Dédup par (prénom, nom) parmi les contacts déjà liés à l'organisation :
 *   les dirigeants Pappers n'ont pas d'email, la dédup email ne joue pas.
 * - La recherche de coordonnées (Hunter/Apollo) se fait ensuite depuis la
 *   fiche contact via le bouton Enrichir existant.
 */
export async function promoteDirigeantToContact(
  siren: string,
  dirigeantIndex: number,
): Promise<ProspectionActionResult<{ contact_id: string; organization_id: string; created: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, ville, departement, date_creation, dirigeants, organization_id")
    .eq("siren", siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const dirigeant = ((fiche.dirigeants ?? []) as UniversDirigeant[])[dirigeantIndex];
  if (!dirigeant?.nom) return { success: false, error: "Dirigeant introuvable sur la fiche" };
  const firstName = dirigeant.prenoms?.trim() || "—";
  const lastName = dirigeant.nom.trim();

  // Organisation garantie, statut de la fiche inchangé.
  let orgId = fiche.organization_id as string | null;
  if (!orgId) {
    const ensured = await ensureOrganizationFromFiche(supabase, user.id, fiche);
    if ("error" in ensured) return { success: false, error: ensured.error };
    orgId = ensured.orgId;
    await supabase
      .from("univers_entreprises")
      .update({ organization_id: orgId, updated_at: new Date().toISOString() })
      .eq("siren", siren);
  }

  // Dédup (prénom, nom) parmi les contacts déjà liés à cette organisation.
  const { data: liens } = await supabase
    .from("organization_contacts")
    .select("contact_id, contacts(id, first_name, last_name)")
    .eq("organization_id", orgId);
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  for (const lien of liens ?? []) {
    const c = Array.isArray(lien.contacts) ? lien.contacts[0] : lien.contacts;
    if (c && norm(c.first_name) === norm(firstName) && norm(c.last_name) === norm(lastName)) {
      return { success: true, data: { contact_id: c.id, organization_id: orgId, created: false } };
    }
  }

  const created = await upsertContact({
    first_name: firstName,
    last_name: lastName,
    title: dirigeant.qualite ?? null,
    sector: fiche.secteur ?? null,
  });
  if (!created.success) return { success: false, error: created.error };

  const linked = await linkContactToOrganisation(created.id, orgId, dirigeant.qualite ?? undefined);
  if (!linked.success) {
    const linkError = "error" in linked && typeof linked.error === "string" ? linked.error : "Liaison contact-organisation en échec";
    return { success: false, error: linkError };
  }

  revalidatePath("/protected/prospection");
  revalidatePath("/protected/contacts");
  return { success: true, data: { contact_id: created.id, organization_id: orgId, created: true } };
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
  website: string | null;
  synthese: string | null;
  synthese_updated_at: string | null;
  signaux: UniversSignalItem[];
  deal: { id: string; name: string } | null;
  dormant_until: string | null;
  approche_note: string | null;
}

export async function getUniversFicheDetail(
  siren: string,
): Promise<ProspectionActionResult<UniversFicheDetail>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  const { data: fiche, error } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, departement, ville, date_creation, effectif_label, categorie, finances, dirigeants, age_dirigeant_principal, cedabilite_score, cedabilite_raisons, statut, organization_id, first_seen_at, actionnariat, actionnariat_updated_at, website, synthese, synthese_updated_at, dormant_until, approche_note")
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
 * Enrichissement 360 d'une fiche prospect (Deal OS, chantier B2) : en un
 * geste, Pappers si disponible (actionnariat + finances profondes,
 * tolérant aux échecs), puis recherche web + synthèse M&A rédigée par
 * l'IA (site officiel, activité, gouvernance, angle d'approche).
 * L'IA propose, l'utilisateur contrôle.
 */
export async function enrichProspect360(
  siren: string,
): Promise<ProspectionActionResult<{ website: string | null; pappers_note: string | null }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autorisé" };

  // 1. Pappers d'abord (la synthèse profite de l'actionnariat), sans bloquer.
  let pappersNote: string | null = null;
  if (isPappersConfigured()) {
    const p = await enrichFicheFromPappers(siren);
    if (!p.success) pappersNote = p.error;
  } else {
    pappersNote = "Pappers non configuré";
  }

  // 2. Relire la fiche fraîche + les signaux du SIREN.
  const { data: fiche } = await supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, ville, departement, date_creation, effectif_label, finances, dirigeants, actionnariat, cedabilite_raisons, website")
    .eq("siren", siren)
    .maybeSingle();
  if (!fiche) return { success: false, error: "Fiche univers introuvable" };

  const { data: signaux } = await supabase
    .from("signaux")
    .select("signal_type, signal_date, titre")
    .eq("siren", siren)
    .order("signal_date", { ascending: false })
    .limit(5);

  // 3. Synthèse M&A avec recherche web.
  const brief = await generateProspectBrief({
    nom: fiche.nom,
    siren: fiche.siren,
    naf: fiche.naf,
    secteur: fiche.secteur,
    ville: fiche.ville,
    departement: fiche.departement,
    date_creation: fiche.date_creation,
    effectif_label: fiche.effectif_label,
    finances: fiche.finances ?? {},
    dirigeants: (fiche.dirigeants ?? []) as UniversDirigeant[],
    actionnariat: (fiche.actionnariat ?? null) as ActionnaireNormalise[] | null,
    cedabilite_raisons: fiche.cedabilite_raisons,
    signaux: (signaux ?? []) as { signal_type: string; signal_date: string; titre: string }[],
  });
  if (!brief) {
    return {
      success: false,
      error: `Synthèse impossible : clé API absente, crédits Anthropic épuisés, ou réponse invalide${pappersNote ? ` · Pappers : ${pappersNote}` : ""}`,
    };
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("univers_entreprises")
    .update({
      website: brief.website ?? fiche.website ?? null,
      synthese: brief.synthese,
      synthese_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq("siren", siren);
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath("/protected/prospection");
  return { success: true, data: { website: brief.website ?? fiche.website ?? null, pappers_note: pappersNote } };
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

  // Les finances ont bougé : le radar suit immédiatement (cran 1).
  await recomputeCedabiliteForSirens(supabase, [siren]);

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

  // Le dossier naît avec son brouillon de screening (cran 1, audit 2026-07-30 :
  // « le geste n'a pas de suite »). Tâche de fond after() : la création répond
  // tout de suite, l'IA remplit les champs vides derrière, la cloche prévient.
  const dealId = deal.id;
  const userId = user.id;
  after(async () => {
    try {
      const admin = createAdminClient();
      const r = await autofillScreeningDraft(admin, userId, dealId);
      if (r.error) {
        console.error(`screening autofill ${dealId}: ${r.error}`);
        return;
      }
      if (r.filled) {
        await enqueueNotification(admin, {
          user_id: userId,
          kind: "screening_draft",
          title: `Brouillon de screening prêt : ${dealName}`,
          body: "Généré automatiquement à la création du dossier. Contrôlez, ajustez, validez.",
          link_url: `/protected/dossiers/${dealId}`,
          source_type: "deal",
          source_id: dealId,
          trigger_date: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (e) {
      console.error(`screening autofill ${dealId}:`, e instanceof Error ? e.message : e);
    }
  });

  revalidatePath("/protected/prospection");
  revalidatePath("/protected/dossiers");
  revalidatePath("/protected/organisations");
  return {
    success: true,
    data: { deal_id: deal.id, deal_name: dealName, organization_id: orgId, created_deal: true },
  };
}
