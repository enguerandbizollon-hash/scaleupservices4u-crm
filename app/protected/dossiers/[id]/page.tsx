import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealTypeLabels, dealStageLabels, dealStatusLabels, priorityLabels, activityTypeLabels } from "@/lib/crm/labels";
import { deleteDealAction } from "@/app/protected/actions";
import { DealTabs } from "./deal-tabs";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Deal + org
  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id, sector, valuation_amount, fundraising_amount, description, start_date, target_date")
    .eq("id", id)
    .maybeSingle();

  if (error || !deal) notFound();

  const [
    { data: org },
    { data: dealContacts },
    { data: dealDocs },
    { data: tasks },
    { data: activities },
  ] = await Promise.all([
    deal.client_organization_id
      ? supabase.from("organizations").select("id, name, organization_type, country, website").eq("id", deal.client_organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
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
    if (!v) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  }

  const typeColors: Record<string, string> = {
    fundraising: "bg-emerald-100 text-emerald-800",
    ma_sell: "bg-amber-100 text-amber-800",
    ma_buy: "bg-sky-100 text-sky-800",
    cfo_advisor: "bg-violet-100 text-violet-800",
    recruitment: "bg-rose-100 text-rose-800",
  };

  const stageSteps = ["kickoff", "preparation", "outreach", "management_meetings", "dd", "negotiation", "closing"];
  const currentStepIdx = stageSteps.indexOf(deal.deal_stage);

  const contacts = (dealContacts ?? []).map(dc => {
    const c = Array.isArray(dc.contact) ? dc.contact[0] : dc.contact;
    const orgContacts = (c as any)?.organization_contacts;
    const orgName = Array.isArray(orgContacts) && orgContacts[0]?.organizations?.name ? orgContacts[0].organizations.name : null;
    return {
      id: dc.id,
      contactId: c?.id ?? "",
      name: (c as any)?.full_name || `${(c as any)?.first_name ?? ""} ${(c as any)?.last_name ?? ""}`.trim(),
      title: (c as any)?.title ?? "—",
      email: (c as any)?.email ?? null,
      organisation: orgName ?? org?.name ?? "—",
      role: dc.role_in_deal ?? "—",
      status: dc.status_in_deal ?? "—",
      lastContact: formatDate(dc.last_contact_at),
      nextFollowUp: formatDate(dc.next_follow_up_at),
      notes: dc.notes ?? "",
    };
  });

  const docs = (dealDocs ?? []).map(d => ({
    id: d.id,
    name: d.name,
    type: d.document_type ?? "other",
    status: d.document_status,
    url: d.document_url ?? null,
    version: d.version_label ?? "—",
    date: formatDate(d.added_at),
    note: d.note ?? "",
  }));

  const tasksList = (tasks ?? []).map(t => ({
    id: t.id,
    title: t.title,
    status: t.task_status,
    priority: t.priority_level,
    dueDate: formatDate(t.due_date),
    description: t.description ?? "",
  }));

  const activitiesList = (activities ?? []).map(a => ({
    id: a.id,
    type: activityTypeLabels[a.activity_type] ?? a.activity_type,
    title: a.title ?? "—",
    summary: a.summary ?? "",
    date: formatDate(a.activity_date),
    source: a.source,
  }));

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/protected/dossiers" className="text-xs text-[#6B8CAE] hover:text-[#0F1B2D]">← Dossiers</Link>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeColors[deal.deal_type] ?? "bg-slate-100"}`}>
                {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${deal.deal_status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {dealStatusLabels[deal.deal_status] ?? deal.deal_status}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F1B2D]">{deal.name}</h1>
            <p className="mt-1 text-sm text-[#6B8CAE]">{org?.name ?? "—"} {deal.sector ? `· ${deal.sector}` : ""}</p>
          </div>
          <div className="flex shrink-0 gap-2">
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
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Valorisation</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{formatAmount(deal.valuation_amount)}</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Fundraising</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{formatAmount(deal.fundraising_amount)}</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Date cible</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{formatDate(deal.target_date)}</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Priorité</p>
            <p className="mt-1 text-xl font-bold text-[#0F1B2D]">{priorityLabels[deal.priority_level] ?? deal.priority_level}</p>
          </div>
        </div>

        {/* Timeline étapes */}
        <div className="mt-4 rounded-xl border border-[#E8E0D0] bg-white p-4">
          <p className="mb-3 text-xs font-semibold tracking-widest text-slate-400">PROGRESSION</p>
          <div className="flex items-center gap-1 overflow-x-auto">
            {stageSteps.map((step, i) => {
              const isActive = step === deal.deal_stage;
              const isPast = i < currentStepIdx;
              return (
                <div key={step} className="flex items-center gap-1">
                  <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${isActive ? "bg-[#0F1B2D] text-white" : isPast ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {dealStageLabels[step] ?? step}
                  </div>
                  {i < stageSteps.length - 1 && (
                    <div className={`h-px w-4 shrink-0 ${isPast ? "bg-emerald-300" : "bg-slate-200"}`} />
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
        openTasksCount={tasksList.filter(t => t.status === "open").length}
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
