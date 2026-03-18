import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createEventAction } from "./actions";

async function Content() {
  const supabase = await createClient();
  const [{ data: deals }, { data: contacts }] = await Promise.all([
    supabase.from("deals").select("id,name").order("name"),
    supabase.from("contacts").select("id,full_name,first_name,last_name").order("last_name"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Agenda</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Nouvel événement</h1>
          </div>
          <Link href="/protected/agenda" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Retour
          </Link>
        </div>

        <form action={createEventAction} className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Titre *</label>
              <input name="title" required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                <select name="event_type" defaultValue="meeting" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="meeting">Réunion</option>
                  <option value="follow_up">Relance</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Dossier lié *</label>
                <select name="deal_id" required defaultValue="" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="" disabled>Sélectionner</option>
                  {(deals ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Début</label>
                <input name="starts_at" type="datetime-local" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Fin</label>
                <input name="ends_at" type="datetime-local" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Lieu</label>
                <input name="location" placeholder="Ex. Paris, Zoom…" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Lien Google Meet</label>
                <input name="meet_link" type="url" placeholder="https://meet.google.com/…" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea name="description" rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/protected/agenda" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Annuler
            </Link>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Créer l'événement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouvelEvenementPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content />
    </Suspense>
  );
}
