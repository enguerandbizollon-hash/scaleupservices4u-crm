// Cron Vercel : ingestion Gmail automatique (V57)
//
// Déclencheur : vercel.json → 4x/jour ouvré (lun-ven, heures Paris).
// Authentification : header Authorization: Bearer <CRON_SECRET>
//
// Pour chaque user disposant d'un token Gmail valide (lié à user_settings),
// lance syncGmailForUser. Les rate limits Gmail (250 quota units / user / sec)
// sont respectés naturellement par la taille du batch (MAX_MESSAGES_PER_RUN
// = 50) et la séquentialité dans l'orchestrateur.
//
// Si un user plante, le cron n'arrête pas les autres. Les erreurs sont
// agrégées dans la réponse pour observabilité.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailForUser } from "@/lib/connectors/gmail-ingest";
import { startCronRun, finishCronRun } from "@/lib/crm/cron-runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface SyncCandidate {
  user_id: string;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const runId = await startCronRun(admin, "gmail-sync");

  // Récupère tous les users qui ont un token Gmail valide (via user_settings)
  // ET dont la sync n'est pas désactivée. Un join logique côté code car la
  // sync state peut ne pas exister encore (créée à la volée à la 1ʳᵉ ingestion).
  const { data: settings, error: settingsErr } = await admin
    .from("user_settings")
    .select("user_id")
    .not("gcal_access_token", "is", null);

  if (settingsErr) {
    await finishCronRun(admin, runId, { ok: false, errors: [settingsErr.message] });
    return NextResponse.json({ error: settingsErr.message }, { status: 500 });
  }

  const candidates = (settings ?? []) as SyncCandidate[];

  // Filtre : on saute les users explicitement disabled
  const { data: disabled } = await admin
    .from("gmail_sync_state")
    .select("user_id")
    .eq("is_enabled", false);
  const disabledSet = new Set((disabled ?? []).map((r: { user_id: string }) => r.user_id));

  const eligible = candidates.filter((c) => !disabledSet.has(c.user_id));

  const results: { user_id: string; fetched: number; created: number; review: number; errors: number }[] = [];
  const globalErrors: string[] = [];

  for (const c of eligible) {
    try {
      const r = await syncGmailForUser(admin, c.user_id);
      results.push({
        user_id: c.user_id,
        fetched: r.fetched,
        created: r.created_actions,
        review: r.needs_review,
        errors: r.errors.length,
      });
      if (r.errors.length > 0) {
        globalErrors.push(`user ${c.user_id}: ${r.errors[0]}`);
      }
    } catch (err) {
      globalErrors.push(`user ${c.user_id}: ${err instanceof Error ? err.message : "erreur"}`);
    }
  }

  await finishCronRun(admin, runId, {
    ok: globalErrors.length === 0,
    summary: { users_processed: eligible.length, results },
    errors: globalErrors.slice(0, 10),
  });

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    users_processed: eligible.length,
    results,
    errors: globalErrors.slice(0, 10),
  });
}
