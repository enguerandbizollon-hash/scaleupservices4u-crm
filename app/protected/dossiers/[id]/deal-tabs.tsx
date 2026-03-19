"use client";

import { useState, useTransition } from "react";
import { Users, FileText, CheckSquare, Activity, Mail, ExternalLink, Plus, Check, X, Clock } from "lucide-react";

type Contact = { id: string; contactId: string; name: string; title: string; email: string | null; organisation: string; role: string; status: string; lastContact: string; nextFollowUp: string; notes: string };
type Doc = { id: string; name: string; type: string; status: string; url: string | null; version: string; date: string; note: string };
type Task = { id: string; title: string; status: string; priority: string; dueDate: string; dueDateRaw: string | null; description: string };
type ActivityItem = { id: string; type: string; typeKey: string; title: string; summary: string; date: string; source: string };

const contactStatusColors: Record<string, string> = {
  to_contact: "bg-slate-100 text-slate-600", contacted: "bg-blue-100 text-blue-700",
  to_follow_up: "bg-amber-100 text-amber-700", in_discussion: "bg-indigo-100 text-indigo-700",
  meeting_done: "bg-violet-100 text-violet-700", strong_interest: "bg-emerald-100 text-emerald-700",
  waiting: "bg-slate-100 text-slate-500", no_go: "bg-red-100 text-red-700",
  partner_active: "bg-teal-100 text-teal-700",
};

const contactStatusLabels: Record<string, string> = {
  to_contact: "À contacter", contacted: "Contacté", to_follow_up: "À relancer",
  in_discussion: "En discussion", meeting_done: "Meeting fait", strong_interest: "Intérêt fort",
  waiting: "En attente", no_go: "No go", partner_active: "Actif",
};

const priorityColors: Record<string, string> = {
  high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-500",
};

const activityTypeColors: Record<string, string> = {
  email_sent: "bg-sky-100 text-sky-700", email_received: "bg-blue-100 text-blue-700",
  call: "bg-violet-100 text-violet-700", meeting: "bg-indigo-100 text-indigo-700",
  follow_up: "bg-amber-100 text-amber-700", note: "bg-slate-100 text-slate-600",
  document_sent: "bg-emerald-100 text-emerald-700", nda: "bg-rose-100 text-rose-700",
  deck_sent: "bg-teal-100 text-teal-700",
};

function TaskItem({ task, dealId }: { task: Task; dealId: string }) {
  const [status, setStatus] = useState(task.status);
  const [isPending, startTransition] = useTransition();

  const isOverdue = task.dueDateRaw && new Date(task.dueDateRaw) < new Date() && status === "open";

  async function changeStatus(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", task.id);
      fd.append("status", newStatus);
      fd.append("deal_id", dealId);
      const res = await fetch("/api/update-task-status", { method: "POST", body: fd });
    });
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      status === "done" ? "border-emerald-200 bg-emerald-50 opacity-70" :
      status === "cancelled" ? "border-slate-200 bg-slate-50 opacity-50" :
      isOverdue ? "border-rose-200 bg-rose-50" : "border-[#E8E0D0] bg-white"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${status === "done" ? "line-through text-slate-400" : "text-[#0F1B2D]"}`}>
              {task.title}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColors[task.priority] ?? "bg-slate-100"}`}>
              {task.priority === "high" ? "Haute" : task.priority === "medium" ? "Moyenne" : "Basse"}
            </span>
            {isOverdue && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">En retard</span>}
          </div>
          {task.description && <p className="mt-1 text-xs text-slate-400 truncate">{task.description}</p>}
          <p className="mt-1 text-xs text-slate-400">
            <Clock size={11} className="inline mr-1" />Échéance : {task.dueDate}
          </p>
        </div>

        {/* Boutons statut */}
        <div className="flex shrink-0 gap-1">
          {status !== "done" && (
            <button
              onClick={() => changeStatus("done")}
              disabled={isPending}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
              title="Marquer terminé"
            >
              <Check size={13} />
            </button>
          )}
          {status === "done" && (
            <button
              onClick={() => changeStatus("open")}
              disabled={isPending}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Réouvrir"
            >
              <Clock size={13} />
            </button>
          )}
          {status !== "cancelled" && status !== "done" && (
            <button
              onClick={() => changeStatus("cancelled")}
              disabled={isPending}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
              title="Annuler"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DealTabs({ dealId, contacts, docs, tasks, activities, description, openTasksCount, contactsCount, docsCount }: {
  dealId: string; contacts: Contact[]; docs: Doc[]; tasks: Task[]; activities: ActivityItem[];
  description: string; openTasksCount: number; contactsCount: number; docsCount: number;
}) {
  const [activeTab, setActiveTab] = useState<"contacts" | "docs" | "tasks" | "activities">("contacts");

  const tabs = [
    { id: "contacts" as const, label: "Contacts", icon: Users, count: contactsCount },
    { id: "docs" as const, label: "Documents", icon: FileText, count: docsCount },
    { id: "tasks" as const, label: "Tâches", icon: CheckSquare, count: openTasksCount, alert: openTasksCount > 0 },
    { id: "activities" as const, label: "Activités", icon: Activity, count: activities.length },
  ];

  const openTasks = tasks.filter(t => t.status === "open");
  const doneTasks = tasks.filter(t => t.status === "done");
  const cancelledTasks = tasks.filter(t => t.status === "cancelled");

  return (
    <div className="rounded-2xl border border-[#E8E0D0] bg-white shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E8E0D0] bg-[#F5F0E8]/50 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? "border-[#0F1B2D] text-[#0F1B2D] bg-white" : "border-transparent text-slate-500 hover:text-[#0F1B2D]"}`}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tab.alert ? "bg-amber-500 text-white" : activeTab === tab.id ? "bg-[#0F1B2D] text-white" : "bg-slate-200 text-slate-600"}`}>
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
              <p className="text-xs font-semibold tracking-widest text-slate-400">PARTIES PRENANTES</p>
              <a href={`/protected/dossiers/${dealId}/ajouter-contact`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucun contact lié.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3 hover:bg-[#F5F0E8]/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1B2D] text-xs font-bold text-[#C9A84C]">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[#0F1B2D] text-sm">{c.name}</span>
                          {c.status && c.status !== "—" && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${contactStatusColors[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {contactStatusLabels[c.status] ?? c.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{c.title} · {c.role !== "—" ? c.role : c.organisation}</p>
                        <p className="text-xs text-slate-400">Relance : {c.nextFollowUp}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8E0D0] text-slate-400 hover:border-[#0F1B2D] hover:text-[#0F1B2D] transition-colors">
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
              <p className="text-sm text-slate-400 text-center py-8">Aucun document.</p>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E8E0D0] p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0F1B2D] text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.date} · {doc.version}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                          <ExternalLink size={11} /> Ouvrir
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pas de lien</span>
                      )}
                      <a href={`/protected/dossiers/${dealId}/modifier-document/${doc.id}`} className="text-xs text-[#6B8CAE] hover:text-[#0F1B2D]">Modifier</a>
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
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold tracking-widest text-slate-400">TÂCHES & RELANCES</p>
                <span className="text-xs text-slate-400">{openTasks.length} à faire · {doneTasks.length} terminées</span>
              </div>
              <a href={`/protected/agenda/nouvelle-tache`} className="flex items-center gap-1.5 rounded-xl bg-[#0F1B2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B2A4A] transition-colors">
                <Plus size={12} /> Ajouter
              </a>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune tâche.</p>
            ) : (
              <div className="space-y-4">
                {openTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">À faire</p>
                    <div className="space-y-2">
                      {openTasks.map(t => <TaskItem key={t.id} task={t} dealId={dealId} />)}
                    </div>
                  </div>
                )}
                {doneTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Terminées</p>
                    <div className="space-y-2">
                      {doneTasks.map(t => <TaskItem key={t.id} task={t} dealId={dealId} />)}
                    </div>
                  </div>
                )}
                {cancelledTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Annulées</p>
                    <div className="space-y-2">
                      {cancelledTasks.map(t => <TaskItem key={t.id} task={t} dealId={dealId} />)}
                    </div>
                  </div>
                )}
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
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${activityTypeColors[a.typeKey] ?? "bg-slate-100 text-slate-600"}`}>
                      {a.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#0F1B2D] text-sm">{a.title}</span>
                        <span className="shrink-0 text-xs text-slate-400">{a.date}</span>
                      </div>
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
