"use client";

import { useState } from "react";
import { Mail, ExternalLink, Edit, Trash2, Plus, Users, FileText, CheckSquare, Activity } from "lucide-react";

type Contact = { id: string; contactId: string; name: string; title: string; email: string | null; organisation: string; role: string; status: string; lastContact: string; nextFollowUp: string; notes: string };
type Doc = { id: string; name: string; type: string; status: string; url: string | null; version: string; date: string; note: string };
type Task = { id: string; title: string; status: string; priority: string; dueDate: string; description: string };
type Activity = { id: string; type: string; title: string; summary: string; date: string; source: string };

const statusColors: Record<string, string> = {
  to_contact: "bg-slate-100 text-slate-600",
  contacted: "bg-blue-100 text-blue-700",
  to_follow_up: "bg-amber-100 text-amber-700",
  in_discussion: "bg-indigo-100 text-indigo-700",
  meeting_done: "bg-violet-100 text-violet-700",
  strong_interest: "bg-emerald-100 text-emerald-700",
  waiting: "bg-slate-100 text-slate-500",
  no_go: "bg-red-100 text-red-700",
  partner_active: "bg-teal-100 text-teal-700",
};

const priorityColors: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500",
};

const taskStatusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export function DealTabs({
  dealId, contacts, docs, tasks, activities, description,
  openTasksCount, contactsCount, docsCount
}: {
  dealId: string;
  contacts: Contact[];
  docs: Doc[];
  tasks: Task[];
  activities: Activity[];
  description: string;
  openTasksCount: number;
  contactsCount: number;
  docsCount: number;
}) {
  const [activeTab, setActiveTab] = useState<"contacts" | "docs" | "tasks" | "activities">("contacts");

  const tabs = [
    { id: "contacts" as const, label: "Contacts", icon: Users, count: contactsCount },
    { id: "docs" as const, label: "Documents", icon: FileText, count: docsCount },
    { id: "tasks" as const, label: "Tâches & Relances", icon: CheckSquare, count: openTasksCount },
    { id: "activities" as const, label: "Activités", icon: Activity, count: activities.length },
  ];

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

      {/* Content */}
      <div className="p-6">

        {/* CONTACTS */}
        {activeTab === "contacts" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">PARTIES PRENANTES</p>
              <a href={`/protected/dossiers/${dealId}/ajouter-contact`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun contact lié à ce dossier.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1B2D] text-xs font-bold text-[#C9A84C]">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#0F1B2D] text-sm">{c.name}</span>
                          {c.status && c.status !== "—" && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {c.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{c.title} · {c.organisation}</p>
                        {c.role !== "—" && <p className="text-xs text-[#C9A84C]">{c.role}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                      <span className="hidden sm:block">Relance : {c.nextFollowUp}</span>
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8E0D0] hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors">
                          <Mail size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === "docs" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-slate-400">DOCUMENTS</p>
              <a href={`/protected/dossiers/${dealId}/ajouter-document`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun document pour ce dossier.</p>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <FileText size={14} className="text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#0F1B2D] text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.date} · {doc.version}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                          <ExternalLink size={11} /> Ouvrir
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pas de lien</span>
                      )}
                      <a href={`/protected/dossiers/${dealId}/modifier-document/${doc.id}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors">
                        <Edit size={12} />
                      </a>
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
              <a href={`/protected/agenda/nouvelle-tache?deal=${dealId}`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune tâche pour ce dossier.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0F1B2D] text-sm">{t.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskStatusColors[t.status] ?? "bg-slate-100"}`}>
                          {t.status === "open" ? "À faire" : t.status === "done" ? "Terminé" : "Annulé"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColors[t.priority] ?? "bg-slate-100"}`}>
                          {t.priority === "high" ? "Haute" : t.priority === "medium" ? "Moyenne" : "Basse"}
                        </span>
                      </div>
                      {t.description && <p className="mt-0.5 text-xs text-slate-400 truncate">{t.description}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{t.dueDate}</span>
                  </div>
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
              <p className="text-sm text-slate-400 text-center py-8">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 mt-0.5">
                      {a.type.charAt(0)}
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
      </div>
    </div>
  );
}
