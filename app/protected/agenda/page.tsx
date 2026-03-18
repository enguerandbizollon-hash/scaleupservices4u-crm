import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteTaskAction, deleteEventAction } from "@/app/protected/actions";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function Loading() {
  return (
    <div className="p-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 mb-8" />
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
      </div>
    </div>
  );
}

async function AgendaContent() {
  const supabase = await createClient();

  const [{ data: events }, { data: tasks }, { data: deals }] = await Promise.all([
    supabase.from("agenda_events").select("id,title,event_type,starts_at,ends_at,location,meet_link,description,status,deal_id").order("starts_at", { ascending: true }),
    supabase.from("tasks").select("id,title,description,task_status,priority_level,due_date,deal_id").order("due_date", { ascending: true }),
    supabase.from("deals").select("id,name"),
  ]);

  const dealsMap: Record<string, string> = Object.fromEntries((deals ?? []).map(d => [d.id, d.name]));

  const eventTypeLabels: Record<string, string> = { deadline: "Deadline", follow_up: "Relance", meeting: "Réunion" };
  const taskStatusLabels: Record<string, string> = { todo: "À faire", in_progress: "En cours", done: "Terminé", cancelled: "Annulé" };
  const priorityClass: Record<string, string> = { high: "bg-rose-100 text-rose-800", medium: "bg-amber-100 text-amber-800", low: "bg-slate-100 text-slate-700" };
  const statusClass: Record<string, string> = { todo: "bg-slate-100 text-slate-700", in_progress: "bg-blue-100 text-blue-800", done: "bg-emerald-100 text-emerald-800", cancelled: "bg-rose-100 text-rose-800" };

  const upcomingEvents = (events ?? []).filter(e => e.status !== "cancelled");
  const pendingTasks = (tasks ?? []).filter(t => t.task_status !== "done" && t.task_status !== "cancelled");

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Agenda</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/protected/agenda/nouvelle-tache" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            + Tâche
          </Link>
          <Link href="/protected/agenda/nouvel-evenement" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            + Événement
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Événements */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Événements à venir</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{upcomingEvents.length}</span>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucun événement.</div>
            ) : upcomingEvents.map(event => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{event.title}</p>
                    {event.deal_id && <p className="mt-0.5 text-xs text-slate-500">{dealsMap[event.deal_id] ?? "—"}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {eventTypeLabels[event.event_type] ?? event.event_type}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Début</p>
                    <p className="mt-0.5 text-sm font-medium">{formatDate(event.starts_at)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Lieu</p>
                    <p className="mt-0.5 text-sm font-medium">{event.location ?? "—"}</p>
                  </div>
                </div>
                {event.meet_link && (
                  <a
                    href={event.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    🎥 Rejoindre Google Meet
                  </a>
                )}
                {event.description && <p className="mt-3 text-xs text-slate-500">{event.description}</p>}
                <div className="mt-3 flex justify-end">
                  <form action={deleteEventAction}>
                    <input type="hidden" name="id" value={event.id} />
                    <button type="submit" className="text-xs text-rose-500 hover:text-rose-700 hover:underline" onClick={e => { if (!confirm("Supprimer cet événement ?")) e.preventDefault(); }}>
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tâches */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Tâches en cours</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{pendingTasks.length}</span>
          </div>
          <div className="space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucune tâche.</div>
            ) : pendingTasks.map(task => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{task.title}</p>
                    {task.deal_id && <p className="mt-0.5 text-xs text-slate-500">{dealsMap[task.deal_id] ?? "—"}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass[task.priority_level] ?? "bg-slate-100 text-slate-700"}`}>
                      {task.priority_level === "high" ? "Haute" : task.priority_level === "medium" ? "Moyenne" : "Basse"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[task.task_status] ?? "bg-slate-100 text-slate-700"}`}>
                      {taskStatusLabels[task.task_status] ?? task.task_status}
                    </span>
                  </div>
                </div>
                {task.description && <p className="mt-2 text-xs text-slate-500">{task.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Échéance : <span className="font-medium text-slate-900">{formatDateOnly(task.due_date)}</span></p>
                  </div>
                  <form action={deleteTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="text-xs text-rose-500 hover:text-rose-700 hover:underline" onClick={e => { if (!confirm("Supprimer cette tâche ?")) e.preventDefault(); }}>
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AgendaContent />
    </Suspense>
  );
}
