import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type DealRow = {
  id: string;
  name: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  priority_level: string;
  client_organization_id: string;
  sector: string | null;
  valuation_amount: number | null;
  fundraising_amount: number | null;
  description: string | null;
  start_date: string | null;
  target_date: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type FormattedDeal = {
  id: string;
  name: string;
  typeLabel: string;
  statusLabel: string;
  stageLabel: string;
  priorityLabel: string;
  organisation: string;
  sector: string;
  valuation: string;
  fundraising: string;
  startDate: string;
  targetDate: string;
  description: string;
};

const dealTypeLabels: Record<string, string> = {
  fundraising: "Fundraising",
  ma_sell: "M&A Sell-side",
  ma_buy: "M&A Buy-side",
  cfo_advisor: "CFO Advisor",
  recruitment: "Recrutement",
};

const dealStatusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  closed: "Clôturé",
};

const dealStageLabels: Record<string, string> = {
  kickoff: "Kickoff",
  preparation: "Préparation",
  outreach: "Outreach",
  management_meetings: "Management meetings",
  dd: "Due diligence",
  negotiation: "Négociation",
  closing: "Closing",
  post_closing: "Post-closing",
  ongoing_support: "Suivi en cours",
  search: "Recherche",
};

const priorityLabels: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("fr-FR").format(value);
}

function priorityBadgeClass(priority: string) {
  if (priority === "Haute") return "bg-rose-100 text-rose-800";
  if (priority === "Moyenne") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function statusBadgeClass(status: string) {
  if (status === "Actif") return "bg-emerald-100 text-emerald-800";
  if (status === "Inactif") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function DealCard({ deal }: { deal: FormattedDeal }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{deal.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {deal.typeLabel} • {deal.organisation}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Étape : <span className="font-medium">{deal.stageLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
              deal.statusLabel
            )}`}
          >
            {deal.statusLabel}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(
              deal.priorityLabel
            )}`}
          >
            Priorité {deal.priorityLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Secteur</p>
          <p className="mt-1 text-sm font-medium">{deal.sector}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Valorisation</p>
          <p className="mt-1 text-sm font-medium">{deal.valuation}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fundraising</p>
          <p className="mt-1 text-sm font-medium">{deal.fundraising}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date cible</p>
          <p className="mt-1 text-sm font-medium">{deal.targetDate}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
        <p className="mt-1 text-sm text-slate-700">{deal.description}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date de lancement</p>
          <p className="mt-1 text-sm font-medium">{deal.startDate}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organisation liée</p>
          <p className="mt-1 text-sm font-medium">{deal.organisation}</p>
        </div>
      </div>
    </div>
  );
}

function DossiersLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Dossiers</h1>
          <p className="mt-2 text-sm text-slate-500">Chargement depuis Supabase…</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

async function DossiersContent() {
  const supabase = await createClient();

  const { data: dealsData, error: dealsError } = await supabase
    .from("deals")
    .select(
      "id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id,sector,valuation_amount,fundraising_amount,description,start_date,target_date"
    )
    .order("target_date", { ascending: true });

  if (dealsError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Erreur Supabase</h1>
          <p className="mt-3 text-sm text-slate-600">
            Impossible de charger les dossiers depuis la base.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-sm text-white">
            {dealsError.message}
          </pre>
        </div>
      </div>
    );
  }

  const deals = (dealsData ?? []) as DealRow[];
  const organizationIds = [...new Set(deals.map((deal) => deal.client_organization_id))];

  let organizationMap: Record<string, string> = {};

  if (organizationIds.length > 0) {
    const { data: organizationsData } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);

    const organizations = (organizationsData ?? []) as OrganizationRow[];

    organizationMap = Object.fromEntries(
      organizations.map((organization) => [organization.id, organization.name])
    );
  }

  const formattedDeals: FormattedDeal[] = deals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    typeLabel: dealTypeLabels[deal.deal_type] ?? deal.deal_type,
    statusLabel: dealStatusLabels[deal.deal_status] ?? deal.deal_status,
    stageLabel: dealStageLabels[deal.deal_stage] ?? deal.deal_stage,
    priorityLabel: priorityLabels[deal.priority_level] ?? deal.priority_level,
    organisation: organizationMap[deal.client_organization_id] ?? "Organisation inconnue",
    sector: deal.sector ?? "N/A",
    valuation: formatAmount(deal.valuation_amount),
    fundraising: formatAmount(deal.fundraising_amount),
    startDate: formatDate(deal.start_date),
    targetDate: formatDate(deal.target_date),
    description: deal.description ?? "—",
  }));

  const activeDeals = formattedDeals.filter((deal) => deal.statusLabel === "Actif");
  const inactiveDeals = formattedDeals.filter((deal) => deal.statusLabel !== "Actif");

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Dossiers</h1>
          <p className="mt-2 text-sm text-slate-500">
            Vue métier connectée à Supabase
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total dossiers</p>
            <p className="mt-3 text-3xl font-bold">{formattedDeals.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Actifs</p>
            <p className="mt-3 text-3xl font-bold">{activeDeals.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Inactifs / clôturés</p>
            <p className="mt-3 text-3xl font-bold">{inactiveDeals.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">Supabase</p>
          </div>
        </div>

        {formattedDeals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Aucun dossier trouvé dans Supabase.
          </div>
        ) : (
          <>
            <section className="mb-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Dossiers actifs</h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {activeDeals.length} actifs
                </span>
              </div>

              <div className="space-y-5">
                {activeDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Dossiers inactifs / clôturés</h2>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  {inactiveDeals.length} dossiers
                </span>
              </div>

              <div className="space-y-5">
                {inactiveDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  return (
    <Suspense fallback={<DossiersLoading />}>
      <DossiersContent />
    </Suspense>
  );
}