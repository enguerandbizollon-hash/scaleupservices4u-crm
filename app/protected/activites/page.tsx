import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type ActivityRow = {
  id: string;
  deal_id: string;
  organization_id: string | null;
  contact_id: string | null;
  activity_type: string;
  title: string | null;
  summary: string | null;
  activity_date: string;
  source: string;
};

type TaskRow = {
  id: string;
  deal_id: string | null;
  organization_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  task_status: string;
  priority_level: string;
  due_date: string | null;
};

type AgendaRow = {
  id: string;
  deal_id: string;
  title: string;
  event_type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  description: string | null;
  status: string;
};

type InviteeRow = {
  agenda_event_id: string;
  contact_id: string | null;
  display_name: string | null;
  email: string | null;
};

type DealRow = {
  id: string;
  name: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type ContactRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
};

const activityTypeLabels: Record<string, string> = {
  email_received: "Email reçu",
  email_sent: "Email envoyé",
  call: "Call",
  meeting: "Réunion",
  follow_up: "Relance",
  intro: "Intro",
  note: "Note",
  document_sent: "Document envoyé",
  document_received: "Document reçu",
  nda: "NDA",
  deck_sent: "Deck envoyé",
  bp_sent: "BP envoyé",
  im_sent: "IM envoyé",
  dataroom_opened: "Dataroom ouverte",
  other: "Autre",
};

const sourceLabels: Record<string, string> = {
  manual: "Manuel",
  gmail: "Gmail",
  calendar: "Calendrier",
  drive: "Drive",
  claude: "Claude",
  import: "Import",
  api: "API",
};

const taskStatusLabels: Record<string, string> = {
  open: "Ouverte",
  done: "Terminée",
  cancelled: "Annulée",
};

const priorityLabels: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

const agendaTypeLabels: Record<string, string> = {
  deadline: "Deadline",
  follow_up: "Relance",
  meeting: "Réunion",
  call: "Call",
  delivery: "Rendu",
  closing: "Closing",
  other: "Autre",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function sourceBadgeClass(source: string) {
  if (source === "Manuel") return "bg-slate-100 text-slate-700";
  if (source === "Calendrier") return "bg-blue-100 text-blue-800";
  if (source === "Drive") return "bg-emerald-100 text-emerald-800";
  if (source === "Gmail") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function priorityBadgeClass(priority: string) {
  if (priority === "Haute") return "bg-rose-100 text-rose-800";
  if (priority === "Moyenne") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function ActivitesLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
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
  const supabase = await createClient();

  const [{ data: activitiesData, error: activitiesError }, { data: tasksData }, { data: agendaData }, { data: inviteesData }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id,deal_id,organization_id,contact_id,activity_type,title,summary,activity_date,source")
        .order("activity_date", { ascending: false }),
      supabase
        .from("tasks")
        .select("id,deal_id,organization_id,contact_id,title,description,task_status,priority_level,due_date")
        .eq("task_status", "open")
        .order("due_date", { ascending: true }),
      supabase
        .from("agenda_events")
        .select("id,deal_id,title,event_type,starts_at,ends_at,location,description,status")
        .order("starts_at", { ascending: true }),
      supabase
        .from("agenda_event_invitees")
        .select("agenda_event_id,contact_id,display_name,email"),
    ]);

  if (activitiesError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Erreur Supabase</h1>
          <p className="mt-3 text-sm text-slate-600">
            Impossible de charger les activités depuis la base.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-sm text-white">
            {activitiesError.message}
          </pre>
        </div>
      </div>
    );
  }

  const activities = (activitiesData ?? []) as ActivityRow[];
  const tasks = (tasksData ?? []) as TaskRow[];
  const agendaEvents = (agendaData ?? []) as AgendaRow[];
  const invitees = (inviteesData ?? []) as InviteeRow[];

  const dealIds = [
    ...new Set([
      ...activities.map((row) => row.deal_id),
      ...tasks.map((row) => row.deal_id).filter(Boolean) as string[],
      ...agendaEvents.map((row) => row.deal_id),
    ]),
  ];

  const organizationIds = [
    ...new Set([
      ...activities.map((row) => row.organization_id).filter(Boolean) as string[],
      ...tasks.map((row) => row.organization_id).filter(Boolean) as string[],
    ]),
  ];

  const contactIds = [
    ...new Set([
      ...activities.map((row) => row.contact_id).filter(Boolean) as string[],
      ...tasks.map((row) => row.contact_id).filter(Boolean) as string[],
      ...invitees.map((row) => row.contact_id).filter(Boolean) as string[],
    ]),
  ];

  let dealsMap: Record<string, string> = {};
  let organizationsMap: Record<string, string> = {};
  let contactsMap: Record<string, string> = {};

  if (dealIds.length > 0) {
    const { data } = await supabase.from("deals").select("id,name").in("id", dealIds);
    dealsMap = Object.fromEntries(((data ?? []) as DealRow[]).map((d) => [d.id, d.name]));
  }

  if (organizationIds.length > 0) {
    const { data } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);
    organizationsMap = Object.fromEntries(((data ?? []) as OrganizationRow[]).map((o) => [o.id, o.name]));
  }

  if (contactIds.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id,full_name,first_name,last_name")
      .in("id", contactIds);
    contactsMap = Object.fromEntries(
      ((data ?? []) as ContactRow[]).map((c) => [
        c.id,
        c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      ])
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
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
            <p className="mt-3 text-xl font-bold">Supabase</p>
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
                <div
                  key={activity.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">
                        {activityTypeLabels[activity.activity_type] ?? activity.activity_type}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {activity.title ?? activity.summary ?? "—"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceBadgeClass(
                        sourceLabels[activity.source] ?? activity.source
                      )}`}
                    >
                      {sourceLabels[activity.source] ?? activity.source}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
                      <p className="mt-1 text-sm font-medium">
                        {dealsMap[activity.deal_id] ?? "Dossier inconnu"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                      <p className="mt-1 text-sm font-medium">
                        {activity.contact_id ? contactsMap[activity.contact_id] ?? "—" : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
                      <p className="mt-1 text-sm font-medium">
                        {activity.organization_id
                          ? organizationsMap[activity.organization_id] ?? "—"
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                      <p className="mt-1 text-sm font-medium">
                        {formatDateTime(activity.activity_date)}
                      </p>
                    </div>
                  </div>

                  {activity.summary ? (
                    <div className="mt-4 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Résumé</p>
                      <p className="mt-1 text-sm text-slate-700">{activity.summary}</p>
                    </div>
                  ) : null}
                </div>
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
                  <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {task.contact_id ? contactsMap[task.contact_id] ?? "—" : "—"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityBadgeClass(
                          priorityLabels[task.priority_level] ?? task.priority_level
                        )}`}
                      >
                        {priorityLabels[task.priority_level] ?? task.priority_level}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
                        <p className="mt-1 text-sm font-medium">
                          {task.deal_id ? dealsMap[task.deal_id] ?? "—" : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Échéance</p>
                        <p className="mt-1 text-sm font-medium">{formatDate(task.due_date)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Description
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {task.description ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Agenda dossier</h2>
                <span className="text-sm text-slate-500">{agendaEvents.length} événements</span>
              </div>

              <div className="space-y-4">
                {agendaEvents.map((event) => {
                  const eventInvitees = invitees
                    .filter((i) => i.agenda_event_id === event.id)
                    .map((i) => i.display_name || (i.contact_id ? contactsMap[i.contact_id] : null) || "Invité");

                  return (
                    <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {agendaTypeLabels[event.event_type] ?? event.event_type} •{" "}
                            {dealsMap[event.deal_id] ?? "Dossier inconnu"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Début</p>
                          <p className="mt-1 text-sm font-medium">
                            {formatDateTime(event.starts_at)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Lieu</p>
                          <p className="mt-1 text-sm font-medium">{event.location ?? "—"}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
                        <p className="mt-1 text-sm text-slate-700">{event.description ?? "—"}</p>
                      </div>

                      <div className="mt-4 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Participants
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {eventInvitees.length > 0 ? (
                            eventInvitees.map((name) => (
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
                })}
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