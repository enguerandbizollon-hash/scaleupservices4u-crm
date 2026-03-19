import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createContactAction } from "./actions";

const contactStatusOptions = [
  { value: "to_qualify", label: "À qualifier" },
  { value: "qualified", label: "Qualifié" },
  { value: "priority", label: "Prioritaire" },
  { value: "active", label: "Actif" },
  { value: "dormant", label: "Dormant" },
  { value: "inactive", label: "Inactif" },
  { value: "excluded", label: "Exclu" },
];

const ticketOptions = [
  "50K € – 100K €","100K € – 250K €","250K € – 500K €","500K € – 1M €",
  "1M € – 2M €","2M € – 5M €","5M € – 10M €","+10M €","N/A",
];

const orgTypeOptions = [
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

async function Content() {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id,name").order("name");
  const organizations = data ?? [];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-widest text-[#C9A84C]">MODULE CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0F1B2D]">Nouveau contact</h1>
          </div>
          <Link href="/protected/contacts" className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">
            Retour
          </Link>
        </div>

        <form action={createContactAction} className="space-y-6">

          {/* Identité */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">IDENTITÉ</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Prénom *</label>
                <input name="first_name" required className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Nom *</label>
                <input name="last_name" required className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Fonction</label>
                <input name="title" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="Ex. Partner, CFO, CEO…" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Statut</label>
                <select name="base_status" defaultValue="active" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                  {contactStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Email</label>
                <input name="email" type="email" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Téléphone</label>
                <input name="phone" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">LinkedIn</label>
                <input name="linkedin_url" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="https://linkedin.com/in/…" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Secteur</label>
                <input name="sector" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Pays</label>
                <input name="country" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Ticket investissement</label>
                <select name="investment_ticket_label" defaultValue="" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                  <option value="">Sélectionner</option>
                  {ticketOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Organisation */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">ORGANISATION</h2>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Mode</label>
              <select name="organization_mode" defaultValue="existing" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="none">Aucune organisation</option>
                <option value="existing">Organisation existante</option>
                <option value="new">Créer une nouvelle organisation</option>
              </select>
            </div>

            {/* Organisation existante */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Organisation existante</label>
                <select name="organization_id" defaultValue="" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                  <option value="">Sélectionner</option>
                  {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Rôle dans l'organisation</label>
                <input name="role_label" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="Ex. CEO, Partner…" />
              </div>
              <div className="flex items-center gap-3 pt-8">
                <input name="is_primary" type="checkbox" className="h-4 w-4" />
                <label className="text-sm font-medium text-[#0F1B2D]">Contact principal</label>
              </div>
            </div>

            {/* Nouvelle organisation */}
            <div className="mt-4 rounded-xl border border-[#E8E0D0] bg-[#F5F0E8]/50 p-4">
              <p className="mb-3 text-xs font-semibold tracking-widest text-[#6B8CAE]">NOUVELLE ORGANISATION</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Nom *</label>
                  <input name="new_org_name" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="Ex. Sequoia Capital" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Type</label>
                  <select name="new_org_type" defaultValue="investor" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                    {orgTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Pays</label>
                  <input name="new_org_country" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Site web</label>
                  <input name="new_org_website" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="https://…" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Secteur</label>
                  <input name="new_org_sector" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
              </div>
            </div>
          </div>

          {/* Suivi */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">SUIVI</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Premier contact</label>
                <input name="first_contact_at" type="date" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Dernier échange</label>
                <input name="last_contact_at" type="date" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Prochaine relance</label>
                <input name="next_follow_up_at" type="date" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">NOTES</h2>
            <textarea name="notes" rows={4} className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/protected/contacts" className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Annuler</Link>
            <button type="submit" className="rounded-xl bg-[#0F1B2D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1B2A4A]">Créer le contact</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouveauContactPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content />
    </Suspense>
  );
}
