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
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-[#6B8CAE]">{org?.name}</p>
            <h1 className="text-2xl font-bold text-[#0F1B2D]">Ajouter un contact</h1>
          </div>
          <Link href={`/protected/organisations/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Retour</Link>
        </div>

        <form action={addContactToOrgAction} className="space-y-5">
          <input type="hidden" name="org_id" value={id} />

          {/* Mode */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Type d'ajout</label>
              <select name="contact_mode" defaultValue="existing" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="existing">Contact existant dans la base</option>
                <option value="new">Créer un nouveau contact</option>
              </select>
            </div>

            {/* Contact existant */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Contact existant</label>
              <select name="contact_id" defaultValue="" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                <option value="">Sélectionner un contact</option>
                {(contacts ?? []).map(c => {
                  const name = c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
                  return <option key={c.id} value={c.id}>{name}{c.title ? ` (${c.title})` : ""}</option>;
                })}
              </select>
            </div>

            {/* Séparateur */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E8E0D0]" />
              <span className="text-xs text-slate-400">OU créer un nouveau</span>
              <div className="flex-1 h-px bg-[#E8E0D0]" />
            </div>

            {/* Nouveau contact */}
            <div className="rounded-xl border border-[#E8E0D0] bg-[#F5F0E8]/50 p-4">
              <p className="mb-3 text-xs font-semibold tracking-widest text-[#6B8CAE]">NOUVEAU CONTACT</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Prénom *</label>
                  <input name="first_name" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Nom *</label>
                  <input name="last_name" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Fonction</label>
                  <input name="title" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="Ex. Partner, CFO…" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Email</label>
                  <input name="email" type="email" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Téléphone</label>
                  <input name="phone" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">LinkedIn</label>
                  <input name="linkedin_url" className="w-full rounded-xl border border-[#E8E0D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" placeholder="https://linkedin.com/in/…" />
                </div>
              </div>
            </div>
          </div>

          {/* Rôle */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">RÔLE DANS L'ORGANISATION</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Rôle</label>
                <input name="role_label" placeholder="Ex. CEO, Partner, Avocat…" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
              </div>
              <div className="flex items-center gap-3 pt-8">
                <input name="is_primary" type="checkbox" className="h-4 w-4" />
                <label className="text-sm font-medium text-[#0F1B2D]">Contact principal</label>
              </div>
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
  return <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}><Content params={params} /></Suspense>;
}
