/**
 * lib/connectors/base.ts — Pattern ConnectorRecord et helpers communs
 *
 * Tous les connecteurs externes (Apollo, Harmonic, Vibe, Pappers, INSEE...)
 * doivent exposer leurs données via une forme normalisée ConnectorRecord
 * avant upsert dans la base CRM. Cela garantit :
 *   - Déduplication cohérente (normalized_name, website, linkedin_url)
 *   - Traçabilité source + external_id (pour ne jamais perdre l'origine)
 *   - Re-sync idempotent (upsert, pas insert)
 *
 * Voir CLAUDE.md §Connecteurs et §Déduplication organisations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Pattern standard ─────────────────────────────────────────────────────────

export interface ConnectorRecord {
  external_id: string;
  source: string;
  data: Record<string, unknown>;
}

export type ConnectorSourceValue =
  | "apollo" | "harmonic" | "vibe"
  | "pappers" | "insee"
  | "gmail"
  | "ai";

// ── Helpers déduplication ────────────────────────────────────────────────────

// Normalisation identique au trigger SQL `trg_set_normalized_name` (v31).
// Utilisée pour la recherche côté client avant insertion, sécurité double.
export function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9\s]/g, " ")    // ponctuation
    .replace(/\s+/g, " ")             // espaces multiples
    .trim();
}

// Extraction du domaine canonique depuis une URL ou un email.
// Retourne "fund.com" pour "https://www.fund.com", "contact@fund.com", etc.
export function extractDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  // Si c'est une adresse email
  if (trimmed.includes("@") && !trimmed.includes("://")) {
    const parts = trimmed.split("@");
    const domain = parts[1];
    if (!domain) return null;
    return domain.replace(/^www\./, "").split("/")[0] ?? null;
  }

  // Si c'est une URL
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    // Fallback : pas une URL valide, on prend tel quel si ressemble à un domaine
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) return trimmed.replace(/^www\./, "");
    return null;
  }
}

// Garde seulement les adresses email publiques B2B. Ignore les providers
// perso qui indiqueraient un domaine non représentatif de l'organisation.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "hotmail.fr",
  "outlook.com", "outlook.fr", "live.com", "icloud.com", "protonmail.com",
  "free.fr", "orange.fr", "wanadoo.fr", "laposte.net", "sfr.fr",
]);

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

// ── connector_runs helpers ───────────────────────────────────────────────────

export interface StartConnectorRunInput {
  userId: string;
  sourceConnector: ConnectorSourceValue;
  dealId?: string | null;
  triggeredBy?: "manual" | "cron" | "api";
  queryParams?: Record<string, unknown>;
}

export interface FinishConnectorRunInput {
  runId: string;
  status: "success" | "failure" | "partial";
  recordsFetched?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  suggestionsCreated?: number;
  errorMessage?: string | null;
  costEstimate?: number | null;
}

export async function startConnectorRun(
  supabase: SupabaseClient,
  input: StartConnectorRunInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("connector_runs")
    .insert({
      user_id: input.userId,
      source_connector: input.sourceConnector,
      deal_id: input.dealId ?? null,
      triggered_by: input.triggeredBy ?? "manual",
      query_params: input.queryParams ?? null,
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function finishConnectorRun(
  supabase: SupabaseClient,
  input: FinishConnectorRunInput,
): Promise<void> {
  await supabase
    .from("connector_runs")
    .update({
      completed_at: new Date().toISOString(),
      status: input.status,
      records_fetched: input.recordsFetched ?? 0,
      records_created: input.recordsCreated ?? 0,
      records_updated: input.recordsUpdated ?? 0,
      records_skipped: input.recordsSkipped ?? 0,
      suggestions_created: input.suggestionsCreated ?? 0,
      error_message: input.errorMessage ?? null,
      cost_estimate: input.costEstimate ?? null,
    })
    .eq("id", input.runId);
}

// ── Mapping interne CRM → taille d'entreprise (employee ranges) ──────────────

export function employeeRangeForCompanyStage(stage: string | null | undefined): [number, number] | null {
  switch (stage) {
    case "startup":      return [1, 10];
    case "pme":          return [10, 250];
    case "eti":          return [250, 5000];
    case "grand_groupe": return [5000, 100000];
    default:             return null;
  }
}
