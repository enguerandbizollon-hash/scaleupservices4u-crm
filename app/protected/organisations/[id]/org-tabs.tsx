"use client";

import { useState } from "react";
import { Users, FolderOpen, Activity, CheckSquare, Mail, Linkedin, ExternalLink, Plus } from "lucide-react";

type Contact = { id: string; name: string; title: string; email: string | null; phone: string | null; linkedin: string | null; status: string; role: string; isPrimary: boolean };
type Deal = { id: string; name: string; type: string; status: string; stage: string; priority: string; targetDate: string };
type ActivityItem = { id: string; type: string; title: string; summary: string; date: string };
type Task = { id: string; title: string; status: string; priority: string; dueDate: string };

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800", priority: "bg-rose-100 text-rose-800",
  qualified: "bg-amber-100 text-amber-800", to_qualify: "bg-slate-100 text-slate-600",
  dormant: "bg-blue-100 text-blue-700", inactive: "bg-slate-200 text-slate-500",
};

const priorityColors: Record<string, string> = {
  high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-500",
};

const dealTypeColors: Record<string, string> = {
  "Fundraising": "bg-emerald-100 text-emerald-800", "M&A Sell-side": "bg-amber-100 text-amber-800",
  "M&A Buy-side": "bg-sky-100 text-sky-800", "CFO Advisor": "bg-violet-100 text-violet-800",
  "Recrutement": "bg-rose-100 text-rose-800",
};

export function OrgTabs({ orgId, contacts, deals, activities, tasks }: {
  orgId: string;
  contacts: Contact[];
  deals: Deal[];
  activities: ActivityItem[];
  tasks: Task[];
}) {
  const [activeTab, setActiveTab] = useState<"contacts" | "deals" | "activities" | "tasks">("contacts");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const tabs = [
    { id: "contacts" as const, label: "Contacts", icon: Users, count: contacts.length },
    { id: "deals" as const, label: "Dossiers", icon: FolderOpen, count: deals.length },
    { id: "activities" as const, label: "Activités", icon: Activity, count: activities.length },
    { id: "tasks" as const, label: "Tâches", icon: CheckSquare, count: tasks.filter(t => t.status === "open").length },
  ];

  function toggleEmail(email: string) {
    setSelectedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  }

  return (
    <div className="rounded-2xl border border-[#E8E0D0] bg-white shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E8E0D0] bg-[#F5F0E8]/50">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? "border-[#0F1B2D] text-[#0F1B2D] bg-white" : "border-transparent text-slate-500 hover:text-[#0F1B2D]"}`}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === tab.id ? "bg-[#0F1B2D] text-white" : "bg-slate-200 text-slate-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-6">

        {/* CONTACTS */}
        {activeTab === "contacts" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">CONTACTS LIÉS</p>
              <div className="flex gap-2">
                {selectedEmails.length > 0 && (
                  <a
                    href={`mailto:${selectedEmails.join(",")}`}
                    className="flex items-center gap-1.5 rounded-xl bg-[#C9A84C] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    <Mail size={12} /> Envoyer à {selectedEmails.length} contact{selectedEmails.length > 1 ? "s" : ""}
                  </a>
                )}
                <a href={`/protected/organisations/${orgId}/ajouter-contact`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                  <Plus size={12} /> Ajouter
                </a>
              </div>
            </div>

            {contacts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun contact lié.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className={`flex items-center justify-between gap-4 rounded-xl border p-3 transition-colors ${c.email && selectedEmails.includes(c.email) ? "border-[#C9A84C] bg-amber-50" : "border-[#E8E0D0]"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {c.email && (
                        <input
                          type="checkbox"
                          checked={selectedEmails.includes(c.email)}
                          onChange={() => toggleEmail(c.email!)}
                          className="h-4 w-4 shrink-0 accent-[#C9A84C]"
                        />
                      )}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1B2D] text-xs font-bold text-[#C9A84C]">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[#0F1B2D] text-sm">{c.name}</span>
                          {c.isPrimary && <span className="rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-xs font-medium text-[#C9A84C]">Principal</span>}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status] ?? "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{c.title}{c.role !== "—" ? ` · ${c.role}` : ""}</p>
                        {c.email && <p className="text-xs text-[#6B8CAE]">{c.email}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors">
                          <Mail size={13} />
                        </a>
                      )}
                      {c.linkedin && (
                        <a href={c.linkedin} target="_blank" rel="noreferrer" className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-blue-600 hover:text-blue-600 transition-colors">
                          <Linkedin size={13} />
                        </a>
                      )}
                      <a href={`/protected/contacts/${c.id}/modifier`} className="text-xs text-[#6B8CAE] hover:text-[#0F1B2D] px-2">Modifier</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOSSIERS */}
        {activeTab === "deals" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">DOSSIERS LIÉS</p>
              <a href={`/protected/dossiers/nouveau`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Nouveau dossier
              </a>
            </div>
            {deals.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun dossier lié.</p>
            ) : (
              <div className="space-y-2">
                {deals.map(d => (
                  <a key={d.id} href={`/protected/dossiers/${d.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3 hover:bg-[#F5F0E8] transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0F1B2D] text-sm">{d.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${dealTypeColors[d.type] ?? "bg-slate-100 text-slate-600"}`}>{d.type}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColors[d.priority] ?? "bg-slate-100"}`}>
                          {d.priority === "high" ? "Haute" : d.priority === "medium" ? "Moyenne" : "Basse"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{d.stage} · {d.targetDate}</p>
                    </div>
                    <ExternalLink size={14} className="shrink-0 text-slate-300" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITÉS */}
        {activeTab === "activities" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">HISTORIQUE</p>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune activité.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {a.type.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#0F1B2D] text-sm">{a.title}</span>
                        <span className="shrink-0 text-xs text-slate-400">{a.date}</span>
                      </div>
                      <p className="text-xs text-slate-500">{a.type}</p>
                      {a.summary && <p className="mt-1 text-xs text-slate-400">{a.summary}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TÂCHES */}
        {activeTab === "tasks" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">TÂCHES & RELANCES</p>
              <a href={`/protected/agenda/nouvelle-tache`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune tâche.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0F1B2D] text-sm">{t.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColors[t.priority] ?? "bg-slate-100"}`}>
                          {t.priority === "high" ? "Haute" : t.priority === "medium" ? "Moyenne" : "Basse"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === "open" ? "bg-blue-100 text-blue-700" : t.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {t.status === "open" ? "À faire" : t.status === "done" ? "Terminé" : "Annulé"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Échéance : {t.dueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
