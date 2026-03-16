"use client";

import { useMemo, useState } from "react";

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  const contacts = [
    {
      fullName: "Barry Dejaeger",
      title: "Director",
      email: "barry.dejaeger@mb.bluecross.ca",
      phone: "+1 514 555 0101",
      linkedin: "https://www.linkedin.com/in/barry-dejaeger",
      sector: "Santé & MedTech",
      ticket: "1M € – 2M €",
      organisation: "Bluecross Canada",
      status: "Actif",
      threadUrl:
        "https://mail.google.com/mail/u/0/#inbox",
      linkedDeals: [
        {
          dealName: "Redpeaks",
          roleInDeal: "Investisseur / partenaire",
          contacted: true,
          contactedAt: "12/03/2026",
          lastContactAt: "16/03/2026",
          nextFollowUpAt: "22/03/2026",
          statusInDeal: "En discussion",
          notes: "Bon niveau d’intérêt, suivre le sujet Datadog plug-in.",
        },
      ],
    },
    {
      fullName: "Louis Martin",
      title: "Partner",
      email: "louis.martin@growth-europe.vc",
      phone: "+33 6 11 22 33 44",
      linkedin: "https://www.linkedin.com/in/louis-martin",
      sector: "Technologie & SaaS",
      ticket: "2M € – 5M €",
      organisation: "Fonds Growth Europe",
      status: "Qualifié",
      threadUrl: "",
      linkedDeals: [
        {
          dealName: "Redpeaks",
          roleInDeal: "Investisseur",
          contacted: true,
          contactedAt: "10/03/2026",
          lastContactAt: "10/03/2026",
          nextFollowUpAt: "20/03/2026",
          statusInDeal: "À relancer",
          notes: "Relance à faire après envoi du one-pager.",
        },
        {
          dealName: "Hello Justice",
          roleInDeal: "Investisseur potentiel",
          contacted: false,
          contactedAt: "",
          lastContactAt: "",
          nextFollowUpAt: "",
          statusInDeal: "À contacter",
          notes: "À qualifier pour l’appétence legal / litigation funding.",
        },
      ],
    },
    {
      fullName: "Claire Durand",
      title: "Avocate associée",
      email: "claire.durand@cabinet-x.fr",
      phone: "+33 6 55 66 77 88",
      linkedin: "https://www.linkedin.com/in/claire-durand",
      sector: "LegalTech & Compliance",
      ticket: "N/A",
      organisation: "Cabinet X",
      status: "Actif",
      threadUrl: "",
      linkedDeals: [
        {
          dealName: "Hello Justice",
          roleInDeal: "Conseil juridique",
          contacted: true,
          contactedAt: "09/03/2026",
          lastContactAt: "15/03/2026",
          nextFollowUpAt: "18/03/2026",
          statusInDeal: "En discussion",
          notes: "En attente de documentation complémentaire.",
        },
      ],
    },
    {
      fullName: "Marc Lambert",
      title: "CEO",
      email: "marc.lambert@clienta.com",
      phone: "+33 6 90 00 11 22",
      linkedin: "https://www.linkedin.com/in/marc-lambert",
      sector: "Industrie & Manufacturing",
      ticket: "N/A",
      organisation: "Client A",
      status: "Actif",
      threadUrl: "",
      linkedDeals: [
        {
          dealName: "Mission CFO - Client A",
          roleInDeal: "Dirigeant",
          contacted: true,
          contactedAt: "11/03/2026",
          lastContactAt: "14/03/2026",
          nextFollowUpAt: "19/03/2026",
          statusInDeal: "Suivi en cours",
          notes: "Attente des chiffres de clôture mensuelle.",
        },
      ],
    },
  ];

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return contacts;

    return contacts.filter((contact) => {
      const contactText = [
        contact.fullName,
        contact.title,
        contact.organisation,
        contact.sector,
        contact.status,
        ...contact.linkedDeals.map((d) => d.dealName),
      ]
        .join(" ")
        .toLowerCase();

      return contactText.includes(term);
    });
  }, [search]);

  const statusBadgeClass = (status: string) => {
    if (status === "Actif") return "bg-emerald-100 text-emerald-800";
    if (status === "Qualifié") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const dealStatusBadgeClass = (status: string) => {
    if (status === "En discussion") return "bg-blue-100 text-blue-800";
    if (status === "À relancer") return "bg-rose-100 text-rose-800";
    if (status === "À contacter") return "bg-amber-100 text-amber-800";
    if (status === "Suivi en cours") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Module CRM</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="mt-2 text-sm text-slate-500">
              Base contacts avec gestion multi-dossiers
            </p>
          </div>

          <div className="w-full max-w-md">
            <label className="mb-2 block text-sm font-medium text-slate-600">
              Rechercher un contact
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, organisation, dossier..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts total</p>
            <p className="mt-3 text-3xl font-bold">{contacts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts filtrés</p>
            <p className="mt-3 text-3xl font-bold">{filteredContacts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts actifs</p>
            <p className="mt-3 text-3xl font-bold">
              {contacts.filter((c) => c.status === "Actif").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Liens dossiers</p>
            <p className="mt-3 text-3xl font-bold">
              {contacts.reduce((acc, c) => acc + c.linkedDeals.length, 0)}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {filteredContacts.map((contact) => (
            <div
              key={contact.fullName}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{contact.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {contact.title} • {contact.organisation}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {contact.sector}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Ticket : {contact.ticket}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                        contact.status
                      )}`}
                    >
                      {contact.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`mailto:${contact.email}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Contacter
                  </a>
                  {contact.threadUrl ? (
                    <a
                      href={contact.threadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Répondre
                    </a>
                  ) : null}
                  <a
                    href={contact.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm font-medium break-all">{contact.email}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Téléphone</p>
                  <p className="mt-1 text-sm font-medium">{contact.phone}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
                  <p className="mt-1 text-sm font-medium">{contact.organisation}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Dossiers concernés</p>
                  <p className="mt-1 text-sm font-medium">{contact.linkedDeals.length}</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Dossiers concernés
                </h3>

                <div className="mt-3 space-y-3">
                  {contact.linkedDeals.map((deal) => (
                    <div
                      key={`${contact.fullName}-${deal.dealName}`}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold">{deal.dealName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Rôle : {deal.roleInDeal}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${dealStatusBadgeClass(
                              deal.statusInDeal
                            )}`}
                          >
                            {deal.statusInDeal}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {deal.contacted ? "Contacté" : "Non contacté"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Date de contact
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {deal.contactedAt || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Dernier échange
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {deal.lastContactAt || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Prochaine relance
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {deal.nextFollowUpAt || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Statut
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {deal.statusInDeal}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Notes
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{deal.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {filteredContacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Aucun contact ne correspond à la recherche.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}