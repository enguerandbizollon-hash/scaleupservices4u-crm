import { createClient } from "@/lib/supabase/server";

// ── Interface connecteur ─────────────────────────────────────────────────

export interface InvestorProfile {
  name: string;
  investor_ticket_min?: number;
  investor_ticket_max?: number;
  investor_sectors?: string[];
  investor_stages?: string[];
  investor_geographies?: string[];
  investor_thesis?: string;
  website?: string;
  location?: string;
}

export interface InvestorConnector {
  source: string;
  sync(): Promise<InvestorProfile[]>;
}

// ── Upsert depuis une source externe ────────────────────────────────────

export async function upsertInvestorsFromSource(
  investors: InvestorProfile[],
  source: string,
  userId: string,
): Promise<{ inserted: number; updated: number; errors: number }> {
  const supabase = await createClient();
  let inserted = 0, updated = 0, errors = 0;

  for (const inv of investors) {
    if (!inv.name?.trim()) continue;
    // Chercher par nom exact (insensible à la casse)
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", inv.name.trim())
      .maybeSingle();

    const payload: Record<string, unknown> = {
      organization_type: "investor",
      investor_source: source,
      investor_ticket_min: inv.investor_ticket_min ?? null,
      investor_ticket_max: inv.investor_ticket_max ?? null,
      investor_sectors: inv.investor_sectors ?? [],
      investor_stages: inv.investor_stages ?? [],
      investor_geographies: inv.investor_geographies ?? [],
      investor_thesis: inv.investor_thesis ?? null,
    };
    if (inv.website)  payload.website  = inv.website;
    if (inv.location) payload.location = inv.location;

    if (existing) {
      const { error } = await supabase
        .from("organizations")
        .update(payload)
        .eq("id", existing.id);
      error ? errors++ : updated++;
    } else {
      const { error } = await supabase
        .from("organizations")
        .insert({ name: inv.name.trim(), user_id: userId, base_status: "to_qualify", ...payload });
      error ? errors++ : inserted++;
    }
  }

  return { inserted, updated, errors };
}

// ── TODO: connecteurs futurs ─────────────────────────────────────────────
// TODO: connector [Harmonic] — https://harmonic.ai — sync fonds VC
// TODO: connector [Crunchbase] — https://crunchbase.com — investisseurs actifs
// TODO: connector [PitchBook] — https://pitchbook.com — données institutionnelles
// TODO: connector [LinkedIn Sales Navigator] — scraping profils fonds
// TODO: connector [CSV Import] — via /api/import/deal-dataset (already exists)
