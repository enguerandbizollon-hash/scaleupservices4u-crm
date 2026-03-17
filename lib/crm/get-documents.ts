import { createClient } from "@/lib/supabase/server";
import {
  documentTypeLabels,
  documentStatusLabels,
  priorityLabels,
  priorityTaskStatusLabels,
  checklistStatusLabels,
  dealTypeLabels,
} from "@/lib/crm/labels";
import type {
  DocumentView,
  PriorityView,
  ChecklistGroupView,
  ChecklistItemView,
} from "@/lib/crm/types";

type DealDocumentRow = {
  id: string;
  deal_id: string;
  name: string;
  document_type: string;
  document_status: string;
  document_url: string | null;
  version_label: string | null;
  added_at: string | null;
  note: string | null;
};

type DealPriorityRow = {
  id: string;
  deal_id: string;
  title: string;
  description: string | null;
  priority_level: string;
  task_status: string;
  due_date: string | null;
};

type DealChecklistItemRow = {
  id: string;
  deal_id: string;
  label: string;
  item_status: string;
  due_date: string | null;
  note: string | null;
};

type DealRow = {
  id: string;
  name: string;
  deal_type: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

export async function getDocumentsView() {
  const supabase = await createClient();

  const [
    { data: documentsData, error: documentsError },
    { data: prioritiesData, error: prioritiesError },
    { data: checklistData, error: checklistError },
  ] = await Promise.all([
    supabase
      .from("deal_documents")
      .select(
        "id,deal_id,name,document_type,document_status,document_url,version_label,added_at,note"
      )
      .order("added_at", { ascending: false }),
    supabase
      .from("deal_priorities")
      .select("id,deal_id,title,description,priority_level,task_status,due_date")
      .order("due_date", { ascending: true }),
    supabase
      .from("deal_checklist_items")
      .select("id,deal_id,label,item_status,due_date,note")
      .order("due_date", { ascending: true }),
  ]);

  const firstError = documentsError || prioritiesError || checklistError;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const documents = (documentsData ?? []) as DealDocumentRow[];
  const priorities = (prioritiesData ?? []) as DealPriorityRow[];
  const checklistItems = (checklistData ?? []) as DealChecklistItemRow[];

  const dealIds = [
    ...new Set([
      ...documents.map((row) => row.deal_id),
      ...priorities.map((row) => row.deal_id),
      ...checklistItems.map((row) => row.deal_id),
    ]),
  ];

  let dealsMap: Record<string, { name: string; type: string }> = {};

  if (dealIds.length > 0) {
    const { data: dealsData, error: dealsError } = await supabase
      .from("deals")
      .select("id,name,deal_type")
      .in("id", dealIds);

    if (dealsError) {
      throw new Error(dealsError.message);
    }

    dealsMap = Object.fromEntries(
      ((dealsData ?? []) as DealRow[]).map((deal) => [
        deal.id,
        {
          name: deal.name,
          type: dealTypeLabels[deal.deal_type] ?? deal.deal_type,
        },
      ])
    );
  }

  const documentsView: DocumentView[] = documents.map((doc) => ({
    id: doc.id,
    dealName: dealsMap[doc.deal_id]?.name ?? "Dossier inconnu",
    name: doc.name,
    documentTypeLabel: documentTypeLabels[doc.document_type] ?? doc.document_type,
    documentStatusLabel:
      documentStatusLabels[doc.document_status] ?? doc.document_status,
    documentUrl: doc.document_url,
    versionLabel: doc.version_label ?? "—",
    addedAt: formatDate(doc.added_at),
    note: doc.note ?? "—",
  }));

  const prioritiesView: PriorityView[] = priorities.map((priority) => ({
    id: priority.id,
    dealName: dealsMap[priority.deal_id]?.name ?? "Dossier inconnu",
    title: priority.title,
    description: priority.description ?? "—",
    priorityLabel: priorityLabels[priority.priority_level] ?? priority.priority_level,
    taskStatusLabel:
      priorityTaskStatusLabels[priority.task_status] ?? priority.task_status,
    dueDate: formatDate(priority.due_date),
  }));

  const checklistGrouped = checklistItems.reduce<Record<string, DealChecklistItemRow[]>>(
    (acc, item) => {
      if (!acc[item.deal_id]) acc[item.deal_id] = [];
      acc[item.deal_id].push(item);
      return acc;
    },
    {}
  );

  const checklistGroups: ChecklistGroupView[] = Object.entries(checklistGrouped).map(
    ([dealId, items]) => ({
      dealId,
      dealName: dealsMap[dealId]?.name ?? "Dossier inconnu",
      dealTypeLabel: dealsMap[dealId]?.type ?? "—",
      items: items.map<ChecklistItemView>((item) => ({
        id: item.id,
        label: item.label,
        itemStatusLabel:
          checklistStatusLabels[item.item_status] ?? item.item_status,
        isDone: item.item_status === "done",
        dueDate: formatDate(item.due_date),
        note: item.note ?? "—",
      })),
    })
  );

  return {
    documents: documentsView,
    priorities: prioritiesView,
    checklistGroups,
    openPrioritiesCount: prioritiesView.filter(
      (p) => p.taskStatusLabel === "Ouverte"
    ).length,
  };
}