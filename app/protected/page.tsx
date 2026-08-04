import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFeesKpis } from "@/actions/fees";
import { projectYearEndFromYtd } from "@/lib/crm/fee-calculator";
import { isDormant } from "@/lib/crm/health-score";
import {
  Sunrise, Flame, Inbox as InboxIcon, Radar, CheckSquare, AlertTriangle,
  CalendarDays, FolderOpen, Bell, ChevronRight, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

// « Ce matin » : la revue du matin, pas un tableau de bord de stocks.
// Trois questions, dans l'ordre du métier : qu'est-ce qui a changé depuis
// hier ? qu'est-ce que je dois décider ? qu'est-ce que je fais aujourd'hui ?
// Chaque chiffre est un lien vers la liste EXACTE qu'il compte
// (?filtre=chaudes, ?statut=nouveau, ?nonlus=1...), jamais un chiffre mort.

const KIND_META: Record<string, { label: string; bg: string; tx: string }> = {
  veille_profil:   { label: "Passée chaude",   bg: "#FEE2E2", tx: "#991B1B" },
  reveil_cedant:   { label: "Réveil cédant",   bg: "#E0F2FE", tx: "#0369A1" },
  screening_draft: { label: "Screening",       bg: "#FEF3C7", tx: "#92400E" },
  fee_overdue:     { label: "Honoraires",      bg: "#FEE2E2", tx: "#991B1B" },
  action_reminder: { label: "Rappel",          bg: "var(--surface-3)", tx: "var(--text-3)" },
  task_due:        { label: "Tâche",           bg: "var(--surface-3)", tx: "var(--text-3)" },
  rgpd_expiry:     { label: "RGPD",            bg: "var(--surface-3)", tx: "var(--text-3)" },
};

const EVT_ICON: Record<string, string> = { meeting: "🤝", call: "📞", deadline: "⏰" };

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k€`;
  return `${Math.round(n)} €`;
}
function fmtHeure(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
};
const cardHeader: React.CSSProperties = {
  padding: "11px 14px", borderBottom: "1px solid var(--border)",
  fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em",
  display: "flex", alignItems: "center", gap: 7,
};

export default async function CeMatinPage() {
  const supabase = await createClient();

  const now = new Date();
  // Date CIVILE Paris, pas UTC : entre minuit et 2 h, toISOString() rendait
  // encore la veille et « la journée » affichait celle d'hier (revue).
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const yesterdayIso = new Date(Date.now() - 86_400_000).toISOString();
  const sevenDaysIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const cutoff15 = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
  const cutoff30Fees = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [
    notifRes, signauxUnread, chaudes, aTrier, entrees7j, relancesRes,
    overdueTasksRes, todayTasksRes, todayEventsRes, feesOverdue,
    openDealsRes, cronRes, fees,
  ] = await Promise.all([
    supabase.from("notifications")
      .select("id,kind,title,link_url,read_at,created_at")
      .or(`read_at.is.null,created_at.gte.${yesterdayIso}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("signaux").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true })
      .gte("cedabilite_score", 70).not("statut", "in", '("ecarte","promu")'),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).eq("statut", "nouveau"),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).gte("first_seen_at", sevenDaysIso),
    supabase.from("contacts")
      .select("id,first_name,last_name,title,last_contact_date")
      .not("last_contact_date", "is", null)
      .lte("last_contact_date", cutoff15)
      .not("base_status", "in", '("excluded","inactive")')
      .order("last_contact_date", { ascending: true })
      .limit(6),
    supabase.from("actions")
      .select("id,title,due_date,deal_id", { count: "exact" })
      .eq("type", "task")
      .not("status", "in", '("done","cancelled","completed")')
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase.from("actions")
      .select("id,title,due_date,deal_id", { count: "exact" })
      .eq("type", "task")
      .not("status", "in", '("done","cancelled","completed")')
      .eq("due_date", todayStr)
      .limit(5),
    supabase.from("actions")
      .select("id,title,type,due_time")
      .in("type", ["meeting", "call", "deadline"])
      .not("status", "in", '("done","cancelled","completed")')
      .eq("due_date", todayStr)
      .order("due_time", { ascending: true }),
    supabase.from("fee_milestones").select("id", { count: "exact", head: true })
      .eq("status", "pending").lt("due_date", cutoff30Fees),
    supabase.from("deals").select("id,name,created_at").eq("deal_status", "open"),
    // Filtré sur les DEUX jobs affichés : le cron notifications (horaire)
    // évincait sinon les veilles quotidiennes de la fenêtre et le bandeau
    // affichait « jamais passée » le week-end (revue adversariale).
    supabase.from("cron_runs").select("job,started_at,finished_at,ok").in("job", ["bodacc-ingest", "veille-profils"]).order("started_at", { ascending: false }).limit(30),
    getFeesKpis(),
  ]);

  // Mandats sans activité : même règle que la liste dossiers (les actions
  // futures ne comptent pas, référence création pour les dossiers neufs).
  const openDeals = openDealsRes.data ?? [];
  let sansActivite = 0;
  if (openDeals.length > 0) {
    const { data: acts } = await supabase
      .from("actions")
      .select("deal_id,start_datetime,due_date")
      .in("deal_id", openDeals.map(d => d.id))
      .neq("type", "task")
      .order("start_datetime", { ascending: false, nullsFirst: false });
    const lastByDeal: Record<string, string> = {};
    const nowMs = Date.now();
    for (const a of acts ?? []) {
      if (!a.deal_id) continue;
      const when = a.start_datetime ?? a.due_date;
      if (!when || new Date(when).getTime() > nowMs) continue;
      if (!lastByDeal[a.deal_id]) lastByDeal[a.deal_id] = when;
    }
    sansActivite = openDeals.filter(d => isDormant(lastByDeal[d.id] ?? null, "open", d.created_at)).length;
  }

  // Dernier passage de chaque veille (cron_runs, premier par job).
  const lastRunByJob: Record<string, { ok: boolean | null; finished_at: string | null; started_at: string }> = {};
  for (const r of cronRes.data ?? []) {
    if (!lastRunByJob[r.job]) lastRunByJob[r.job] = { ok: r.ok, finished_at: r.finished_at, started_at: r.started_at };
  }
  const veilles = [
    { job: "bodacc-ingest", label: "Veille BODACC + signaux" },
    { job: "veille-profils", label: "Veille profils de chasse" },
  ].map(v => ({ ...v, run: lastRunByJob[v.job] ?? null }));

  const notifications = notifRes.data ?? [];
  const relances = relancesRes.data ?? [];
  const todayEvents = todayEventsRes.data ?? [];
  const projection = projectYearEndFromYtd(fees.paid_ytd);

  const dateLongue = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // Les 6 décisions du matin, chacune vers sa liste exacte.
  const tiles: Array<{ n: number; label: string; sub: string; href: string; color: string; icon: React.ReactNode }> = [
    { n: chaudes.count ?? 0, label: "Chaudes à traiter", sub: "radar ≥ 70, hors promues/écartées", href: "/protected/prospection?filtre=chaudes", color: "#991B1B", icon: <Flame size={13} /> },
    { n: aTrier.count ?? 0, label: "À trier", sub: "fiches en attente de décision", href: "/protected/prospection?statut=nouveau", color: "#B45309", icon: <InboxIcon size={13} /> },
    { n: entrees7j.count ?? 0, label: "Entrées 7 j", sub: "nouvelles fiches dans l'univers", href: "/protected/prospection?filtre=entrees7j&tri=recent", color: "#0F766E", icon: <Radar size={13} /> },
    { n: signauxUnread.count ?? 0, label: "Signaux non lus", sub: "BODACC, RGE, recrutements...", href: "/protected/signaux?nonlus=1", color: "#B45309", icon: <Radar size={13} /> },
    { n: overdueTasksRes.count ?? 0, label: "Tâches en retard", sub: "à rattraper ou requalifier", href: "/protected/taches", color: "#DC2626", icon: <AlertTriangle size={13} /> },
    { n: sansActivite, label: "Mandats sans activité", sub: "ouverts, rien depuis 21 jours", href: "/protected/dossiers?filtre=sans_activite", color: "#7E57C2", icon: <FolderOpen size={13} /> },
  ];

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 9 }}>
              <Sunrise size={20} color="#B45309" /> Ce matin
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-4)", textTransform: "capitalize" }}>{dateLongue}</p>
          </div>
          {/* État des veilles de la nuit */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {veilles.map(v => (
              <span key={v.job} title={v.run ? `Dernier passage : ${new Date(v.run.started_at).toLocaleString("fr-FR")}` : "Jamais exécutée (crons Vercel, pas en local)"}
                style={{
                  fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 20,
                  background: v.run == null ? "var(--surface-3)" : v.run.ok === true ? "#D1FAE5" : v.run.ok === false ? "#FEE2E2" : "#FEF3C7",
                  color: v.run == null ? "var(--text-5)" : v.run.ok === true ? "#065F46" : v.run.ok === false ? "#991B1B" : "#92400E",
                }}>
                {v.label} : {v.run == null ? "jamais passée" : v.run.ok === true ? `OK ${fmtHeure(v.run.finished_at ?? v.run.started_at)}` : v.run.ok === false ? "échec" : "en cours"}
              </span>
            ))}
          </div>
        </div>

        {/* Les décisions du matin */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, margin: "16px 0" }}>
          {tiles.map(t => (
            <Link key={t.label} href={t.href} style={{ ...card, padding: "12px 14px", textDecoration: "none", display: "block" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.n > 0 ? t.color : "var(--text-5)", lineHeight: 1.1 }}>
                {t.n.toLocaleString("fr-FR")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 4 }}>
                {t.icon} {t.label}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-5)", marginTop: 2 }}>{t.sub}</div>
            </Link>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, marginBottom: 12 }}>

          {/* Depuis hier : ce que les veilles et les tâches de fond ont produit */}
          <div style={card}>
            <div style={cardHeader}><Bell size={12} /> Depuis hier</div>
            {notifications.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "var(--text-5)" }}>
                Rien de neuf : pas de fiche passée chaude, pas de réveil, pas d&apos;alerte.
              </div>
            ) : notifications.map((n, i) => {
              const meta = KIND_META[n.kind] ?? { label: n.kind, bg: "var(--surface-3)", tx: "var(--text-4)" };
              const inner = (
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: i < notifications.length - 1 ? "1px solid var(--border)" : "none", opacity: n.read_at ? 0.55 : 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 6, background: meta.bg, color: meta.tx, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {meta.label}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: n.read_at ? 500 : 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title}
                  </span>
                  {n.link_url && <ChevronRight size={12} color="var(--text-5)" style={{ flexShrink: 0 }} />}
                </div>
              );
              return n.link_url
                ? <Link key={n.id} href={n.link_url} style={{ textDecoration: "none", display: "block" }}>{inner}</Link>
                : <div key={n.id}>{inner}</div>;
            })}
          </div>

          {/* Aujourd'hui : la journée en un bloc */}
          <div style={card}>
            <div style={cardHeader}><CalendarDays size={12} /> Aujourd&apos;hui</div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {todayEvents.length === 0 && (todayTasksRes.data ?? []).length === 0 && (overdueTasksRes.data ?? []).length === 0 && (feesOverdue.count ?? 0) === 0 ? (
                <div style={{ padding: "18px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-5)" }}>
                  Journée dégagée : ni rendez-vous, ni tâche due, ni retard.
                </div>
              ) : (
                <>
                  {todayEvents.map(e => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-1)" }}>
                      <span>{EVT_ICON[e.type] ?? "📌"}</span>
                      {e.due_time && <span style={{ fontWeight: 700, color: "var(--text-3)" }}>{String(e.due_time).slice(0, 5)}</span>}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                    </div>
                  ))}
                  {(todayTasksRes.data ?? []).map(t => (
                    <Link key={t.id} href={t.deal_id ? `/protected/dossiers/${t.deal_id}` : "/protected/taches"}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-2)", textDecoration: "none" }}>
                      <CheckSquare size={12} color="#F59E0B" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    </Link>
                  ))}
                  {(overdueTasksRes.data ?? []).map(t => (
                    <Link key={t.id} href={t.deal_id ? `/protected/dossiers/${t.deal_id}` : "/protected/taches"}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#991B1B", textDecoration: "none" }}>
                      <AlertTriangle size={12} color="#DC2626" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: "var(--text-5)", flexShrink: 0 }}>retard {daysAgo(t.due_date)}j</span>
                    </Link>
                  ))}
                  {(feesOverdue.count ?? 0) > 0 && (
                    <Link href="/protected/statistiques" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#991B1B", textDecoration: "none" }}>
                      <AlertTriangle size={12} color="#DC2626" />
                      {feesOverdue.count} jalon{(feesOverdue.count ?? 0) > 1 ? "s" : ""} d&apos;honoraires en retard de plus de 30 jours
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Relances : les dirigeants qu'on laisse refroidir */}
        {relances.length > 0 && (
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={cardHeader}><Users size={12} /> Relances : sans nouvelle depuis 15 jours ou plus</div>
            {relances.map((c, i) => {
              const d = daysAgo(c.last_contact_date);
              return (
                <Link key={c.id} href={`/protected/contacts/${c.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: i < relances.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                    {c.title && <span style={{ fontWeight: 400, color: "var(--text-4)" }}> · {c.title}</span>}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: (d ?? 0) >= 30 ? "#991B1B" : "#B45309" }}>
                    {d}j sans contact
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Honoraires : le cap de l'année */}
        <div style={{ ...card, padding: "13px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Honoraires pipeline", v: fees.pending, color: "var(--text-2)" },
            { label: "Facturé", v: fees.invoiced, color: "#1D4ED8" },
            { label: "Encaissé YTD", v: fees.paid_ytd, color: "#065F46" },
            { label: "Projection fin d'année", v: projection ?? 0, color: "var(--text-3)" },
          ].map(k => (
            <Link key={k.label} href="/protected/statistiques" style={{ textDecoration: "none" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: k.color }}>{fmtMoney(k.v)}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 2 }}>{k.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
