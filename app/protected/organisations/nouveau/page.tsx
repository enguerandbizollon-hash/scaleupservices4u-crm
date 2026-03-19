import { Suspense } from "react";
import Link from "next/link";
import { createOrganizationAction } from "./actions";

const organizationTypeOptions = [
  { value: "client", label: "Client" },
  { value: "prospect_client", label: "Prospect client" },
  { value: "investor", label: "Investisseur" },
  { value: "buyer", label: "Repreneur" },
  { value: "target", label: "Cible" },
  { value: "law_firm", label: "Cabinet juridique" },
  { value: "bank", label: "Banque" },
  { value: "advisor", label: "Conseil" },
  { value: "accounting_firm", label: "Cabinet comptable" },
  { value: "family_office", label: "Family office" },
  { value: "corporate", label: "Corporate" },
  { value: "consulting_firm", label: "Cabinet de conseil" },
  { value: "other", label: "Autre" },
];

const organizationStatusOptions = [
  { value: "to_qualify", label: "À qualifier" },
  { value: "qualified", label: "Qualifié" },
  { value: "priority", label: "Prioritaire" },
  { value: "active", label: "Actif" },
  { value: "dormant", label: "Dormant" },
  { value: "inactive", label: "Inactif" },
  { value: "excluded", label: "Exclu" },
];

function NouvelleOrganisationLoading() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Nouvelle organisation</h1>
          <p className="mt-2 text-sm text-slate-500">Chargement du formulaire…</p>
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

async function NouvelleOrganisationContent() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Module CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Nouvelle organisation</h1>
            <p className="mt-2 text-sm text-slate-500">Création d'une organisation dans la base CRM</p>
          </div>
          <Link
            href="/protected/organisations"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]"
          >
            Retour aux organisations
          </Link>
        </div>

        <form
          action={createOrganizationAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nom de l'organisation *
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. Redpeaks"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type *
              </label>
              <select
                name="organization_type"
                required
                defaultValue="client"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {organizationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Statut *
              </label>
              <select
                name="base_status"
                required
                defaultValue="active"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {organizationStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Secteur
              </label>
              <input
                name="sector"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. Technologie & SaaS"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Pays
              </label>
              <input
                name="country"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. France"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Site web
              </label>
              <input
                name="website"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                rows={5}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Notes internes"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link
              href="/protected/organisations"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]"
            >
              Annuler
            </Link>
            <button
              type="submit"
              className="rounded-xl bg-[#0F1B2D] px-5 py-3 text-sm font-medium text-white hover:bg-[#163959]"
            >
              Créer l'organisation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouvelleOrganisationPage() {
  return (
    <Suspense fallback={<NouvelleOrganisationLoading />}>
      <NouvelleOrganisationContent />
    </Suspense>
  );
}
