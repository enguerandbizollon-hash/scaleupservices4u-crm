import { Suspense } from "react";
import {
  getOrganizationsView,
  type OrganizationView,
} from "@/lib/crm/get-organizations";

function typeBadgeClass(type: string) {
  if (type === "Client") return "bg-blue-100 text-blue-800";
  if (type === "Investisseur") return "bg-amber-100 text-amber-800";
  if (type === "Avocat") return "bg-violet-100 text-violet-800";
  if (type === "Conseil") return "bg-emerald-100 text-emerald-800";
  if (type === "Corporate") return "bg-slate-200 text-slate-800";
  return "bg-slate-100 text-slate-700";
}

function statusBadgeClass(status: string) {
  if (status === "Actif") return "bg-emerald-100 text-emerald-800";
  if (status === "Qualifié") return "bg-amber-100 text-amber-800";
  if (status === "Inactif") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function OrganisationCard({ org }: { org: OrganizationView }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{org.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {org.sector} • {org.country}
          </p>

          {org.website ? (
            <a
              href={org.website}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
            >
              Accéder au site
            </a>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Aucun site renseigné</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClass(
              org.typeLabel
            )}`}
          >
            {org.typeLabel}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
              org.statusLabel
            )}`}
          >
            {org.statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
          <p className="mt-1 text-sm font-medium">{org.typeLabel}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <p className="mt-1 text-sm font-medium">{org.statusLabel}</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Dossiers concernés
          </p>
          <p className="mt-1 text-sm font-medium">{org.linkedDeals.length}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
        <p className="mt-1 text-sm text-slate-700">{org.notes}</p>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Dossiers concernés
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {org.linkedDeals.length > 0 ? (
            org.linkedDeals.map((deal) => (
              <span
                key={`${org.id}-${deal}`}
                className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
              >
                {deal}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">Aucun dossier lié</span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrganisationsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Organisations</h1>
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

async function OrganisationsContent() {
  const {
    allOrganizations,
    clientsCount,
    investorsCount,
    thirdPartiesCount,
  } = await getOrganizationsView();

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
<div className="mb-8 flex items-center justify-between gap-4">
  <div>
    <p className="text-sm font-medium text-slate-500">Module CRM</p>
    <h1 className="mt-1 text-3xl font-bold tracking-tight">Organisations</h1>
    <p className="mt-2 text-sm text-slate-500">
      Base master des sociétés, investisseurs, clients et tiers
    </p>
  </div>

  <a
    href="/protected/organisations/nouveau"
    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
  >
    Nouvelle organisation
  </a>
</div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Organisations total</p>
            <p className="mt-3 text-3xl font-bold">{allOrganizations.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Clients</p>
            <p className="mt-3 text-3xl font-bold">{clientsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Investisseurs</p>
            <p className="mt-3 text-3xl font-bold">{investorsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tiers / conseils</p>
            <p className="mt-3 text-3xl font-bold">{thirdPartiesCount}</p>
          </div>
        </div>

        {allOrganizations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Aucune organisation trouvée dans Supabase.
          </div>
        ) : (
          <div className="space-y-5">
            {allOrganizations.map((org) => (
              <OrganisationCard key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrganisationsPage() {
  return (
    <Suspense fallback={<OrganisationsLoading />}>
      <OrganisationsContent />
    </Suspense>
  );
}