import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dealTypeLabels, dealStageLabels, dealStatusLabels, priorityLabels } from "@/lib/crm/labels";

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const typeColors: Record<string, string> = {
  fundraising: "bg-emerald-100 text-emerald-800",
  ma_sell: "bg-amber-100 text-amber-800",
  ma_buy: "bg-sky-100 text-sky-800",
  cfo_advisor: "bg-violet-100 text-violet-800",
  recruitment: "bg-rose-100 text-rose-800",
};

const stageColors: Record<string, string> = {
  kickoff: "bg-slate-100 text-slate-600",
  preparation: "bg-blue-100 text-blue-700",
  outreach: "bg-cyan-100 text-cyan-700",
  "management meetings": "bg-indigo-100 text-indigo-700",
  dd: "bg-amber-100 text-amber-700",
  negotiation: "bg-orange-100 text-orange-700",
  closing: "bg-emerald-100 text-emerald-700",
  Post_closing: "bg-green-100 text-green-700",
  Ongoing_support: "bg-teal-100 text-teal-700",
  search: "bg-slate-100 text-slate-600",
};

async function Content() {
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id, sector, valuation_amount, fundraising_amount, target_date")
    .order("priority_level", { ascending: true });

  const orgIds = [...new Set((deals ?? []).map(d => d.client_organization_id).filter(Boolean))];
  let orgsMap: Record<string, string> = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
    orgsMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
  }

  const sorted = [...(deals ?? [])].sort((a, b) => (priorityOrder[a.priority_level] ?? 3) - (priorityOrder[b.priority_level] ?? 3));
  const active = sorted.filter(d => d.deal_status === "active");
  const others = sorted.filter(d => d.deal_status !== "active");

  function formatDate(v: string | null) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("fr-FR").format(new Date(v));
  }

  function DealCard({ deal }: { deal: typeof sorted[0] }) {
    const priority = deal.priority_level;
    const borderColor = priority === "high" ? "border-l-rose-500" : priority === "medium" ? "border-l-amber-400" : "border-l-slate-300";
    return (
      <Link
        href={`/protected/dossiers/${deal.id}`}
        className={`block rounded-xl border border-[#E8E0D0] border-l-4 ${borderColor} bg-white p-4 hover:shadow-md transition-all`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[#0F1B2D]">{deal.name}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{orgsMap[deal.client_organization_id] ?? "—"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${typeColors[deal.deal_type] ?? "bg-slate-100 text-slate-600"}`}>
            {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageColors[deal.deal_stage] ?? "bg-slate-100 text-slate-600"}`}>
            {dealStageLabels[deal.deal_stage] ?? deal.deal_stage}
          </span>
          <span className="text-xs text-slate-400">{formatDate(deal.target_date)}</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-widest text-[#C9A84C]">MODULE CRM</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#0F1B2D]">Dossiers</h1>
          <p className="mt-1 text-sm text-[#6B8CAE]">{(deals ?? []).length} dossiers · {active.length} actifs</p>
        </div>
        <Link href="/protected/dossiers/nouveau" className="rounded-xl bg-[#0F1B2D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors">
          + Nouveau dossier
        </Link>
      </div>

      {/* Actifs */}
      {active.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-widest text-[#0F1B2D]">DOSSIERS ACTIFS</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{active.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {active.map(deal => <DealCard key={deal.id} deal={deal} />)}
          </div>
        </div>
      )}

      {/* Autres */}
      {others.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-widest text-slate-400">INACTIFS / CLÔTURÉS</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{others.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 opacity-60">
            {others.map(deal => <DealCard key={deal.id} deal={deal} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DossiersPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 mb-8" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}
        </div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
