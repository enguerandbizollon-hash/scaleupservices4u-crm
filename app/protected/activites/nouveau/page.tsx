import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDealAction } from "./actions";

type OrganizationRow = {
  id: string;
  name: string;
  organization_type: string;
  base_status: string;
};

const dealTypeOptions = [
  { value: "fundraising", label: "Fundraising" },
  { value: "ma_sell", label: "M&A Sell-side" },
  { value: "ma_buy", label: "M&A Buy-side" },
  { value: "cfo_advisor", label: "CFO Advisor" },
  { value: "recruitment", label: "Recrutement" },
];

const dealStatusOptions = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "closed", label: "Clôturé" },
];

const dealStageOptions = [
  { value: "kickoff", label: "Kickoff" },
  { value: "preparation", label: "Préparation" },
  { value: "outreach", label: "Outreach" },
  { value: "management_meetings", label: "Management meetings" },
  { value: "dd", label: "Due diligence" },
  { value: "negotiation", label: "Négociation" },
  { value: "closing", label: "Closing" },
  { value: "post_closing", label: "Post-closing" },
  { value: "ongoing_support", label: "Suivi en cours" },
  { value: "search", label: "Recherche" },
];

const priorityOptions = [
  { value: "high", label: "Haute" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Basse" },
];

function NouveauDossierLoading() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Nouveau dossier
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Chargement du formulaire…
          </p>
        </div>

        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

async function NouveauDossierContent() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,organization_type,base_status")
    .eq("base_status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const organizations = (data ?? []) as OrganizationRow[];

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Module CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Nouveau dossier
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Création simple d’un dossier CRM
            </p>
          </div>

          <Link
            href="/protected/dossiers"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]"
          >
            Retour aux dossiers
          </Link>
        </div>

        <form
          action={createDealAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nom du dossier *
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. Redpeaks Series A"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type de dossier *
              </label>
              <select
                name="deal_type"
                required
                defaultValue="fundraising"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {dealTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Organisation liée *
              </label>
              <select
                name="client_organization_id"
                required
                defaultValue=""
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="" disabled>
                  Sélectionner une organisation
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Statut *
              </label>
              <select
                name="deal_status"
                required
                defaultValue="active"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {dealStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Étape *
              </label>
              <select
                name="deal_stage"
                required
                defaultValue="preparation"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {dealStageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Priorité *
              </label>
              <select
                name="priority_level"
                required
                defaultValue="medium"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {priorityOptions.map((option) => (
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
                Valorisation
              </label>
              <input
                name="valuation_amount"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. 18000000"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fundraising
              </label>
              <input
                name="fundraising_amount"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. 3000000"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Date de lancement
              </label>
              <input
                name="start_date"
                type="date"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Date cible
              </label>
              <input
                name="target_date"
                type="date"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                name="description"
                rows={5}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Décris brièvement le dossier"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link
              href="/protected/dossiers"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]"
            >
              Annuler
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-[#0F1B2D] px-5 py-3 text-sm font-medium text-white hover:bg-[#163959]"
            >
              Créer le dossier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouveauDossierPage() {
  return (
    <Suspense fallback={<NouveauDossierLoading />}>
      <NouveauDossierContent />
    </Suspense>
  );
}