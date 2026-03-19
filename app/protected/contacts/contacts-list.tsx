"use client";

import { useState } from "react";
import { Search, Filter, Mail, Linkedin, Edit } from "lucide-react";

type Contact = {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  linkedinUrl: string | null;
  sector: string;
  ticket: string;
  organisation: string;
  status: string;
  notes: string;
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  priority: "bg-rose-100 text-rose-800",
  qualified: "bg-amber-100 text-amber-800",
  to_qualify: "bg-slate-100 text-slate-600",
  dormant: "bg-blue-100 text-blue-800",
  inactive: "bg-slate-200 text-slate-500",
  excluded: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  priority: "Prioritaire",
  qualified: "Qualifié",
  to_qualify: "À qualifier",
  dormant: "Dormant",
  inactive: "Inactif",
  excluded: "Exclu",
};

export function ContactsList({ contacts, stats }: { contacts: Contact[]; stats: { total: number; active: number } }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = contacts.filter(c => {
    const matchSearch = search === "" ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.organisation.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "all" || c.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-widest text-[#C9A84C]">MODULE CRM</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#0F1B2D]">Contacts</h1>
          <p className="mt-1 text-sm text-[#6B8CAE]">{stats.total} contacts · {stats.active} actifs</p>
        </div>
        <a
          href="/protected/contacts/nouveau"
          className="rounded-xl bg-[#0F1B2D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors"
        >
          + Nouveau contact
        </a>
      </div>

      {/* Recherche + Filtres */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, organisation, secteur…"
            className="w-full rounded-xl border border-[#E8E0D0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0F1B2D] outline-none focus:border-[#0F1B2D] focus:ring-1 focus:ring-[#0F1B2D] transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#E8E0D0] bg-white px-4 py-2.5 text-sm text-[#0F1B2D] outline-none focus:border-[#0F1B2D] transition-all"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="priority">Prioritaire</option>
            <option value="qualified">Qualifié</option>
            <option value="to_qualify">À qualifier</option>
            <option value="dormant">Dormant</option>
            <option value="inactive">Inactif</option>
            <option value="excluded">Exclu</option>
          </select>
        </div>
      </div>

      {/* Résultats */}
      <p className="mb-4 text-xs text-slate-400">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E8E0D0] bg-white p-12 text-center">
          <p className="text-sm text-slate-400">Aucun contact trouvé.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(contact => (
            <div key={contact.id} className="rounded-2xl border border-[#E8E0D0] bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F1B2D] text-sm font-bold text-white">
                    {contact.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#0F1B2D]">{contact.fullName}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[contact.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabels[contact.status] ?? contact.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{contact.title} · {contact.organisation}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {contact.sector !== "N/A" && (
                        <span className="rounded-lg bg-[#F5F0E8] px-2.5 py-1 text-xs text-[#6B8CAE]">{contact.sector}</span>
                      )}
                      {contact.ticket !== "N/A" && (
                        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700">{contact.ticket}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {contact.email !== "—" && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors"
                      title={contact.email}
                    >
                      <Mail size={14} />
                    </a>
                  )}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
                    >
                      <Linkedin size={14} />
                    </a>
                  )}
                  <a
                    href={`/protected/contacts/${contact.id}/modifier`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors"
                  >
                    <Edit size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
