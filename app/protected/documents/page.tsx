import { Suspense } from "react";
import {
  getDocumentsView,
  type DocumentView,
  type PriorityView,
  type ChecklistGroupView,
} from "@/lib/crm/get-documents";

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

function DocumentCard({ doc }: { doc: DocumentView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{doc.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {doc.documentTypeLabel} • {doc.dealName}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${documentStatusClass(
            doc.documentStatusLabel
          )}`}
        >
          {doc.documentStatusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
          <p className="mt-1 text-sm font-medium">{doc.versionLabel}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
          <p className="mt-1 text-sm font-medium">{doc.addedAt}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Note</p>
          <p className="mt-1 text-sm text-slate-700">{doc.note}</p>
        </div>
      </div>

      <div className="mt-4">
        {doc.documentUrl ? (
          <a
            href={doc.documentUrl}
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
  );
}

function PriorityCard({ priority }: { priority: PriorityView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{priority.title}</p>
          <p className="mt-1 text-sm text-slate-500">{priority.dealName}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(
            priority.priorityLabel
          )}`}
        >
          {priority.priorityLabel}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">{priority.description}</p>
      <p className="mt-2 text-xs text-slate-500">
        Échéance : {priority.dueDate} • Statut : {priority.taskStatusLabel}
      </p>
    </div>
  );
}

function ChecklistCard({ group }: { group: ChecklistGroupView }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-4">
        <p className="font-semibold">{group.dealName}</p>
        <p className="mt-1 text-sm text-slate-500">Type : {group.dealTypeLabel}</p>
      </div>

      <div className="space-y-3">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.isDone}
                readOnly
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <p className="font-medium">{item.label}</p>
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                    {item.itemStatusLabel}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p className="text-sm text-slate-600">
                    Échéance : {item.dueDate}
                  </p>
                  <p className="text-sm text-slate-600">
                    Note : {item.note}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const { documents, priorities, checklistGroups, openPrioritiesCount } =
    await getDocumentsView();

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
            <p className="mt-3 text-3xl font-bold">{checklistGroups.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Priorités ouvertes</p>
            <p className="mt-3 text-3xl font-bold">{openPrioritiesCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">lib/crm</p>
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
                <DocumentCard key={doc.id} doc={doc} />
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
                  <PriorityCard key={priority.id} priority={priority} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Checklists</h2>
                <span className="text-sm text-slate-500">{checklistGroups.length} dossiers</span>
              </div>

              <div className="space-y-5">
                {checklistGroups.map((group) => (
                  <ChecklistCard key={group.dealId} group={group} />
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