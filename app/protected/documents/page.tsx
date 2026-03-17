import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

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

const documentTypeLabels: Record<string, string> = {
  pitch_deck: "Pitch deck",
  financial_model: "Modèle financier",
  im: "Information Memorandum",
  teaser: "Teaser",
  nda: "NDA",
  legal: "Juridique",
  finance: "Finance",
  hr: "RH",
  deck: "Deck",
  other: "Autre",
};

const documentStatusLabels: Record<string, string> = {
  requested: "Demandé",
  received: "Reçu",
  modeled: "Modélisé",
  finalized: "Finalisé",
  archived: "Archivé",
};

const priorityLabels: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

const priorityStatusLabels: Record<string, string> = {
  open: "Ouverte",
  done: "Terminée",
  cancelled: "Annulée",
};

const checklistStatusLabels: Record<string, string> = {
  open: "À faire",
  done: "Finalisé",
  cancelled: "Annulé",
};

const dealTypeLabels: Record<string, string> = {
  fundraising: "Fundraising",
  ma_sell: "M&A Sell-side",
  ma_buy: "M&A Buy-side",
  cfo_advisor: "CFO Advisor",
  recruitment: "Recrutement",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function documentStatusClass(status: string) {
  if (status === "Demandé") return "bg-amber-100 text-amber-800";
  if (status === "Reçu") return "bg-blue-100 text-blue-800";
  if (status === "Modélisé") return "bg-violet-100 text-violet-800";
  if (status === "Finalisé") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function priorityClass(priority: string) {
  if (priority === "Haute") return "bg-rose-100 text-rose-800";
  if (priority === "Moyenne") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function DocumentsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Documents / Checklists / Priorités
          </h1>
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

async function DocumentsContent() {
  const supabase = await createClient();

  const [
    { data: documentsData, error: documentsError },
    { data: prioritiesData, error: prioritiesError },
    { data: checklistData, error: checklistError },
  ] = await Promise.all([
    supabase
      .from("deal_documents")
      .select("id,deal_id,name,document_type,document_status,document_url,version_label,added_at,note")
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
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Erreur Supabase</h1>
          <p className="mt-3 text-sm text-slate-600">
            Impossible de charger les documents, checklists ou priorités.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-sm text-white">
            {firstError.message}
          </pre>
        </div>
      </div>
    );
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
    const { data: dealsData } = await supabase
      .from("deals")
      .select("id,name,deal_type")
      .in("id", dealIds);

    dealsMap = Object.fromEntries(
      ((dealsData ?? []) as DealRow[]).map((deal) => [
        deal.id,
        { name: deal.name, type: dealTypeLabels[deal.deal_type] ?? deal.deal_type },
      ])
    );
  }

  const checklistByDeal = Object.entries(
    checklistItems.reduce<Record<string, DealChecklistItemRow[]>>((acc, item) => {
      if (!acc[item.deal_id]) acc[item.deal_id] = [];
      acc[item.deal_id].push(item);
      return acc;
    }, {})
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Documents / Checklists / Priorités
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pilotage documentaire et suivi opérationnel connectés à Supabase
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documents</p>
            <p className="mt-3 text-3xl font-bold">{documents.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Checklists dossiers</p>
            <p className="mt-3 text-3xl font-bold">{checklistByDeal.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Priorités ouvertes</p>
            <p className="mt-3 text-3xl font-bold">
              {priorities.filter((p) => (priorityStatusLabels[p.task_status] ?? p.task_status) === "Ouverte").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">Supabase</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documents dossier</h2>
              <span className="text-sm text-slate-500">{documents.length} éléments</span>
            </div>

            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">{doc.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {documentTypeLabels[doc.document_type] ?? doc.document_type} •{" "}
                        {dealsMap[doc.deal_id]?.name ?? "Dossier inconnu"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${documentStatusClass(
                        documentStatusLabels[doc.document_status] ?? doc.document_status
                      )}`}
                    >
                      {documentStatusLabels[doc.document_status] ?? doc.document_status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
                      <p className="mt-1 text-sm font-medium">{doc.version_label ?? "—"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                      <p className="mt-1 text-sm font-medium">{formatDate(doc.added_at)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Note</p>
                      <p className="mt-1 text-sm text-slate-700">{doc.note ?? "—"}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {doc.document_url ? (
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Accéder au document
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">Aucun lien document</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Priorités</h2>
                <span className="text-sm text-slate-500">{priorities.length} lignes</span>
              </div>

              <div className="space-y-4">
                {priorities.map((priority) => (
                  <div
                    key={priority.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold">{priority.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {dealsMap[priority.deal_id]?.name ?? "Dossier inconnu"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(
                          priorityLabels[priority.priority_level] ?? priority.priority_level
                        )}`}
                      >
                        {priorityLabels[priority.priority_level] ?? priority.priority_level}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-700">
                      {priority.description ?? "—"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Échéance : {formatDate(priority.due_date)} • Statut :{" "}
                      {priorityStatusLabels[priority.task_status] ?? priority.task_status}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Checklists</h2>
                <span className="text-sm text-slate-500">{checklistByDeal.length} dossiers</span>
              </div>

              <div className="space-y-5">
                {checklistByDeal.map(([dealId, items]) => (
                  <div
                    key={dealId}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="mb-4">
                      <p className="font-semibold">{dealsMap[dealId]?.name ?? "Dossier inconnu"}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Type : {dealsMap[dealId]?.type ?? "—"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.item_status === "done"}
                              readOnly
                              className="mt-1 h-4 w-4"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <p className="font-medium">{item.label}</p>
                                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                                  {checklistStatusLabels[item.item_status] ?? item.item_status}
                                </span>
                              </div>

                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <p className="text-sm text-slate-600">
                                  Échéance : {formatDate(item.due_date)}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Note : {item.note ?? "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<DocumentsLoading />}>
      <DocumentsContent />
    </Suspense>
  );
}