import { Suspense } from "react";
import Link from "next/link";
import { getDealDetail } from "@/lib/crm/get-deal-detail";

function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

async function Content({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDealDetail(id);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Fiche dossier</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {data.deal.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {data.deal.typeLabel} •{" "}
              {data.organization?.name ?? "Organisation inconnue"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/protected/dossiers/${id}/modifier`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Modifier
            </Link>

            <Link
              href="/protected/dossiers"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retour aux dossiers
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Informations dossier</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Statut
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.statusLabel}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Étape
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.stageLabel}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Valorisation
              </p>
              <p className="mt-1 text-sm font-medium">{data.deal.valuation}</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Fundraising
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.fundraising}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Secteur
              </p>
              <p className="mt-1 text-sm font-medium">{data.deal.sector}</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Priorité
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.priorityLabel}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Date lancement
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.startDate}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Date cible
              </p>
              <p className="mt-1 text-sm font-medium">
                {data.deal.targetDate}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Description
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {data.deal.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <Content params={params} />
    </Suspense>
  );
}