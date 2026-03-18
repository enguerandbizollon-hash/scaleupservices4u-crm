import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateContactAction } from "./actions";
import { deleteContactAction } from "@/app/protected/actions";

const contactStatusOptions = [
  { value: "to_qualify", label: "À qualifier" },
  { value: "qualified", label: "Qualifié" },
  { value: "priority", label: "Prioritaire" },
  { value: "active", label: "Actif" },
  { value: "dormant", label: "Dormant" },
  { value: "inactive", label: "Inactif" },
  { value: "excluded", label: "Exclu" },
];

const ticketOptions = ["50K € – 100K €","100K € – 250K €","250K € – 500K €","500K € – 1M €","1M € – 2M €","2M € – 5M €","5M € – 10M €","+10M €","N/A"];

function Loading() {
  return <div className="p-8"><div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" /></div>;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contact, error }, { data: organizations }] = await Promise.all([
    supabase.from("contacts").select("id,first_name,last_name,email,phone,title,linkedin_url,sector,investment_ticket_label,country,notes,base_status,first_contact_at,last_contact_at,next_follow_up_at").eq("id", id).maybeSingle(),
    supabase.from("organizations").select("id,name").order("name", { ascending: true }),
  ]);

  if (error) throw new Error(`Erreur chargement contact: ${error.message}`);
  if (!contact) notFound();

  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Modifier un contact</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{fullName}</h1>
          </div>
          <Link href="/protected/contacts" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Retour</Link>
        </div>

        <form action={updateContactAction} className="space-y-6">
          <input type="hidden" name="contact_id" value={contact.id} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Informations principales</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Prénom *</label><input name="first_name" defaultValue={contact.first_name ?? ""} required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Nom *</label><input name="last_name" defaultValue={contact.last_name ?? ""} required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Fonction</label><input name="title" defaultValue={contact.title ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Statut</label>
                <select name="base_status" defaultValue={contact.base_status} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  {contactStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Email</label><input name="email" type="email" defaultValue={contact.email ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Téléphone</label><input name="phone" defaultValue={contact.phone ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">LinkedIn</label><input name="linkedin_url" defaultValue={contact.linkedin_url ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Secteur</label><input name="sector" defaultValue={contact.sector ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Pays</label><input name="country" defaultValue={contact.country ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Ticket investissement</label>
                <select name="investment_ticket_label" defaultValue={contact.investment_ticket_label ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="">Sélectionner</option>
                  {ticketOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Organisation</h2>
            <p className="mb-4 text-xs text-slate-500">Optionnel</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Organisation</label>
                <select name="organization_id" defaultValue="" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="">Aucune</option>
                  {(organizations ?? []).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Rôle</label><input name="role_label" placeholder="Ex. CEO, Partner…" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Suivi</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Premier contact</label><input name="first_contact_at" type="date" defaultValue={contact.first_contact_at ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Dernier échange</label><input name="last_contact_at" type="date" defaultValue={contact.last_contact_at ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-slate-700">Prochaine relance</label><input name="next_follow_up_at" type="date" defaultValue={contact.next_follow_up_at ?? ""} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" /></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Notes</h2>
            <textarea name="notes" defaultValue={contact.notes ?? ""} rows={5} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
          </div>

          <div className="flex items-center justify-between">
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <button type="submit" className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Supprimer</button>
            </form>
            <div className="flex gap-3">
              <Link href="/protected/contacts" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Annuler</Link>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ModifierContactPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Loading />}><Content params={params} /></Suspense>;
}
