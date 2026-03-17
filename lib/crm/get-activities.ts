import { createClient } from "@/lib/supabase/server";
import {
  activityTypeLabels,
  sourceLabels,
  priorityLabels,
  agendaTypeLabels,
} from "@/lib/crm/labels";
import type {
  ActivityView,
  TaskView,
  AgendaEventView,
} from "@/lib/crm/types";

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

export async function getActivitiesView() {
  const supabase = await createClient();

  const [
    { data: activitiesData, error: activitiesError },
    { data: tasksData, error: tasksError },
    { data: agendaData, error: agendaError },
    { data: inviteesData, error: inviteesError },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id,deal_id,organization_id,contact_id,activity_type,title,summary,activity_date,source"
      )
      .order("activity_date", { ascending: false }),
    supabase
      .from("tasks")
      .select(
        "id,deal_id,organization_id,contact_id,title,description,task_status,priority_level,due_date"
      )
      .eq("task_status", "open")
      .order("due_date", { ascending: true }),
    supabase
      .from("agenda_events")
      .select(
        "id,deal_id,title,event_type,starts_at,ends_at,location,description,status"
      )
      .order("starts_at", { ascending: true }),
    supabase
      .from("agenda_event_invitees")
      .select("agenda_event_id,contact_id,display_name,email"),
  ]);

  const firstError = activitiesError || tasksError || agendaError || inviteesError;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const activities = (activitiesData ?? []) as ActivityRow[];
  const tasks = (tasksData ?? []) as TaskRow[];
  const agendaEvents = (agendaData ?? []) as AgendaRow[];
  const invitees = (inviteesData ?? []) as InviteeRow[];

  const dealIds = [
    ...new Set([
      ...activities.map((row) => row.deal_id),
      ...(tasks.map((row) => row.deal_id).filter(Boolean) as string[]),
      ...agendaEvents.map((row) => row.deal_id),
    ]),
  ];

  const organizationIds = [
    ...new Set([
      ...(activities.map((row) => row.organization_id).filter(Boolean) as string[]),
      ...(tasks.map((row) => row.organization_id).filter(Boolean) as string[]),
    ]),
  ];

  const contactIds = [
    ...new Set([
      ...(activities.map((row) => row.contact_id).filter(Boolean) as string[]),
      ...(tasks.map((row) => row.contact_id).filter(Boolean) as string[]),
      ...(invitees.map((row) => row.contact_id).filter(Boolean) as string[]),
    ]),
  ];

  let dealsMap: Record<string, string> = {};
  let organizationsMap: Record<string, string> = {};
  let contactsMap: Record<string, string> = {};

  if (dealIds.length > 0) {
    const { data, error } = await supabase.from("deals").select("id,name").in("id", dealIds);
    if (error) throw new Error(error.message);
    dealsMap = Object.fromEntries(((data ?? []) as DealRow[]).map((d) => [d.id, d.name]));
  }

  if (organizationIds.length > 0) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);
    if (error) throw new Error(error.message);
    organizationsMap = Object.fromEntries(
      ((data ?? []) as OrganizationRow[]).map((o) => [o.id, o.name])
    );
  }

  if (contactIds.length > 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id,full_name,first_name,last_name")
      .in("id", contactIds);
    if (error) throw new Error(error.message);
    contactsMap = Object.fromEntries(
      ((data ?? []) as ContactRow[]).map((c) => [
        c.id,
        c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      ])
    );
  }

  const activitiesView: ActivityView[] = activities.map((activity) => ({
    id: activity.id,
    typeLabel: activityTypeLabels[activity.activity_type] ?? activity.activity_type,
    title: activity.title ?? "—",
    summary: activity.summary ?? "—",
    dealName: dealsMap[activity.deal_id] ?? "Dossier inconnu",
    contactName: activity.contact_id ? contactsMap[activity.contact_id] ?? "—" : "—",
    organizationName: activity.organization_id
      ? organizationsMap[activity.organization_id] ?? "—"
      : "—",
    sourceLabel: sourceLabels[activity.source] ?? activity.source,
    activityDate: formatDateTime(activity.activity_date),
  }));

  const tasksView: TaskView[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description ?? "—",
    dealName: task.deal_id ? dealsMap[task.deal_id] ?? "—" : "—",
    contactName: task.contact_id ? contactsMap[task.contact_id] ?? "—" : "—",
    priorityLabel: priorityLabels[task.priority_level] ?? task.priority_level,
    dueDate: formatDate(task.due_date),
  }));

  const agendaEventsView: AgendaEventView[] = agendaEvents.map((event) => {
    const eventInvitees = invitees
      .filter((i) => i.agenda_event_id === event.id)
      .map(
        (i) =>
          i.display_name ||
          (i.contact_id ? contactsMap[i.contact_id] : null) ||
          "Invité"
      );

    return {
      id: event.id,
      title: event.title,
      eventTypeLabel: agendaTypeLabels[event.event_type] ?? event.event_type,
      dealName: dealsMap[event.deal_id] ?? "Dossier inconnu",
      startsAt: formatDateTime(event.starts_at),
      location: event.location ?? "—",
      description: event.description ?? "—",
      attendees: eventInvitees,
    };
  });

  return {
    activities: activitiesView,
    tasks: tasksView,
    agendaEvents: agendaEventsView,
  };
}