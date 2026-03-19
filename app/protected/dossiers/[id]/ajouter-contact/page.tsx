import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addContactToDealAction } from "./actions";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select(`id, first_name, last_name, full_name, title, organization_contacts(organizations(name))`)
    .order("last_name");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#0F1B2D]">Ajouter un contact</h1>
          <Link href={`/protected/dossiers/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Retour</Link>
        </div>
        <form action={addContactToDealAction} className="space-y-4">
          <input type="hidden" name="deal_id" value={id} />
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Contact *</label>
              <select name="contact_id" required defaultValue="" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="" disabled>Sélectionner un contact</option>
                {(contacts ?? []).map(c => {
                  const org = (c.organization_contacts as any)?.[0]?.organizations?.name ?? "";
                  const name = c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
                  return <option key={c.id} value={c.id}>{name}{org ? ` — ${org}` : ""}{c.title ? ` (${c.title})` : ""}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Rôle dans le dossier</label>
              <input name="role_in_deal" placeholder="Ex. CFO, Avocat, Investisseur lead…" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Statut</label>
              <select name="status_in_deal" defaultValue="to_contact" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="to_contact">À contacter</option>
                <option value="contacted">Contacté</option>
                <option value="to_follow_up">À relancer</option>
                <option value="in_discussion">En discussion</option>
                <option value="meeting_done">Meeting tenu</option>
                <option value="strong_interest">Intérêt marqué</option>
                <option value="waiting">En attente</option>
                <option value="no_go">No go</option>
                <option value="partner_active">Suivi en cours</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Link href={`/protected/dossiers/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Annuler</Link>
            <button type="submit" className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A]">Ajouter</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AjouterContactPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="p-8"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div>}><Content params={params} /></Suspense>;
}
