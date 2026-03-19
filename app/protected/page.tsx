import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Mail, Phone, Clock, AlertCircle, Sparkles, ChevronRight, TrendingUp, Briefcase, UserCheck, BarChart3, Search } from "lucide-react";

const dealTypeLabels: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell-side", ma_buy: "M&A Buy-side",
  cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
};

const dealTypeIcons: Record<string, string> = {
  fundraising: "📈", ma_sell: "🏢", ma_buy: "🎯", cfo_advisor: "💼", recruitment: "👤",
};

const dealTypeAccent: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  fundraising: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#16A34A" },
  ma_sell:     { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#D97706" },
  ma_buy:      { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE", dot: "#2563EB" },
  cfo_advisor: { bg: "#FAF5FF", text: "#6B21A8", border: "#E9D5FF", dot: "#9333EA" },
  recruitment: { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3", dot: "#E11D48" },
};

const stageLabels: Record<string, string> = {
  kickoff: "Kickoff", preparation: "Préparation", outreach: "Outreach",
  management_meetings: "Mgmt meetings", dd: "Due diligence",
  negotiation: "Négociation", closing: "Closing",
  post_closing: "Post-closing", ongoing_support: "Suivi", search: "Recherche",
};

const eventTypeLabels: Record<string, string> = {
  meeting: "Réunion", follow_up: "Relance", deadline: "Deadline",
  call: "Appel", delivery: "Livraison", closing: "Closing", other: "Autre",
};

const eventBg: Record<string, { bg: string; text: string }> = {
  meeting:  { bg: "#EFF6FF", text: "#1E40AF" },
  follow_up:{ bg: "#FFFBEB", text: "#92400E" },
  deadline: { bg: "#FFF1F2", text: "#9F1239" },
  call:     { bg: "#FAF5FF", text: "#6B21A8" },
  delivery: { bg: "#ECFDF5", text: "#065F46" },
  closing:  { bg: "#F0FDF4", text: "#166534" },
  other:    { bg: "#F8FAFC", text: "#475569" },
};

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(v));
}

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function DashboardContent() {
  const supabase = await createClient();
  const today = new Date();
  const in10Days = new Date(); in10Days.setDate(today.getDate() + 10);

  const [{ data: deals }, { data: tasks }, { data: events }, { count: contactsCount }, { count: orgsCount }] = await Promise.all([
    supabase.from("deals").select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id").order("priority_level"),
    supabase.from("tasks")
      .select("id, title, task_status, priority_level, due_date, description, contacts(id, full_name, first_name, last_name, email, phone), deal_id, deals(id, name)")
      .eq("task_status", "open").order("due_date", { ascending: true }).limit(8),
    supabase.from("agenda_events")
      .select("id, title, event_type, starts_at, location, meet_link, deals(name)")
      .eq("status", "open").gte("starts_at", today.toISOString()).lte("starts_at", in10Days.toISOString()).order("starts_at").limit(8),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
  ]);

  const orgIds = [...new Set((deals ?? []).map(d => d.client_organization_id).filter(Boolean))];
  let orgsMap: Record<string, string> = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
    orgsMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
  }

  const allDeals = deals ?? [];
  const activeDeals = allDeals.filter(d => d.deal_status === "active");
  const inactiveDeals = allDeals.filter(d => d.deal_status === "inactive");
  const closedDeals = allDeals.filter(d => d.deal_status === "closed");
  const overdueTasksCount = (tasks ?? []).filter(t => t.due_date && new Date(t.due_date) < today).length;

  // Stats par type
  const dealTypes = ["fundraising", "ma_sell", "ma_buy", "cfo_advisor", "recruitment"];
  const statsByType = dealTypes.map(type => ({
    type,
    active: activeDeals.filter(d => d.deal_type === type).length,
    inactive: inactiveDeals.filter(d => d.deal_type === type).length,
    closed: closedDeals.filter(d => d.deal_type === type).length,
    total: allDeals.filter(d => d.deal_type === type).length,
  })).filter(s => s.total > 0);

  return (
    <div className="p-8 min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--brand-blue)" }}>TABLEAU DE BORD</p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Bonjour 👋</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link href="/protected/ia" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90" style={{ background: "var(--sidebar-bg)", color: "white" }}>
          <Sparkles size={15} style={{ color: "#60A5FA" }} /> Assistant IA
        </Link>
      </div>

      {/* KPIs globaux */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { count: activeDeals.length, label: "Dossiers actifs", accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
          { count: inactiveDeals.length, label: "Dossiers inactifs", accent: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
          { count: closedDeals.length, label: "Dossiers clôturés", accent: "var(--brand-blue)", bg: "var(--brand-blue-light)", border: "var(--border-default)" },
          { count: allDeals.length, label: "Total dossiers", accent: "var(--text-primary)", bg: "white", border: "var(--border-default)" },
        ].map((kpi, i) => (
          <Link key={i} href="/protected/dossiers"
            className="group rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
            style={{ background: kpi.bg, borderColor: kpi.border }}
          >
            <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>{kpi.label.toUpperCase()}</p>
            <p className="mt-2 text-4xl font-bold" style={{ color: kpi.accent }}>{kpi.count}</p>
          </Link>
        ))}
      </div>

      {/* Stats par type de dossier */}
      {statsByType.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {statsByType.map(s => {
            const accent = dealTypeAccent[s.type] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0", dot: "#64748B" };
            return (
              <Link key={s.type} href={`/protected/dossiers`}
                className="group rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all"
                style={{ background: accent.bg, borderColor: accent.border }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{dealTypeIcons[s.type]}</span>
                    <p className="text-sm font-semibold" style={{ color: accent.text }}>{dealTypeLabels[s.type]}</p>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: accent.dot }}>{s.total}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: accent.text }}>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />{s.active} actif{s.active > 1 ? "s" : ""}
                  </span>
                  {s.inactive > 0 && <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />{s.inactive} inactif{s.inactive > 1 ? "s" : ""}
                  </span>}
                  {s.closed > 0 && <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent.dot }} />{s.closed} clôturé{s.closed > 1 ? "s" : ""}
                  </span>}
                </div>
              </Link>
            );
          })}
          <div className="rounded-2xl border p-4 shadow-sm grid grid-cols-2 gap-3" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <Link href="/protected/contacts" className="rounded-xl p-3 hover:opacity-80 transition-all text-center" style={{ background: "var(--brand-blue-light)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--brand-blue)" }}>{contactsCount ?? 0}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>Contacts</p>
            </Link>
            <Link href="/protected/organisations" className="rounded-xl p-3 hover:opacity-80 transition-all text-center" style={{ background: "#FAF5FF" }}>
              <p className="text-2xl font-bold" style={{ color: "#7C3AED" }}>{orgsCount ?? 0}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#6B21A8" }}>Organisations</p>
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Dossiers actifs + Tâches */}
        <div className="xl:col-span-2 space-y-6">

          {/* Dossiers actifs */}
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2.5">
                <Briefcase size={15} style={{ color: "var(--brand-blue)" }} />
                <h2 className="text-sm font-semibold tracking-widest" style={{ color: "var(--text-primary)" }}>DOSSIERS ACTIFS</h2>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>{activeDeals.length}</span>
              </div>
              <Link href="/protected/dossiers" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--brand-blue)" }}>
                Voir tous <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
              {activeDeals.length === 0 ? (
                <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--text-muted)" }}>Aucun dossier actif.</p>
              ) : activeDeals.slice(0, 6).map(deal => {
                const accent = dealTypeAccent[deal.deal_type] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0", dot: "#64748B" };
                const priorityBar = deal.priority_level === "high" ? "#EF4444" : deal.priority_level === "medium" ? "#F59E0B" : "#CBD5E1";
                return (
                  <Link key={deal.id} href={`/protected/dossiers/${deal.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="h-9 w-1 shrink-0 rounded-full" style={{ background: priorityBar }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{deal.name}</p>
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{orgsMap[deal.client_organization_id] ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: accent.bg, color: accent.text }}>
                        {dealTypeIcons[deal.deal_type]} {dealTypeLabels[deal.deal_type]}
                      </span>
                      <span className="hidden sm:block rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-app)", color: "var(--text-secondary)" }}>
                        {stageLabels[deal.deal_stage] ?? deal.deal_stage}
                      </span>
                      <ArrowRight size={13} style={{ color: "var(--border-strong)" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Tâches */}
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2.5">
                <Clock size={15} style={{ color: "var(--brand-blue)" }} />
                <h2 className="text-sm font-semibold tracking-widest" style={{ color: "var(--text-primary)" }}>TÂCHES À RÉALISER</h2>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>{(tasks ?? []).length}</span>
                {overdueTasksCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "#FFF1F2", color: "#9F1239" }}>
                    <AlertCircle size={10} /> {overdueTasksCount} en retard
                  </span>
                )}
              </div>
              <Link href="/protected/agenda" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--brand-blue)" }}>
                Agenda <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
              {(tasks ?? []).length === 0 ? (
                <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--text-muted)" }}>Aucune tâche. ✓</p>
              ) : (tasks ?? []).map(task => {
                const contact = Array.isArray(task.contacts) ? task.contacts[0] : task.contacts as any;
                const deal = Array.isArray(task.deals) ? task.deals[0] : task.deals as any;
                const isOverdue = task.due_date && new Date(task.due_date) < today;
                const priorityDot = task.priority_level === "high" ? "#EF4444" : task.priority_level === "medium" ? "#F59E0B" : "#CBD5E1";
                return (
                  <div key={task.id} className="px-5 py-4 transition-colors" style={{ background: isOverdue ? "#FFF5F5" : undefined }}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: priorityDot }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                        {task.description && <p className="mt-0.5 text-xs truncate" style={{ color: "var(--text-muted)" }}>{task.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {deal && (
                            <Link href={`/protected/dossiers/${deal.id}`} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--brand-blue)" }}>
                              📁 {deal.name}
                            </Link>
                          )}
                          {contact && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                {contact.full_name || `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()}
                              </span>
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }} title={contact.email}>
                                  <Mail size={10} />
                                </a>
                              )}
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: "#DCFCE7", color: "#166534" }} title={contact.phone}>
                                  <Phone size={10} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="shrink-0 text-xs font-medium" style={{ color: isOverdue ? "#DC2626" : "var(--text-muted)" }}>
                        {isOverdue && "⚠ "}{formatDate(task.due_date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Actions rapides */}
          <div className="rounded-2xl border p-5 shadow-sm" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <h2 className="mb-4 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>ACTIONS RAPIDES</h2>
            <div className="space-y-2">
              {[
                { href: "/protected/dossiers/nouveau", label: "Nouveau dossier", bg: "var(--brand-blue-light)", color: "var(--brand-blue-dark)" },
                { href: "/protected/contacts/nouveau", label: "Nouveau contact", bg: "#F0FDF4", color: "#166534" },
                { href: "/protected/organisations/nouveau", label: "Nouvelle organisation", bg: "#FAF5FF", color: "#6B21A8" },
                { href: "/protected/agenda/nouvelle-tache", label: "Nouvelle tâche", bg: "#FFF7ED", color: "#9A3412" },
                { href: "/protected/agenda/nouvel-evenement", label: "Nouvel événement", bg: "#F0F9FF", color: "#0369A1" },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: a.bg, color: a.color }}
                >
                  <span>{a.label}</span>
                  <ChevronRight size={14} className="opacity-50" />
                </Link>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>AGENDA — 10 JOURS</h2>
              </div>
              <Link href="/protected/agenda" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--brand-blue)" }}>
                Tout <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
              {(events ?? []).length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--text-muted)" }}>Aucun événement prévu.</p>
              ) : (events ?? []).map(event => {
                const deal = Array.isArray(event.deals) ? event.deals[0] : event.deals as any;
                const eb = eventBg[event.event_type] ?? { bg: "#F8FAFC", text: "#475569" };
                return (
                  <div key={event.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: eb.bg, color: eb.text }}>
                          {eventTypeLabels[event.event_type] ?? event.event_type}
                        </span>
                        <p className="mt-1.5 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{event.title}</p>
                        {deal && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>📁 {deal.name}</p>}
                        {event.meet_link && (
                          <a href={event.meet_link} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "#2563EB" }}>
                            🎥 Rejoindre Meet
                          </a>
                        )}
                      </div>
                      <p className="shrink-0 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{formatDateTime(event.starts_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 min-h-screen animate-pulse" style={{ background: "var(--bg-app)" }}><div className="h-10 w-64 rounded-xl bg-slate-200 mb-8" /><div className="grid gap-4 grid-cols-4 mb-6">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-200" />)}</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
