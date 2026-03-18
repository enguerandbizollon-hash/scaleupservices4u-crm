import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  agendaTypeLabels,
  checklistStatusLabels,
  contactPipelineStatusLabels,
  dealStageLabels,
  dealStatusLabels,
  dealTypeLabels,
  documentStatusLabels,
  documentTypeLabels,
  priorityLabels,
  priorityTaskStatusLabels,
} from "@/lib/crm/labels";

type DealRow = {
  id: string;
  name: string;
  deal_type: string;
  deal_status: string;
  deal_stage: string;
  priority_level: string;
  client_organization_id: string | null;
  sector: string | null;
  valuation_amount: number | null;
  fundraising_amount: number | null;
  description: string | null;
  start_date: string | null;
  target_date: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  country: string | null;
  website: string | null;
};

type DealContactJoinedRow = {
  id: string;
  role_in_deal: string | null;
  status_in_deal: string | null;
  contacted: boolean | null;
  contacted_at: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  contact:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        title: string | null;
        email: string | null;
        phone: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        title: string | null;
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

type DealDocumentRow = {
  id: string;
  name: string;
  document_type: string | null;
  document_status: string;
  version_label: string | null;
  added_at: string | null;
  note: string | null;
  document_url: string | null;
};

type DealPriorityRow = {
  id: string;
  title: string;
  description: string | null;
  priority_level: string;
  task_status: string;
  due_date: string | null;
};

type DealChecklistItemRow = {
  id: string;
  label: string;
  item_status: string;
  due_date: string | null;
  note: string | null;
};

type AgendaEventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  event_type: string;
  status: string;
  location: string | null;
};

export type DealDetailResult = {
  deal: {
    id: string;
    name: string;
    type: string;
    typeLabel: string;
    status: string;
    statusLabel: string;
    stage: string;
    stageLabel: string;
    sector: string;
    priority: string;
    priorityLabel: string;
    valuation: string;
    fundraising: string;
    startDate: string;
    targetDate: string;
    description: string;
    organizationId: string | null;
  };
  organization: {
    id: string;
    name: string;
    country: string;
    website: string;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    role: string;
    email: string;
    phone: string;
    contacted: string;
    lastContact: string;
    nextFollowUp: string;
    statusInDeal: string;
    notes: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    version: string;
    status: string;
    date: string;
    note: string;
    url: string | null;
  }>;
  priorities: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string;
  }>;
  checklist: Array<{
    id: string;
    label: string;
    done: boolean;
    status: string;
    dueDate: string;
    note: string;
  }>;
  agenda: Array<{
    id: string;
    title: string;
    description: string;
    startsAt: string;
    eventType: string;
    status: string;
    location: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: number | null | undefined, currency = "EUR") {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeContact(
  contact: DealContactJoinedRow["contact"],
): {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
} | null {
  if (!contact) return null;
  return Array.isArray(contact) ? (contact[0] ?? null) : contact;
}

function getContactDisplayName(contact: ReturnType<typeof normalizeContact>) {
  if (!contact) return "Sans nom";

  if (contact.full_name && contact.full_name.trim().length > 0) {
    return contact.full_name.trim();
  }

  const computed = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return computed || "Sans nom";
}

export async function getDealDetail(id: string): Promise<DealDetailResult> {
  const supabase = await createClient();

  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select(`
      id,
      name,
      deal_type,
      deal_status,
      deal_stage,
      priority_level,
      client_organization_id,
      sector,
      valuation_amount,
      fundraising_amount,
      description,
      start_date,
      target_date
    `)
    .eq("id", id)
    .maybeSingle<DealRow>();

  if (dealError) {
    throw new Error(`Erreur lecture dossier: ${dealError.message}`);
  }

  if (!dealData) {
    notFound();
  }

  const organizationPromise = dealData.client_organization_id
    ? supabase
        .from("organizations")
        .select("id, name, country, website")
        .eq("id", dealData.client_organization_id)
        .maybeSingle<OrganizationRow>()
    : Promise.resolve({ data: null, error: null });

  const contactsPromise = supabase
    .from("deal_contacts")
    .select(`
      id,
      role_in_deal,
      status_in_deal,
      contacted,
      contacted_at,
      first_contact_at,
      last_contact_at,
      next_follow_up_at,
      notes,
      contact:contacts (
        id,
        first_name,
        last_name,
        full_name,
        title,
        email,
        phone
      )
    `)
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  const documentsPromise = supabase
    .from("deal_documents")
    .select(`
      id,
      name,
      document_type,
      document_status,
      version_label,
      added_at,
      note,
      document_url
    `)
    .eq("deal_id", id)
    .order("added_at", { ascending: false });

  const prioritiesPromise = supabase
    .from("deal_priorities")
    .select(`
      id,
      title,
      description,
      priority_level,
      task_status,
      due_date
    `)
    .eq("deal_id", id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const checklistPromise = supabase
    .from("deal_checklist_items")
    .select(`
      id,
      label,
      item_status,
      due_date,
      note
    `)
    .eq("deal_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const agendaPromise = supabase
    .from("agenda_events")
    .select(`
      id,
      title,
      description,
      starts_at,
      event_type,
      status,
      location
    `)
    .eq("deal_id", id)
    .order("starts_at", { ascending: true, nullsFirst: false });

  const [
    organizationResult,
    contactsResult,
    documentsResult,
    prioritiesResult,
    checklistResult,
    agendaResult,
  ] = await Promise.all([
    organizationPromise,
    contactsPromise,
    documentsPromise,
    prioritiesPromise,
    checklistPromise,
    agendaPromise,
  ]);

  if (organizationResult.error) throw new Error(organizationResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (documentsResult.error) throw new Error(documentsResult.error.message);
  if (prioritiesResult.error) throw new Error(prioritiesResult.error.message);
  if (checklistResult.error) throw new Error(checklistResult.error.message);
  if (agendaResult.error) throw new Error(agendaResult.error.message);

  const contacts = ((contactsResult.data ?? []) as DealContactJoinedRow[]).map((row) => {
    const contact = normalizeContact(row.contact);

    return {
      id: contact?.id ?? row.id,
      name: getContactDisplayName(contact),
      title: contact?.title ?? "—",
      role: row.role_in_deal ?? "—",
      email: contact?.email ?? "—",
      phone: contact?.phone ?? "—",
      contacted: row.contacted ? "Contacté" : "Non contacté",
      lastContact: formatDate(row.last_contact_at ?? row.contacted_at ?? row.first_contact_at),
      nextFollowUp: formatDate(row.next_follow_up_at),
      statusInDeal:
        (row.status_in_deal && contactPipelineStatusLabels[row.status_in_deal]) ||
        row.status_in_deal ||
        "—",
      notes: row.notes ?? "—",
    };
  });

  const documents = ((documentsResult.data ?? []) as DealDocumentRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    type:
      (row.document_type && documentTypeLabels[row.document_type]) ||
      row.document_type ||
      "—",
    version: row.version_label ?? "—",
    status: documentStatusLabels[row.document_status] ?? row.document_status,
    date: formatDate(row.added_at),
    note: row.note ?? "—",
    url: row.document_url,
  }));

  const priorities = ((prioritiesResult.data ?? []) as DealPriorityRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "—",
    priority: priorityLabels[row.priority_level] ?? row.priority_level,
    status: priorityTaskStatusLabels[row.task_status] ?? row.task_status,
    dueDate: formatDate(row.due_date),
  }));

  const checklist = ((checklistResult.data ?? []) as DealChecklistItemRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    done: row.item_status === "done",
    status: checklistStatusLabels[row.item_status] ?? row.item_status,
    dueDate: formatDate(row.due_date),
    note: row.note ?? "—",
  }));

  const agenda = ((agendaResult.data ?? []) as AgendaEventRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "—",
    startsAt: formatDateTime(row.starts_at),
    eventType: agendaTypeLabels[row.event_type] ?? row.event_type,
    status: priorityTaskStatusLabels[row.status] ?? row.status,
    location: row.location ?? "—",
  }));

  return {
    deal: {
      id: dealData.id,
      name: dealData.name,
      type: dealData.deal_type,
      typeLabel: dealTypeLabels[dealData.deal_type] ?? dealData.deal_type,
      status: dealData.deal_status,
      statusLabel: dealStatusLabels[dealData.deal_status] ?? dealData.deal_status,
      stage: dealData.deal_stage,
      stageLabel: dealStageLabels[dealData.deal_stage] ?? dealData.deal_stage,
      sector: dealData.sector ?? "—",
      priority: dealData.priority_level,
      priorityLabel: priorityLabels[dealData.priority_level] ?? dealData.priority_level,
      valuation: formatMoney(dealData.valuation_amount),
      fundraising: formatMoney(dealData.fundraising_amount),
      startDate: formatDate(dealData.start_date),
      targetDate: formatDate(dealData.target_date),
      description: dealData.description ?? "—",
      organizationId: dealData.client_organization_id,
    },
    organization: organizationResult.data
      ? {
          id: organizationResult.data.id,
          name: organizationResult.data.name,
          country: organizationResult.data.country ?? "—",
          website: organizationResult.data.website ?? "—",
        }
      : null,
    contacts,
    documents,
    priorities,
    checklist,
    agenda,
  };
}