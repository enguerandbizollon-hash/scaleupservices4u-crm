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
  candidate_id: string | null;
}

interface OverdueMilestone {
  id: string;
  user_id: string;
  name: string;
  amount: number | null;
  currency: string | null;
  due_date: string;
  mandate_id: string;
  mandates: { name: string | null } | { name: string | null }[] | null;
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
  if (a.candidate_id) return `/protected/candidats/${a.candidate_id}`;
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
  const today = todayISO();

  // ── Job 1 : rappels d'actions ─────────────────────────────────────────────
  const { data, error } = await supabase
    .from("actions")
    .select("id, user_id, title, type, due_date, reminder_days, deal_id, candidate_id")
    .eq("status", "open")
    .not("due_date", "is", null)
    .not("reminder_days", "is", null);

  if (error) {
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
    .select("id, user_id, name, amount, currency, due_date, mandate_id, mandates(name)")
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
      const mandateName = Array.isArray(m.mandates)
        ? m.mandates[0]?.name ?? null
        : m.mandates?.name ?? null;
      const amountLabel = m.amount != null
        ? ` (${m.amount} ${m.currency ?? "EUR"})`
        : "";

      const res = await enqueueNotification(supabase, {
        user_id: m.user_id,
        kind: "fee_overdue",
        title: `Jalon en retard : ${m.name}${amountLabel}`,
        body: `En retard de ${lateDays} jour(s) depuis ${m.due_date}${mandateName ? ` · Mandat : ${mandateName}` : ""}.`,
        link_url: `/protected/mandats/${m.mandate_id}`,
        source_type: "fee_milestone",
        source_id: m.id,
        trigger_date: today,
      });
      if (res.error) errors.push(`milestone ${m.id}: ${res.error}`);
      else queuedMilestones++;
    }
  }

  // ── Job 3 : alertes RGPD — contacts/candidats avec rgpd_expiry_date < 30j
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

  // 3b. Candidats
  const { data: candidatesRgpd, error: candidatesRgpdErr } = await supabase
    .from("candidates")
    .select("id, user_id, first_name, last_name, rgpd_expiry_date")
    .not("rgpd_expiry_date", "is", null)
    .gte("rgpd_expiry_date", today)
    .lte("rgpd_expiry_date", rgpdHorizon);
  if (candidatesRgpdErr) {
    errors.push(`candidates rgpd query: ${candidatesRgpdErr.message}`);
  } else {
    for (const c of candidatesRgpd ?? []) {
      scannedRgpd++;
      const expiryDate = c.rgpd_expiry_date as string;
      const days = daysBetween(today, expiryDate);
      const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Candidat";
      const res = await enqueueNotification(supabase, {
        user_id: c.user_id as string,
        kind: "rgpd_expiry",
        title: `RGPD candidat : ${fullName}`,
        body: days <= 0
          ? `Échéance atteinte (${expiryDate}). À traiter : prolonger, anonymiser ou archiver.`
          : `Expiration dans ${days} jour(s) (${expiryDate}). À traiter : prolonger, anonymiser ou archiver.`,
        link_url: `/protected/candidats/${c.id}`,
        source_type: "candidate",
        source_id: c.id as string,
        trigger_date: today,
      });
      if (res.error) errors.push(`candidate rgpd ${c.id}: ${res.error}`);
      else queuedRgpd++;
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    actions: { scanned: scannedActions, queued: queuedActions },
    milestones: { scanned: scannedMilestones, queued: queuedMilestones },
    rgpd: { scanned: scannedRgpd, queued: queuedRgpd },
    errors: errors.slice(0, 10),
  });
}
