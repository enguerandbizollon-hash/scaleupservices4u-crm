// Cron horaire Vercel : génère les notifications de rappel d'actions
// et d'alertes jalons financiers en retard.
//
// Déclencheur : vercel.json → "schedule": "0 * * * *"
// Authentification : header Authorization: Bearer <CRON_SECRET>
// Vercel Cron injecte automatiquement ce header si CRON_SECRET est défini.
//
// Jobs exécutés séquentiellement :
//   1. Rappels d'actions (reminder_days) — historique V41.
//   2. Jalons fee_milestones pending dépassant due_date de 30+ jours (V52).
//
// L'upsert avec ignoreDuplicates + contrainte unique garantit qu'un
// passage répété du cron ne crée pas de doublon de notification.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueNotification } from "@/lib/crm/notifications";
import { startCronRun, finishCronRun } from "@/lib/crm/cron-runs";
import { computeAndPersistIntent, fetchMailRowsForThreads, type SuggestionForIntent } from "@/lib/crm/intent-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OVERDUE_THRESHOLD_DAYS = 30;

interface ActionForReminder {
  id: string;
  user_id: string;
  title: string;
  type: string;
  due_date: string;
  reminder_days: number[];
  deal_id: string | null;
}

interface OverdueMilestone {
  id: string;
  user_id: string;
  name: string;
  amount: number | null;
  currency: string | null;
  due_date: string;
  deal_id: string | null;
  deals: { name: string | null } | { name: string | null }[] | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86_400_000);
}

function buildLink(a: ActionForReminder): string | null {
  if (a.deal_id) return `/protected/dossiers/${a.deal_id}#action-${a.id}`;
  return null;
}

function buildBody(daysUntilDue: number, dueDate: string): string {
  if (daysUntilDue === 0) return `À faire aujourd'hui (${dueDate}).`;
  if (daysUntilDue === 1) return `À faire demain (${dueDate}).`;
  if (daysUntilDue > 0) return `À faire dans ${daysUntilDue} jours (${dueDate}).`;
  return `En retard de ${Math.abs(daysUntilDue)} jour(s) (${dueDate}).`;
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

  const supabase = createAdminClient();
  const runId = await startCronRun(supabase, "notifications");
  const today = todayISO();

  // ── Job 1 : rappels d'actions ─────────────────────────────────────────────
  const { data, error } = await supabase
    .from("actions")
    .select("id, user_id, title, type, due_date, reminder_days, deal_id")
    .eq("status", "open")
    .not("due_date", "is", null)
    .not("reminder_days", "is", null);

  if (error) {
    await finishCronRun(supabase, runId, { ok: false, errors: [error.message] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actions = (data ?? []) as ActionForReminder[];
  let scannedActions = 0;
  let queuedActions = 0;
  const errors: string[] = [];

  for (const a of actions) {
    scannedActions++;
    if (!a.reminder_days || a.reminder_days.length === 0) continue;
    const delta = daysBetween(today, a.due_date);
    if (!a.reminder_days.includes(delta)) continue;

    const res = await enqueueNotification(supabase, {
      user_id: a.user_id,
      kind: "action_reminder",
      title: `Rappel : ${a.title}`,
      body: buildBody(delta, a.due_date),
      link_url: buildLink(a),
      source_type: "action",
      source_id: a.id,
      trigger_date: today,
    });
    if (res.error) errors.push(`action ${a.id}: ${res.error}`);
    else queuedActions++;
  }

  // ── Job 2 : jalons fee_milestones pending en retard (V52) ─────────────────
  const overdueCutoff = new Date(Date.now() - OVERDUE_THRESHOLD_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  const { data: milestonesData, error: milestonesErr } = await supabase
    .from("fee_milestones")
    .select("id, user_id, name, amount, currency, due_date, deal_id, deals(name)")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lt("due_date", overdueCutoff);

  let scannedMilestones = 0;
  let queuedMilestones = 0;

  if (milestonesErr) {
    errors.push(`milestones query: ${milestonesErr.message}`);
  } else {
    const milestones = (milestonesData ?? []) as OverdueMilestone[];
    for (const m of milestones) {
      scannedMilestones++;
      const lateDays = Math.abs(daysBetween(today, m.due_date));
      const dealName = Array.isArray(m.deals)
        ? m.deals[0]?.name ?? null
        : m.deals?.name ?? null;
      const amountLabel = m.amount != null
        ? ` (${m.amount} ${m.currency ?? "EUR"})`
        : "";

      const res = await enqueueNotification(supabase, {
        user_id: m.user_id,
        kind: "fee_overdue",
        title: `Jalon en retard : ${m.name}${amountLabel}`,
        body: `En retard de ${lateDays} jour(s) depuis ${m.due_date}${dealName ? ` · Dossier : ${dealName}` : ""}.`,
        link_url: m.deal_id ? `/protected/dossiers/${m.deal_id}` : "/protected/dossiers",
        source_type: "fee_milestone",
        source_id: m.id,
        trigger_date: today,
      });
      if (res.error) errors.push(`milestone ${m.id}: ${res.error}`);
      else queuedMilestones++;
    }
  }

  // ── Job 3 : alertes RGPD — contacts avec rgpd_expiry_date < 30j
  // On notifie quand l'échéance approche (entre today et today + 30j).
  // Une seule notif par (user_id, kind, source_type, source_id, date)
  // grâce à l'index unique — donc tant que la date d'expiry ne change pas
  // et que today reste le même, le cron horaire n'en crée qu'une.
  const rgpdHorizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  let scannedRgpd = 0;
  let queuedRgpd = 0;

  // 3a. Contacts
  const { data: contactsRgpd, error: contactsRgpdErr } = await supabase
    .from("contacts")
    .select("id, user_id, first_name, last_name, rgpd_expiry_date")
    .not("rgpd_expiry_date", "is", null)
    .gte("rgpd_expiry_date", today)
    .lte("rgpd_expiry_date", rgpdHorizon);
  if (contactsRgpdErr) {
    errors.push(`contacts rgpd query: ${contactsRgpdErr.message}`);
  } else {
    for (const c of contactsRgpd ?? []) {
      scannedRgpd++;
      const expiryDate = c.rgpd_expiry_date as string;
      const days = daysBetween(today, expiryDate);
      const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Contact";
      const res = await enqueueNotification(supabase, {
        user_id: c.user_id as string,
        kind: "rgpd_expiry",
        title: `RGPD : ${fullName}`,
        body: days <= 0
          ? `Échéance atteinte (${expiryDate}). À traiter : prolonger, anonymiser ou archiver.`
          : `Expiration dans ${days} jour(s) (${expiryDate}). À traiter : prolonger, anonymiser ou archiver.`,
        link_url: `/protected/contacts/${c.id}`,
        source_type: "contact",
        source_id: c.id as string,
        trigger_date: today,
      });
      if (res.error) errors.push(`contact rgpd ${c.id}: ${res.error}`);
      else queuedRgpd++;
    }
  }

  // ── Job 4 : réveil des cédants dormants (v72) ─────────────────────────────
  // Une fiche univers mise en dormance (« pas maintenant, recontactez-moi
  // plus tard ») revient TOUTE SEULE dans le triage à sa date de réveil :
  // notification avec deep-link fiche 360, puis statut → a_approcher.
  // Pas de dédup nécessaire : le changement de statut sort la fiche du scan.
  let wokenCedants = 0;
  {
    const { data: dormantes, error: dormErr } = await supabase
      .from("univers_entreprises")
      .select("siren, nom, dormant_until, approche_note, source_profile_id")
      .eq("statut", "dormant")
      .not("dormant_until", "is", null)
      .lte("dormant_until", today)
      .limit(200);

    if (dormErr) {
      errors.push(`reveil query: ${dormErr.message}`);
    } else if (dormantes && dormantes.length > 0) {
      // L'univers n'a pas de user_id : destinataire = propriétaire du profil
      // de chasse source, repli sur le premier profil existant (mono-user en
      // pratique).
      const { data: profils } = await supabase
        .from("screening_profiles")
        .select("id, user_id")
        .order("created_at", { ascending: true });
      const userByProfile = new Map<string, string>((profils ?? []).map((p) => [p.id as string, p.user_id as string]));
      const fallbackUser = (profils ?? [])[0]?.user_id as string | undefined;

      for (const f of dormantes) {
        const userId = (f.source_profile_id && userByProfile.get(f.source_profile_id)) || fallbackUser;
        if (!userId) {
          errors.push(`reveil ${f.siren}: aucun utilisateur destinataire (aucun profil de chasse)`);
          continue;
        }
        // Réveiller D'ABORD, garde statut='dormant' (revue 2026-07-30) : une
        // décision prise entre le scan et maintenant n'est jamais écrasée, et
        // l'ordre inverse (notifier puis échouer l'update) re-notifierait
        // toutes les heures sans dédup possible (source_id UUID, PK = siren).
        const { data: woken, error: upErr } = await supabase
          .from("univers_entreprises")
          .update({ statut: "a_approcher", dormant_until: null, updated_at: new Date().toISOString() })
          .eq("siren", f.siren)
          .eq("statut", "dormant")
          .select("siren");
        if (upErr) {
          errors.push(`reveil ${f.siren}: ${upErr.message}`);
          continue;
        }
        if (!woken || woken.length === 0) continue; // décision concurrente, rien à réveiller
        wokenCedants++;
        const res = await enqueueNotification(supabase, {
          user_id: userId,
          kind: "reveil_cedant",
          title: `Réveil : ${f.nom}`,
          body: `Vous vouliez recontacter ce cédant aujourd'hui.${f.approche_note ? ` Note : ${f.approche_note}` : ""}`,
          link_url: `/protected/prospection?fiche=${f.siren}`,
          trigger_date: today,
        });
        // La fiche est déjà revenue dans le triage : un échec de notification
        // se journalise mais ne bloque pas le réveil.
        if (res.error) errors.push(`reveil ${f.siren}: notification: ${res.error}`);
      }
    }
  }

  // ── Job 5 : relances du funnel acquéreur (v73) ────────────────────────────
  // Déclencheur unique : next_followup_at échue (les règles J+N sont posées
  // AU GESTE par actions/funnel.ts, le cron ne recalcule rien). Dédup par
  // l'index unique notifications : trigger_date = la date d'échéance, donc
  // une seule cloche par échéance même en cron horaire, et décaler la date
  // recrée naturellement une cloche à la nouvelle échéance.
  let queuedFollowups = 0;
  let scannedFollowups = 0;
  {
    const { data: dues, error: dueErr } = await supabase
      .from("deal_target_suggestions")
      .select("id, user_id, deal_id, organization_id, status, next_followup_at, teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at, last_outreach_at, gmail_thread_id, organizations(name), deals(name)")
      .not("next_followup_at", "is", null)
      .lte("next_followup_at", today)
      .neq("status", "rejected")
      .limit(200);

    if (dueErr) {
      errors.push(`followups query: ${dueErr.message}`);
    } else {
      scannedFollowups = (dues ?? []).length;
      for (const s of dues ?? []) {
        const org = Array.isArray(s.organizations) ? s.organizations[0] : s.organizations;
        const deal = Array.isArray(s.deals) ? s.deals[0] : s.deals;
        const etape = s.offer_received_at ? "offre reçue"
          : s.im_sent_at ? "IM envoyé"
          : s.nda_signed_at ? "NDA signé"
          : s.teaser_sent_at ? "teaser envoyé"
          : "approche";
        const res = await enqueueNotification(supabase, {
          user_id: s.user_id,
          kind: "suggestion_followup",
          title: `Relancer ${(org as { name?: string } | null)?.name ?? "un acquéreur"} (${etape})`,
          body: `Mandat ${(deal as { name?: string } | null)?.name ?? ""} : relance prévue le ${s.next_followup_at}. Le bouton Brouillon relance prépare l'email dans Gmail.`,
          link_url: `/protected/dossiers/${s.deal_id}?tab=acquereurs`,
          source_type: "suggestion",
          source_id: s.id,
          trigger_date: s.next_followup_at,
        });
        if (res.error) errors.push(`followup ${s.id}: ${res.error}`);
        else queuedFollowups++;
      }

      // Rafraîchir le score d'intention des échéances scannées : les mails
      // de tous les fils en UNE requête (jamais de requête par ligne).
      const threadIds = [...new Set((dues ?? []).map(s => s.gmail_thread_id).filter((t): t is string => !!t))];
      const mailRows = await fetchMailRowsForThreads(supabase, threadIds);
      for (const s of dues ?? []) {
        try {
          await computeAndPersistIntent(supabase, s.user_id, s as unknown as SuggestionForIntent, mailRows);
        } catch (e) {
          errors.push(`intent ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  await finishCronRun(supabase, runId, {
    ok: errors.length === 0,
    summary: {
      actions: { scanned: scannedActions, queued: queuedActions },
      milestones: { scanned: scannedMilestones, queued: queuedMilestones },
      rgpd: { scanned: scannedRgpd, queued: queuedRgpd },
      reveils_cedants: wokenCedants,
      followups: { scanned: scannedFollowups, queued: queuedFollowups },
    },
    errors: errors.slice(0, 10),
  });

  return NextResponse.json({
    ok: true,
    today,
    actions: { scanned: scannedActions, queued: queuedActions },
    milestones: { scanned: scannedMilestones, queued: queuedMilestones },
    rgpd: { scanned: scannedRgpd, queued: queuedRgpd },
    reveils_cedants: wokenCedants,
    followups: { scanned: scannedFollowups, queued: queuedFollowups },
    errors: errors.slice(0, 10),
  });
}
