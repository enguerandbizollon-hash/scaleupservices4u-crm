"use client";

import { useMemo, useState } from "react";

export default function ActivitesPage() {
  const [search, setSearch] = useState("");

  const activities = [
    {
      type: "Email envoyé",
      action: "Envoi du one-pager et proposition de call",
      deal: "Redpeaks",
      contact: "Barry Dejaeger",
      organisation: "Bluecross Canada",
      owner: "Enguérand",
      source: "Manuel",
      date: "16/03/2026",
    },
    {
      type: "Réunion",
      action: "Réunion de cadrage juridique",
      deal: "Hello Justice",
      contact: "Claire Durand",
      organisation: "Cabinet X",
      owner: "Christophe",
      source: "Calendrier",
      date: "15/03/2026",
    },
    {
      type: "Document reçu",
      action: "Réception balance âgée et exports comptables",
      deal: "Mission CFO - Client A",
      contact: "Marc Lambert",
      organisation: "Client A",
      owner: "Marcella",
      source: "Drive",
      date: "15/03/2026",
    },
    {
      type: "Call",
      action: "Point d’avancement shortlist candidats",
      deal: "Recrutement - Analyste",
      contact: "Marcella",
      organisation: "Scale Up services 4U",
      owner: "Christophe",
      source: "Manuel",
      date: "14/03/2026",
    },
  ];

  const followUps = [
    {
      contact: "Louis Martin",
      organisation: "Fonds Growth Europe",
      deal: "Redpeaks",
      owner: "Enguérand",
      status: "À relancer",
      lastContact: "10/03/2026",
      nextAction: "Relancer après envoi du one-pager",
      dueDate: "20/03/2026",
    },
    {
      contact: "Claire Durand",
      organisation: "Cabinet X",
      deal: "Hello Justice",
      owner: "Christophe",
      status: "En discussion",
      lastContact: "15/03/2026",
      nextAction: "Relancer sur la documentation juridique",
      dueDate: "18/03/2026",
    },
    {
      contact: "Marc Lambert",
      organisation: "Client A",
      deal: "Mission CFO - Client A",
      owner: "Marcella",
      status: "Suivi en cours",
      lastContact: "14/03/2026",
      nextAction: "Demander la version finalisée du prévisionnel",
      dueDate: "19/03/2026",
    },
  ];

  const agendaEvents = [
    {
      title: "Call investisseurs",
      deal: "Redpeaks",
      type: "Réunion",
      date: "18/03/2026",
      owner: "Enguérand",
      attendees: ["Barry Dejaeger", "Enguérand"],
    },
    {
      title: "Relance documentation juridique",
      deal: "Hello Justice",
      type: "Deadline",
      date: "19/03/2026",
      owner: "Christophe",
      attendees: ["Claire Durand", "Christophe"],
    },
    {
      title: "Revue clôture mensuelle",
      deal: "Mission CFO - Client A",
      type: "Rendu",
      date: "20/03/2026",
      owner: "Marcella",
      attendees: ["Marc Lambert", "Marcella"],
    },
    {
      title: "Entretiens shortlist",
      deal: "Recrutement - Analyste",
      type: "Réunion",
      date: "21/03/2026",
      owner: "Christophe",
      attendees: ["Christophe", "Marcella"],
    },
  ];

  const ownerBadgeClass = (owner: string) => {
    if (owner === "Enguérand") return "bg-blue-100 text-blue-800";
    if (owner === "Christophe") return "bg-amber-100 text-amber-800";
    if (owner === "Marcella") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-700";
  };

  const followUpBadgeClass = (status: string) => {
    if (status === "À relancer") return "bg-rose-100 text-rose-800";
    if (status === "En discussion") return "bg-blue-100 text-blue-800";
    if (status === "Suivi en cours") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-700";
  };

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activities;

    return activities.filter((activity) =>
      [
        activity.type,
        activity.action,
        activity.deal,
        activity.contact,
        activity.organisation,
        activity.owner,
        activity.source,
      ]
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
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Activités & Relances</h1>
            <p className="mt-2 text-sm text-slate-500">
              Suivi opérationnel des échanges, relances et échéances agenda
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
              placeholder="Dossier, contact, organisation..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Activités récentes</p>
            <p className="mt-3 text-3xl font-bold">{activities.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Relances ouvertes</p>
            <p className="mt-3 text-3xl font-bold">{followUps.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Événements agenda</p>
            <p className="mt-3 text-3xl font-bold">{agendaEvents.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Activités filtrées</p>
            <p className="mt-3 text-3xl font-bold">{filteredActivities.length}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Traçabilité récente</h2>
              <span className="text-sm text-slate-500">
                {filteredActivities.length} éléments
              </span>
            </div>

            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={`${activity.type}-${activity.deal}-${activity.date}-${activity.contact}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">{activity.type}</p>
                      <p className="mt-1 text-sm text-slate-700">{activity.action}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {activity.source}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                          activity.owner
                        )}`}
                      >
                        {activity.owner}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
                      <p className="mt-1 text-sm font-medium">{activity.deal}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                      <p className="mt-1 text-sm font-medium">{activity.contact}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
                      <p className="mt-1 text-sm font-medium">{activity.organisation}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                      <p className="mt-1 text-sm font-medium">{activity.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">À relancer</h2>
                <span className="text-sm text-slate-500">{followUps.length} lignes</span>
              </div>

              <div className="space-y-4">
                {followUps.map((item) => (
                  <div
                    key={`${item.contact}-${item.deal}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold">{item.contact}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.organisation}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${followUpBadgeClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                            item.owner
                          )}`}
                        >
                          {item.owner}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Dossier</p>
                        <p className="mt-1 text-sm font-medium">{item.deal}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Dernier contact
                        </p>
                        <p className="mt-1 text-sm font-medium">{item.lastContact}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Prochaine action
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{item.nextAction}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Échéance : {item.dueDate}
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
                {agendaEvents.map((event) => (
                  <div
                    key={`${event.title}-${event.deal}-${event.date}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold">{event.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {event.type} • {event.deal}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                          event.owner
                        )}`}
                      >
                        {event.owner}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                        <p className="mt-1 text-sm font-medium">{event.date}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Participants
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.attendees.map((attendee) => (
                            <span
                              key={attendee}
                              className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                            >
                              {attendee}
                            </span>
                          ))}
                        </div>
                      </div>
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