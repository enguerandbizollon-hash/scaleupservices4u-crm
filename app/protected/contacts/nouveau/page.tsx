import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createContactAction } from "./actions";

type OrganizationRow = {
  id: string;
  name: string;
  organization_type: string;
  base_status: string;
};

const contactStatusOptions = [
  { value: "active", label: "Actif" },
  { value: "qualified", label: "Qualifié" },
  { value: "priority", label: "Prioritaire" },
  { value: "inactive", label: "Inactif" },
  { value: "dormant", label: "Dormant" },
];

const ticketOptions = [
  "50K € – 100K €",
  "100K € – 250K €",
  "250K € – 500K €",
  "500K € – 1M €",
  "1M € – 2M €",
  "2M € – 5M €",
  "5M € – 10M €",
  "+10M €",
  "N/A",
];

function NouveauContactLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Nouveau contact</h1>
          <p className="mt-2 text-sm text-slate-500">Chargement du formulaire…</p>
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

async function NouveauContactContent() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,organization_type,base_status")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const organizations = (data ?? []) as OrganizationRow[];

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Module CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Nouveau contact</h1>
            <p className="mt-2 text-sm text-slate-500">
              Création d’un contact dans la base CRM
            </p>
          </div>

          <Link
            href="/protected/contacts"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retour aux contacts
          </Link>
        </div>

        <form
          action={createContactAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Prénom *
              </label>
              <input
                name="first_name"
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nom *
              </label>
              <input
                name="last_name"
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Organisation *
              </label>
              <select
                name="organization_id"
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
                Fonction
              </label>
              <input
                name="title"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Rôle dans l’organisation
              </label>
              <input
                name="role_label"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Ex. CEO, Partner, Contact stratégique"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                name="email"
                type="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Téléphone
              </label>
              <input
                name="phone"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                LinkedIn
              </label>
              <input
                name="linkedin_url"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Secteur
              </label>
              <input
                name="sector"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Ticket d’investissement
              </label>
              <select
                name="investment_ticket_label"
                defaultValue=""
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Sélectionner</option>
                {ticketOptions.map((ticket) => (
                  <option key={ticket} value={ticket}>
                    {ticket}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Pays
              </label>
              <input
                name="country"
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Statut
              </label>
              <select
                name="base_status"
                defaultValue="active"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {contactStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Premier contact
              </label>
              <input
                name="first_contact_at"
                type="date"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Dernier échange
              </label>
              <input
                name="last_contact_at"
                type="date"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Prochaine relance
              </label>
              <input
                name="next_follow_up_at"
                type="date"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-9">
              <input name="is_primary" type="checkbox" className="h-4 w-4" />
              <label className="text-sm font-medium text-slate-700">
                Contact principal
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                rows={5}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link
              href="/protected/contacts"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Créer le contact
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouveauContactPage() {
  return (
    <Suspense fallback={<NouveauContactLoading />}>
      <NouveauContactContent />
    </Suspense>
  );
}