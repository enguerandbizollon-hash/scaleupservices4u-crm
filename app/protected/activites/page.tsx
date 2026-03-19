import { Suspense } from "react";
import {
  getActivitiesView,
  type ActivityView,
  type TaskView,
  type AgendaEventView,
} from "@/lib/crm/get-activities";

function sourceBadgeClass(source: string) {
  if (source === "Manuel") return "bg-[#F5F0E8] text-slate-700";
  if (source === "Calendrier") return "bg-blue-100 text-blue-800";
  if (source === "Drive") return "bg-emerald-100 text-emerald-800";
  if (source === "Gmail") return "bg-amber-100 text-amber-800";
  return "bg-[#F5F0E8] text-slate-700";
}

function priorityBadgeClass(priority: string) {
  if (priority === "Haute") return "bg-rose-100 text-rose-800";
  if (priority === "Moyenne") return "bg-amber-100 text-amber-800";
  return "bg-[#F5F0E8] text-slate-700";
}

function ActivityCard({ activity }: { activity: ActivityView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{activity.typeLabel}</p>
          <p className="mt-1 text-sm text-slate-700">{activity.title}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceBadgeClass(
            activity.sourceLabel
          )}`}
        >
          {activity.sourceLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
          <p className="mt-1 text-sm font-medium">{activity.dealName}</p>
        </div>
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
          <p className="mt-1 text-sm font-medium">{activity.contactName}</p>
        </div>
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
          <p className="mt-1 text-sm font-medium">{activity.organizationName}</p>
        </div>
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
          <p className="mt-1 text-sm font-medium">{activity.activityDate}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Résumé</p>
        <p className="mt-1 text-sm text-slate-700">{activity.summary}</p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{task.title}</p>
          <p className="mt-1 text-sm text-slate-500">{task.contactName}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(
            task.priorityLabel
          )}`}
        >
          {task.priorityLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
          <p className="mt-1 text-sm font-medium">{task.dealName}</p>
        </div>
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Échéance</p>
          <p className="mt-1 text-sm font-medium">{task.dueDate}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
        <p className="mt-1 text-sm text-slate-700">{task.description}</p>
      </div>
    </div>
  );
}

function AgendaCard({ event }: { event: AgendaEventView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{event.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {event.eventTypeLabel} • {event.dealName}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Début</p>
          <p className="mt-1 text-sm font-medium">{event.startsAt}</p>
        </div>
        <div className="rounded-xl bg-[#F5F0E8] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Lieu</p>
          <p className="mt-1 text-sm font-medium">{event.location}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
        <p className="mt-1 text-sm text-slate-700">{event.description}</p>
      </div>

      <div className="mt-4 rounded-xl bg-[#F5F0E8] p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Participants</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {event.attendees.length > 0 ? (
            event.attendees.map((name) => (
              <span
                key={`${event.id}-${name}`}
                className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">Aucun participant</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivitesLoading() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Activités & Relances</h1>
          <p className="mt-2 text-sm text-slate-500">Chargement depuis Supabase…</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

async function ActivitesContent() {
  const { activities, tasks, agendaEvents } = await getActivitiesView();

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Activités & Relances</h1>
          <p className="mt-2 text-sm text-slate-500">
            Suivi opérationnel connecté à Supabase
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Activités</p>
            <p className="mt-3 text-3xl font-bold">{activities.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Relances ouvertes</p>
            <p className="mt-3 text-3xl font-bold">{tasks.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Événements agenda</p>
            <p className="mt-3 text-3xl font-bold">{agendaEvents.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">lib/crm</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Traçabilité récente</h2>
              <span className="text-sm text-slate-500">{activities.length} éléments</span>
            </div>

            <div className="space-y-4">
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">À relancer</h2>
                <span className="text-sm text-slate-500">{tasks.length} lignes</span>
              </div>

              <div className="space-y-4">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Agenda dossier</h2>
                <span className="text-sm text-slate-500">{agendaEvents.length} événements</span>
              </div>

              <div className="space-y-4">
                {agendaEvents.map((event) => (
                  <AgendaCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivitesPage() {
  return (
    <Suspense fallback={<ActivitesLoading />}>
      <ActivitesContent />
    </Suspense>
  );
}