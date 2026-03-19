import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addContactToOrgAction } from "./actions";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: org }, { data: contacts }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("id, full_name, first_name, last_name, title").order("last_name"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-[#6B8CAE]">{org?.name}</p>
            <h1 className="text-2xl font-bold text-[#0F1B2D]">Ajouter un contact</h1>
          </div>
          <Link href={`/protected/organisations/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Retour</Link>
        </div>
        <form action={addContactToOrgAction} className="space-y-4">
          <input type="hidden" name="org_id" value={id} />
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Contact *</label>
              <select name="contact_id" required defaultValue="" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="" disabled>Sélectionner un contact</option>
                {(contacts ?? []).map(c => {
                  const name = c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
                  return <option key={c.id} value={c.id}>{name}{c.title ? ` (${c.title})` : ""}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Rôle</label>
              <input name="role_label" placeholder="Ex. CEO, Partner, Avocat…" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
            <div className="flex items-center gap-3">
              <input name="is_primary" type="checkbox" className="h-4 w-4" />
              <label className="text-sm font-medium text-[#0F1B2D]">Contact principal</label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Link href={`/protected/organisations/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Annuler</Link>
            <button type="submit" className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A]">Ajouter</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AjouterContactOrgPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="p-8"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div>}><Content params={params} /></Suspense>;
}
