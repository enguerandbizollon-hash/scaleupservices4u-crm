import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealTypeLabels, dealStageLabels, dealStatusLabels, priorityLabels, activityTypeLabels } from "@/lib/crm/labels";
import { deleteDealAction } from "@/app/protected/actions";
import { DealTabs } from "./deal-tabs";

const typeColors: Record<string, string> = {
  fundraising: "bg-emerald-100 text-emerald-800",
  ma_sell: "bg-amber-100 text-amber-800",
  ma_buy: "bg-sky-100 text-sky-800",
  cfo_advisor: "bg-violet-100 text-violet-800",
  recruitment: "bg-rose-100 text-rose-800",
};

const priorityBorder: Record<string, string> = {
  high: "border-l-rose-500",
  medium: "border-l-amber-400",
  low: "border-l-slate-300",
};

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id, sector, location, valuation_amount, fundraising_amount, description, start_date, target_date")
    .eq("id", id)
    .maybeSingle();

  if (error || !deal) notFound();

  const [
    { data: dealContacts },
    { data: dealDocs },
    { data: tasks },
    { data: activities },
  ] = await Promise.all([
    supabase.from("deal_contacts").select(`
      id, role_in_deal, status_in_deal, contacted, last_contact_at, next_follow_up_at, notes,
      contact:contacts(id, first_name, last_name, full_name, title, email, phone,
        organization_contacts(organizations(name)))
    `).eq("deal_id", id),
    supabase.from("deal_documents").select("id, name, document_type, document_status, document_url, version_label, added_at, note").eq("deal_id", id).order("added_at", { ascending: false }),
    supabase.from("tasks").select("id, title, task_status, priority_level, due_date, description").eq("deal_id", id).order("due_date", { ascending: true }),
    supabase.from("activities").select("id, activity_type, title, summary, activity_date, source").eq("deal_id", id).order("activity_date", { ascending: false }).limit(20),
  ]);

  function formatDate(v: string | null) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("fr-FR").format(new Date(v));
  }

  function formatAmount(v: number | null) {
    if (!v) return null;
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  }

  const stageSteps = ["kickoff", "preparation", "outreach", "management_meetings", "dd", "negotiation", "closing"];
  const currentStepIdx = stageSteps.indexOf(deal.deal_stage);

  const contacts = (dealContacts ?? []).map(dc => {
    const c = Array.isArray(dc.contact) ? dc.contact[0] : dc.contact as any;
    const orgContacts = c?.organization_contacts;
    const orgName = Array.isArray(orgContacts) && orgContacts[0]?.organizations?.name ? orgContacts[0].organizations.name : null;
    return {
      id: dc.id,
      contactId: c?.id ?? "",
      name: c?.full_name || `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim(),
      title: c?.title ?? "—",
      email: c?.email ?? null,
      organisation: orgName ?? — ?? "—",
      role: dc.role_in_deal ?? "—",
      status: dc.status_in_deal ?? "—",
      lastContact: formatDate(dc.last_contact_at),
      nextFollowUp: formatDate(dc.next_follow_up_at),
      notes: dc.notes ?? "",
    };
  });

  const primaryContacts = contacts.filter(c => c.role !== "—").slice(0, 2);

  const docs = (dealDocs ?? []).map(d => ({
    id: d.id, name: d.name, type: d.document_type ?? "other",
    status: d.document_status, url: d.document_url ?? null,
    version: d.version_label ?? "—", date: formatDate(d.added_at), note: d.note ?? "",
  }));

  const tasksList = (tasks ?? []).map(t => ({
    id: t.id, title: t.title, status: t.task_status,
    priority: t.priority_level, dueDate: formatDate(t.due_date),
    dueDateRaw: t.due_date, description: t.description ?? "",
  }));

  const activitiesList = (activities ?? []).map(a => ({
    id: a.id, type: activityTypeLabels[a.activity_type] ?? a.activity_type,
    typeKey: a.activity_type, title: a.title ?? "—",
    summary: a.summary ?? "", date: formatDate(a.activity_date), source: a.source,
  }));

  const isFundraising = deal.deal_type === "fundraising";
  const openTasks = tasksList.filter(t => t.status === "open");

  return (
    <div className="p-8">
      {/* Header */}
      <div className={`mb-6 rounded-2xl border-l-4 ${priorityBorder[deal.priority_level] ?? "border-l-slate-300"} border border-[#E8E0D0] bg-white p-6 shadow-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Link href="/protected/dossiers" className="text-xs text-[#6B8CAE] hover:text-[#0F1B2D]">← Dossiers</Link>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeColors[deal.deal_type] ?? "bg-slate-100"}`}>
                {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${deal.deal_status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {dealStatusLabels[deal.deal_status] ?? deal.deal_status}
              </span>
              <span className="rounded-full bg-[#F5F0E8] px-3 py-1 text-xs font-medium text-[#6B8CAE]">
                Priorité {priorityLabels[deal.priority_level] ?? deal.priority_level}
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#0F1B2D]">{deal.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#6B8CAE]">
                              </a>
              )}
              {deal.sector && <span>· {deal.sector}</span>}
              {org?.country && <span>📍 {org.country}</span>}
            </div>

            {/* Contacts principaux inline */}
            {primaryContacts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {primaryContacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl bg-[#F5F0E8] px-3 py-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0F1B2D] text-xs font-bold text-[#C9A84C]">
                      {c.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-[#0F1B2D]">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.title}</span>
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-xs text-[#C9A84C] hover:underline">✉</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 items-end">
            <div className="flex gap-2">
              <Link href={`/protected/dossiers/${id}/modifier`} className="rounded-xl border border-[#E8E0D0] bg-white px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8] transition-colors">
                Modifier
              </Link>
              <form action={deleteDealAction}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                  Supprimer
                </button>
              </form>
            </div>
            {openTasks.length > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {openTasks.length} tâche{openTasks.length > 1 ? "s" : ""} en cours
              </span>
            )}
          </div>
        </div>

        {/* KPIs contextuels */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isFundraising && deal.fundraising_amount && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">Levée cible</p>
              <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{formatAmount(deal.fundraising_amount)}</p>
            </div>
          )}
          {isFundraising && deal.valuation_amount && (
            <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Valorisation</p>
              <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{formatAmount(deal.valuation_amount)}</p>
            </div>
          )}
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Contacts</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{contacts.length}</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Documents</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{docs.length}</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Activités</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{activitiesList.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${openTasks.length > 0 ? "border-amber-200 bg-amber-50" : "border-[#E8E0D0] bg-white"}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Tâches ouvertes</p>
            <p className={`mt-1 text-xl font-bold ${openTasks.length > 0 ? "text-amber-700" : "text-[#0F1B2D]"}`}>{openTasks.length}</p>
          </div>
        </div>

        {/* Description / Notes */}
        {deal.description && (
          <div className="mt-4 rounded-xl border border-[#E8E0D0] bg-[#F5F0E8]/50 p-4">
            <p className="text-xs font-semibold tracking-widest text-slate-400 mb-2">CONTEXTE DE L'OPÉRATION</p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{deal.description}</p>
          </div>
        )}

        {/* Timeline cliquable */}
        <div className="mt-4 rounded-xl border border-[#E8E0D0] bg-white p-4">
          <p className="mb-3 text-xs font-semibold tracking-widest text-slate-400">PROGRESSION — cliquer pour changer l'étape</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stageSteps.map((step, i) => {
              const isActive = step === deal.deal_stage;
              const isPast = i < currentStepIdx;
              return (
                <div key={step} className="flex items-center gap-1">
                  <form action={async (fd: FormData) => {
                    "use server";
                    const { createClient: cc } = await import("@/lib/supabase/server");
                    const { revalidatePath: rp } = await import("next/cache");
                    const s = await cc();
                    await s.from("deals").update({ deal_stage: step }).eq("id", id);
                    rp(`/protected/dossiers/${id}`);
                  }}>
                    <button
                      type="submit"
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all hover:scale-105 ${
                        isActive
                          ? "bg-[#0F1B2D] text-white shadow-md"
                          : isPast
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {isPast ? "✓ " : ""}{dealStageLabels[step] ?? step}
                    </button>
                  </form>
                  {i < stageSteps.length - 1 && (
                    <div className={`h-px w-3 shrink-0 ${isPast ? "bg-emerald-300" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <DealTabs
        dealId={id}
        contacts={contacts}
        docs={docs}
        tasks={tasksList}
        activities={activitiesList}
        description={deal.description ?? ""}
        openTasksCount={openTasks.length}
        contactsCount={contacts.length}
        docsCount={docs.length}
      />
    </div>
  );
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
