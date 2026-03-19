import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDealAction } from "@/app/protected/dossiers/nouveau/actions";

function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
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
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select(`
      id,
      name,
      deal_type,
      deal_status,
      deal_stage,
      priority_level,
      client_organization_id,
      sector,
      valuation_amount,
      fundraising_amount,
      description,
      start_date,
      target_date
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erreur chargement dossier: ${error.message}`);
  }

  if (!deal) {
    notFound();
  }

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  if (organizationsError) {
    throw new Error(`Erreur chargement organisations: ${organizationsError.message}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Modifier un dossier</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{deal.name}</h1>
          </div>
          <Link
            href={`/protected/dossiers/${id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retour à la fiche
          </Link>
        </div>

        <form action={updateDealAction} className="space-y-8">
          <input type="hidden" name="deal_id" value={deal.id} />
          <input type="hidden" name="organization_mode" value="existing" />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Informations principales</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nom du dossier
                </label>
                <input
                  name="name"
                  defaultValue={deal.name ?? ""}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Organisation
                </label>
                <select
                  name="client_organization_id"
                  defaultValue={deal.client_organization_id ?? ""}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="">Sélectionner une organisation</option>
                  {(organizations ?? []).map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Type de mission
                </label>
                <select
                  name="deal_type"
                  defaultValue={deal.deal_type}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="fundraising">Fundraising</option>
                  <option value="ma_sell">M&A Sell-side</option>
                  <option value="ma_buy">M&A Buy-side</option>
                  <option value="cfo_advisor">CFO Advisor</option>
                  <option value="recruitment">Recrutement</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Statut
                </label>
                <select
                  name="deal_status"
                  defaultValue={deal.deal_status}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Étape
                </label>
                <select
                  name="deal_stage"
                  defaultValue={deal.deal_stage}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="kickoff">Kickoff</option>
                  <option value="preparation">Préparation</option>
                  <option value="outreach">Outreach</option>
                  <option value="management_meetings">Management meetings</option>
                  <option value="dd">Due diligence</option>
                  <option value="negotiation">Négociation</option>
                  <option value="closing">Closing</option>
                  <option value="post_closing">Post-closing</option>
                  <option value="ongoing_support">Suivi en cours</option>
                  <option value="search">Recherche</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Priorité
                </label>
                <select
                  name="priority_level"
                  defaultValue={deal.priority_level}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Secteur
                </label>
                <input
                  name="sector"
                  defaultValue={deal.sector ?? ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Valorisation (€)
                </label>
                <input
                  name="valuation_amount"
                  type="number"
                  step="any"
                  defaultValue={deal.valuation_amount ?? ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Montant fundraising (€)
                </label>
                <input
                  name="fundraising_amount"
                  type="number"
                  step="any"
                  defaultValue={deal.fundraising_amount ?? ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date lancement
                </label>
                <input
                  name="start_date"
                  type="date"
                  defaultValue={deal.start_date ?? ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date cible
                </label>
                <input
                  name="target_date"
                  type="date"
                  defaultValue={deal.target_date ?? ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                name="description"
                defaultValue={deal.description ?? ""}
                rows={6}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/protected/dossiers/${id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </Link>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditDealPage({
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
