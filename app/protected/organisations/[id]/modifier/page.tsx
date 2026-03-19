import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateOrganizationAction } from "./actions";
import { deleteOrganizationAction } from "@/app/protected/actions";

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

function Loading() {
  return <div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id,name,organization_type,base_status,sector,country,website,notes")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!org) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Modifier une organisation</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{org.name}</h1>
          </div>
          <Link href="/protected/organisations" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]">Retour</Link>
        </div>

        <form action={updateOrganizationAction} className="space-y-5">
          <input type="hidden" name="org_id" value={org.id} />
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Nom *</label>
                <input name="name" defaultValue={org.name} required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                <select name="organization_type" defaultValue={org.organization_type} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  {organizationTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Statut</label>
                <select name="base_status" defaultValue={org.base_status} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  {organizationStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Secteur</label>
                <input name="sector" defaultValue={org.sector ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Pays</label>
                <input name="country" defaultValue={org.country ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Site web</label>
                <input name="website" defaultValue={org.website ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
                <textarea name="notes" defaultValue={org.notes ?? ""} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <form action={deleteOrganizationAction}>
              <input type="hidden" name="id" value={org.id} />
              <button type="submit" className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                Supprimer
              </button>
            </form>
            <div className="flex gap-3">
              <Link href="/protected/organisations" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F5F0E8]">Annuler</Link>
              <button type="submit" className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#163959]">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ModifierOrganisationPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><Content params={params} /></Suspense>;
}
