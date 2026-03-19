import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const dealTypeLabels: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell-side", ma_buy: "M&A Buy-side",
  cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
};

const dealTypeIcons: Record<string, string> = {
  fundraising: "📈", ma_sell: "🏢", ma_buy: "🎯", cfo_advisor: "💼", recruitment: "👤",
};

const dealTypeAccent: Record<string, { bg: string; text: string; border: string; dot: string; header: string }> = {
  fundraising: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#16A34A", header: "#DCFCE7" },
  ma_sell:     { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#D97706", header: "#FEF3C7" },
  ma_buy:      { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE", dot: "#2563EB", header: "#DBEAFE" },
  cfo_advisor: { bg: "#FAF5FF", text: "#6B21A8", border: "#E9D5FF", dot: "#9333EA", header: "#F3E8FF" },
  recruitment: { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3", dot: "#E11D48", header: "#FFE4E6" },
};

const stageLabels: Record<string, string> = {
  kickoff: "Kickoff", preparation: "Préparation", outreach: "Outreach",
  management_meetings: "Mgmt meetings", dd: "Due diligence",
  negotiation: "Négociation", closing: "Closing",
  post_closing: "Post-closing", ongoing_support: "Suivi", search: "Recherche",
};

const priorityLabel: Record<string, string> = { high: "Haute", medium: "Moyenne", low: "Basse" };
const priorityDot: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#CBD5E1" };

async function Content() {
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id, sector, target_date")
    .order("priority_level");

  const orgIds = [...new Set((deals ?? []).map(d => d.client_organization_id).filter(Boolean))];
  let orgsMap: Record<string, string> = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
    orgsMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
  }

  function formatDate(v: string | null) {
    if (!v) return null;
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(v));
  }

  const allDeals = deals ?? [];
  const dealTypes = ["fundraising", "ma_sell", "ma_buy", "cfo_advisor", "recruitment"];
  const activeDeals = allDeals.filter(d => d.deal_status === "active");
  const inactiveDeals = allDeals.filter(d => d.deal_status === "inactive");
  const closedDeals = allDeals.filter(d => d.deal_status === "closed");

  // Grouper par type, puis par statut
  const groups = dealTypes.map(type => ({
    type,
    label: dealTypeLabels[type],
    icon: dealTypeIcons[type],
    accent: dealTypeAccent[type] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0", dot: "#64748B", header: "#F1F5F9" },
    active: activeDeals.filter(d => d.deal_type === type),
    inactive: inactiveDeals.filter(d => d.deal_type === type),
    closed: closedDeals.filter(d => d.deal_type === type),
  })).filter(g => g.active.length + g.inactive.length + g.closed.length > 0);

  function DealCard({ deal, accent }: { deal: typeof allDeals[0]; accent: typeof dealTypeAccent["fundraising"] }) {
    const statusBg = deal.deal_status === "active" ? "#F0FDF4" : deal.deal_status === "closed" ? "var(--brand-blue-light)" : "#F8FAFC";
    const statusText = deal.deal_status === "active" ? "#166534" : deal.deal_status === "closed" ? "var(--brand-blue)" : "#64748B";
    const statusLabel = deal.deal_status === "active" ? "Actif" : deal.deal_status === "closed" ? "Clôturé" : "Inactif";
    return (
      <Link href={`/protected/dossiers/${deal.id}`}
        className="group flex flex-col gap-2 rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        style={{ background: "white", borderColor: "var(--border-default)", borderLeftWidth: "3px", borderLeftColor: priorityDot[deal.priority_level] ?? "#CBD5E1" }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--text-primary)" }}>{deal.name}</p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: statusBg, color: statusText }}>{statusLabel}</span>
        </div>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{orgsMap[deal.client_organization_id] ?? "—"}{deal.sector ? ` · ${deal.sector}` : ""}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: accent.bg, color: accent.text }}>
            {stageLabels[deal.deal_stage] ?? deal.deal_stage}
          </span>
          {formatDate(deal.target_date) && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(deal.target_date)}</span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="p-8 min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--brand-blue)" }}>MODULE CRM</p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Dossiers</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {allDeals.length} dossiers · {activeDeals.length} actifs · {closedDeals.length} clôturés
          </p>
        </div>
        <Link href="/protected/dossiers/nouveau"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "var(--sidebar-bg)" }}
        >
          + Nouveau dossier
        </Link>
      </div>

      {/* KPIs rapides */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Actifs", count: activeDeals.length, bg: "#F0FDF4", color: "#16A34A" },
          { label: "Inactifs", count: inactiveDeals.length, bg: "#F8FAFC", color: "#64748B" },
          { label: "Clôturés", count: closedDeals.length, bg: "var(--brand-blue-light)", color: "var(--brand-blue)" },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-4 text-center shadow-sm" style={{ background: k.bg, borderColor: "var(--border-default)" }}>
            <p className="text-3xl font-bold" style={{ color: k.color }}>{k.count}</p>
            <p className="text-xs font-medium mt-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Sections par type */}
      <div className="space-y-8">
        {groups.map(group => (
          <div key={group.type}>
            {/* Header section */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{group.icon}</span>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{group.label}</h2>
                <div className="flex items-center gap-2">
                  {group.active.length > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "#DCFCE7", color: "#166534" }}>
                      {group.active.length} actif{group.active.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {group.inactive.length > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "#F1F5F9", color: "#64748B" }}>
                      {group.inactive.length} inactif{group.inactive.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {group.closed.length > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                      {group.closed.length} clôturé{group.closed.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dossiers actifs en grille */}
            {group.active.length > 0 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.active.map(deal => <DealCard key={deal.id} deal={deal} accent={group.accent} />)}
              </div>
            )}

            {/* Inactifs + clôturés plus petits */}
            {(group.inactive.length > 0 || group.closed.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 opacity-55">
                {[...group.inactive, ...group.closed].map(deal => <DealCard key={deal.id} deal={deal} accent={group.accent} />)}
              </div>
            )}
          </div>
        ))}

        {allDeals.length === 0 && (
          <div className="rounded-2xl border border-dashed p-16 text-center" style={{ borderColor: "var(--border-default)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun dossier. Créez votre premier dossier.</p>
            <Link href="/protected/dossiers/nouveau" className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--sidebar-bg)" }}>
              + Nouveau dossier
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  return (
    <Suspense fallback={<div className="p-8 min-h-screen animate-pulse" style={{ background: "var(--bg-app)" }}><div className="h-10 w-64 rounded-xl bg-slate-200 mb-8" /><div className="space-y-6">{[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-200" />)}</div></div>}>
      <Content />
    </Suspense>
  );
}
