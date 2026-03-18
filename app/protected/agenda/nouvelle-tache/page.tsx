import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTaskAction } from "./actions";

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
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Nouvelle tâche</h1>
          </div>
          <Link href="/protected/agenda" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Retour
          </Link>
        </div>

        <form action={createTaskAction} className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Titre *</label>
              <input name="title" required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea name="description" rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Statut</label>
                <select name="task_status" defaultValue="open" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="open">À faire</option>
                  <option value="done">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Priorité</label>
                <select name="priority_level" defaultValue="medium" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Échéance</label>
                <input name="due_date" type="date" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Dossier lié</label>
                <select name="deal_id" defaultValue="" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="">Aucun</option>
                  {(deals ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Contact lié</label>
                <select name="contact_id" defaultValue="" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500">
                  <option value="">Aucun</option>
                  {(contacts ?? []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/protected/agenda" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Annuler
            </Link>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouvelleTachePage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content />
    </Suspense>
  );
}
