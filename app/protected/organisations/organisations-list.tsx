"use client";

import { useState } from "react";
import { Search, Filter, Globe, Edit } from "lucide-react";

type Org = {
  id: string;
  name: string;
  typeLabel: string;
  statusLabel: string;
  status: string;
  sector: string;
  country: string;
  website: string | null;
  notes: string;
  dealsCount: number;
};

const typeColors: Record<string, string> = {
  "Client": "bg-sky-100 text-sky-800",
  "Prospect client": "bg-blue-100 text-blue-800",
  "Investisseur": "bg-amber-100 text-amber-800",
  "Family office": "bg-amber-100 text-amber-800",
  "Repreneur": "bg-emerald-100 text-emerald-800",
  "Cible": "bg-rose-100 text-rose-800",
  "Cabinet juridique": "bg-violet-100 text-violet-800",
  "Banque": "bg-slate-100 text-slate-700",
  "Conseil": "bg-teal-100 text-teal-800",
  "Cabinet comptable": "bg-indigo-100 text-indigo-800",
  "Corporate": "bg-slate-200 text-slate-700",
  "Cabinet de conseil": "bg-teal-100 text-teal-800",
  "Autre": "bg-slate-100 text-slate-600",
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
  active: "Actif", priority: "Prioritaire", qualified: "Qualifié",
  to_qualify: "À qualifier", dormant: "Dormant", inactive: "Inactif", excluded: "Exclu",
};

export function OrganisationsList({ orgs, stats }: { orgs: Org[]; stats: { total: number } }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const types = [...new Set(orgs.map(o => o.typeLabel))].sort();

  const filtered = orgs.filter(o => {
    const matchSearch = search === "" ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.sector.toLowerCase().includes(search.toLowerCase()) ||
      o.country.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || o.typeLabel === typeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="min-h-screen p-8 bg-[#F5F0E8]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-widest text-[#C9A84C]">MODULE CRM</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#0F1B2D]">Organisations</h1>
          <p className="mt-1 text-sm text-[#6B8CAE]">{stats.total} organisations</p>
        </div>
        <a
          href="/protected/organisations/nouveau"
          className="rounded-xl bg-[#0F1B2D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors"
        >
          + Nouvelle organisation
        </a>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, secteur, pays…"
            className="w-full rounded-xl border border-[#E8E0D0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0F1B2D] outline-none focus:border-[#0F1B2D] focus:ring-1 focus:ring-[#0F1B2D] transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-xl border border-[#E8E0D0] bg-white px-4 py-2.5 text-sm text-[#0F1B2D] outline-none focus:border-[#0F1B2D] transition-all"
          >
            <option value="all">Tous les types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
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
          </select>
        </div>
      </div>

      <p className="mb-4 text-xs text-slate-400">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E8E0D0] bg-white p-12 text-center">
          <p className="text-sm text-slate-400">Aucune organisation trouvée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => (
            <div key={org.id} className="rounded-2xl border border-[#E8E0D0] bg-white p-5 shadow-sm hover:shadow-md hover:border-[#C9A84C] transition-all">
              <div className="flex items-start justify-between gap-4">
                <a href={`/protected/organisations/${org.id}`} className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1B2D] text-sm font-bold text-[#C9A84C]">
                    {org.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#0F1B2D]">{org.name}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColors[org.typeLabel] ?? "bg-slate-100 text-slate-600"}`}>
                        {org.typeLabel}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[org.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabels[org.status] ?? org.statusLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {org.sector !== "N/A" ? org.sector : ""}
                      {org.sector !== "N/A" && org.country !== "N/A" ? " · " : ""}
                      {org.country !== "N/A" ? org.country : ""}
                    </p>
                    {org.dealsCount > 0 && (
                      <p className="mt-1 text-xs text-slate-400">{org.dealsCount} dossier{org.dealsCount > 1 ? "s" : ""}</p>
                    )}
                  </div>
                </a>

                <div className="flex shrink-0 items-center gap-2">
                  {org.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors"
                    >
                      <Globe size={14} />
                    </a>
                  )}
                  <a
                    href={`/protected/organisations/${org.id}/modifier`}
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
