"use client";

import { useMemo, useState } from "react";

export default function DocumentsPage() {
  const [search, setSearch] = useState("");

  const documents = [
    {
      name: "Investor Deck v7",
      type: "Deck",
      status: "Modélisé",
      url: "https://drive.google.com/",
      date: "16/03/2026",
      version: "v7",
      owner: "Enguérand",
      deal: "Redpeaks",
      notes: "Version prête pour envoi aux fonds prioritaires.",
    },
    {
      name: "NDA Cabinet X",
      type: "Juridique",
      status: "Reçu",
      url: "https://drive.google.com/",
      date: "15/03/2026",
      version: "v2",
      owner: "Christophe",
      deal: "Hello Justice",
      notes: "Document signé et reçu, à archiver dans la data room.",
    },
    {
      name: "Prévisionnel de trésorerie",
      type: "Finance",
      status: "Demandé",
      url: "https://drive.google.com/",
      date: "14/03/2026",
      version: "v1",
      owner: "Marcella",
      deal: "Mission CFO - Client A",
      notes: "En attente de la version finalisée par la direction.",
    },
    {
      name: "Shortlist candidats",
      type: "RH",
      status: "Finalisé",
      url: "https://drive.google.com/",
      date: "16/03/2026",
      version: "v3",
      owner: "Christophe",
      deal: "Recrutement - Analyste",
      notes: "Liste finale pour planification des entretiens.",
    },
  ];

  const checklistByDeal = [
    {
      deal: "Redpeaks",
      type: "Fundraising",
      items: [
        {
          label: "Deck investisseurs finalisé",
          checked: true,
          owner: "Enguérand",
          dueDate: "18/03/2026",
          status: "Finalisé",
          note: "Version v7 prête",
        },
        {
          label: "Business plan mis à jour",
          checked: true,
          owner: "Christophe",
          dueDate: "20/03/2026",
          status: "En cours",
          note: "Dernier arbitrage sur hypothèses 2026",
        },
        {
          label: "Liste investisseurs priorisés",
          checked: false,
          owner: "Enguérand",
          dueDate: "19/03/2026",
          status: "À faire",
          note: "À finaliser par tiering",
        },
      ],
    },
    {
      deal: "Hello Justice",
      type: "Fundraising",
      items: [
        {
          label: "Documentation juridique consolidée",
          checked: false,
          owner: "Christophe",
          dueDate: "19/03/2026",
          status: "En cours",
          note: "Cabinet X en attente de pièces",
        },
        {
          label: "Narratif investisseurs mis à jour",
          checked: true,
          owner: "Enguérand",
          dueDate: "17/03/2026",
          status: "Finalisé",
          note: "Version relue",
        },
      ],
    },
    {
      deal: "Mission CFO - Client A",
      type: "CFO Advisor",
      items: [
        {
          label: "Balance âgée reçue",
          checked: true,
          owner: "Marcella",
          dueDate: "15/03/2026",
          status: "Reçu",
          note: "Document reçu",
        },
        {
          label: "Prévisionnel de trésorerie finalisé",
          checked: false,
          owner: "Marcella",
          dueDate: "20/03/2026",
          status: "Demandé",
          note: "En attente client",
        },
      ],
    },
    {
      deal: "Recrutement - Analyste",
      type: "Recrutement",
      items: [
        {
          label: "Fiche de poste validée",
          checked: true,
          owner: "Christophe",
          dueDate: "14/03/2026",
          status: "Finalisé",
          note: "OK",
        },
        {
          label: "Shortlist candidats finalisée",
          checked: true,
          owner: "Marcella",
          dueDate: "16/03/2026",
          status: "Finalisé",
          note: "3 profils retenus",
        },
        {
          label: "Entretiens planifiés",
          checked: false,
          owner: "Christophe",
          dueDate: "21/03/2026",
          status: "À faire",
          note: "En cours de coordination",
        },
      ],
    },
  ];

  const priorities = [
    {
      title: "Envoyer investor deck",
      deal: "Redpeaks",
      status: "Haute",
      dueDate: "18/03/2026",
      owner: "Enguérand",
      note: "Fonds Tier 1 en priorité",
    },
    {
      title: "Récupérer pièces juridiques manquantes",
      deal: "Hello Justice",
      status: "Haute",
      dueDate: "19/03/2026",
      owner: "Christophe",
      note: "Dépend du cabinet",
    },
    {
      title: "Obtenir prévisionnel final",
      deal: "Mission CFO - Client A",
      status: "Moyenne",
      dueDate: "20/03/2026",
      owner: "Marcella",
      note: "Client à relancer",
    },
    {
      title: "Planifier les entretiens",
      deal: "Recrutement - Analyste",
      status: "Haute",
      dueDate: "21/03/2026",
      owner: "Christophe",
      note: "Coordination candidats / équipe",
    },
  ];

  const ownerBadgeClass = (owner: string) => {
    if (owner === "Enguérand") return "bg-blue-100 text-blue-800";
    if (owner === "Christophe") return "bg-amber-100 text-amber-800";
    if (owner === "Marcella") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-700";
  };

  const docStatusClass = (status: string) => {
    if (status === "Demandé") return "bg-amber-100 text-amber-800";
    if (status === "Reçu") return "bg-blue-100 text-blue-800";
    if (status === "Modélisé") return "bg-violet-100 text-violet-800";
    if (status === "Finalisé") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-700";
  };

  const priorityClass = (status: string) => {
    if (status === "Haute") return "bg-rose-100 text-rose-800";
    if (status === "Moyenne") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;

    return documents.filter((doc) =>
      [doc.name, doc.type, doc.status, doc.deal, doc.owner, doc.notes]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [search]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Module CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Documents / Checklists / Priorités
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Pilotage documentaire et suivi opérationnel par dossier
            </p>
          </div>

          <div className="w-full max-w-md">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Recherche
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Document, dossier, owner..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
            />
          </div>
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
            <p className="mt-3 text-3xl font-bold">{priorities.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documents filtrés</p>
            <p className="mt-3 text-3xl font-bold">{filteredDocuments.length}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documents dossier</h2>
              <span className="text-sm text-slate-500">
                {filteredDocuments.length} éléments
              </span>
            </div>

            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={`${doc.name}-${doc.deal}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">{doc.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {doc.type} • {doc.deal}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${docStatusClass(
                          doc.status
                        )}`}
                      >
                        {doc.status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                          doc.owner
                        )}`}
                      >
                        {doc.owner}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
                      <p className="mt-1 text-sm font-medium">{doc.version}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                      <p className="mt-1 text-sm font-medium">{doc.date}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
                      <p className="mt-1 text-sm text-slate-700">{doc.notes}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Accéder au document
                    </a>
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
                    key={`${priority.title}-${priority.deal}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold">{priority.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{priority.deal}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(
                            priority.status
                          )}`}
                        >
                          {priority.status}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                            priority.owner
                          )}`}
                        >
                          {priority.owner}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-700">{priority.note}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Échéance : {priority.dueDate}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Checklists</h2>
                <span className="text-sm text-slate-500">
                  {checklistByDeal.length} dossiers
                </span>
              </div>

              <div className="space-y-5">
                {checklistByDeal.map((dealChecklist) => (
                  <div
                    key={dealChecklist.deal}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="mb-4">
                      <p className="font-semibold">{dealChecklist.deal}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Type : {dealChecklist.type}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {dealChecklist.items.map((item) => (
                        <div
                          key={`${dealChecklist.deal}-${item.label}`}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              readOnly
                              className="mt-1 h-4 w-4"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <p className="font-medium">{item.label}</p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                                    {item.status}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-medium ${ownerBadgeClass(
                                      item.owner
                                    )}`}
                                  >
                                    {item.owner}
                                  </span>
                                </div>
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
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}