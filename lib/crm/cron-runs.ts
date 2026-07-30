// Observabilité des crons (v71, cran 1) : chaque passage laisse une trace.
// Non bloquant par construction : un échec d'écriture dans cron_runs ne doit
// JAMAIS faire échouer le cron lui-même (l'observabilité est un témoin,
// pas un maillon).

import type { SupabaseClient } from "@supabase/supabase-js";

export async function startCronRun(
  supabase: SupabaseClient,
  job: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cron_runs")
    .insert({ job })
    .select("id")
    .single();
  if (error) {
    console.error(`cron_runs start (${job}): ${error.message}`);
    return null;
  }
  return data?.id ?? null;
}

export async function finishCronRun(
  supabase: SupabaseClient,
  runId: string | null,
  result: { ok: boolean; summary?: Record<string, unknown>; errors?: string[] },
): Promise<void> {
  if (!runId) return;
  const { error } = await supabase
    .from("cron_runs")
    .update({
      finished_at: new Date().toISOString(),
      ok: result.ok,
      summary: result.summary ?? null,
      errors: result.errors ?? [],
    })
    .eq("id", runId);
  if (error) console.error(`cron_runs finish (${runId}): ${error.message}`);
}
