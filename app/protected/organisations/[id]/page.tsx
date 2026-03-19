import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgTabs } from "./org-tabs";
import { deleteOrganizationAction } from "@/app/protected/actions";

const typeLabels: Record<string, string> = {
  client: "Client", prospect_client: "Prospect client", investor: "Investisseur",
  buyer: "Repreneur", target: "Cible", law_firm: "Cabinet juridique",
  bank: "Banque", advisor: "Conseil", accounting_firm: "Cabinet comptable",
  family_office: "Family office", corporate: "Corporate",
  consulting_firm: "Cabinet de conseil", other: "Autre",
};

const statusLabels: Record<string, string> = {
  to_qualify: "À qualifier", qualified: "Qualifié", priority: "Prioritaire",
  active: "Actif", dormant: "Dormant", inactive: "Inactif", excluded: "Exclu",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800", priority: "bg-rose-100 text-rose-800",
  qualified: "bg-amber-100 text-amber-800", to_qualify: "bg-slate-100 text-slate-600",
  dormant: "bg-blue-100 text-blue-700", inactive: "bg-slate-200 text-slate-500",
  excluded: "bg-red-100 text-red-700",
};

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, organization_type, base_status, sector, country, website, notes")
    .eq("id", id)
    .maybeSingle();

  if (error || !org) notFound();

  const [{ data: orgContacts }, { data: deals }, { data: activities }, { data: tasks }] = await Promise.all([
    supabase.from("organization_contacts")
      .select("contact_id, role_label, is_primary, contacts(id, first_name, last_name, full_name, title, email, phone, linkedin_url, base_status)")
      .eq("organization_id", id),
    supabase.from("deals")
      .select("id, name, deal_type, deal_status, deal_stage, priority_level, target_date")
      .eq("client_organization_id", id)
      .order("priority_level"),
    supabase.from("activities")
      .select("id, activity_type, title, summary, activity_date, source")
      .eq("organization_id", id)
      .order("activity_date", { ascending: false })
      .limit(20),
    supabase.from("tasks")
      .select("id, title, task_status, priority_level, due_date")
      .eq("organization_id", id)
      .order("due_date"),
  ]);

  function formatDate(v: string | null) {
    if (!v) return "—";
    return new Intl.DateTimeFormat("fr-FR").format(new Date(v));
  }

  const dealTypeLabels: Record<string, string> = {
    fundraising: "Fundraising", ma_sell: "M&A Sell-side", ma_buy: "M&A Buy-side",
    cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
  };

  const contacts = (orgContacts ?? []).map(oc => {
    const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts as any;
    return {
      id: c?.id ?? "",
      name: c?.full_name || `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim(),
      title: c?.title ?? "—",
      email: c?.email ?? null,
      phone: c?.phone ?? null,
      linkedin: c?.linkedin_url ?? null,
      status: c?.base_status ?? "active",
      role: oc.role_label ?? "—",
      isPrimary: oc.is_primary,
    };
  });

  const dealsList = (deals ?? []).map(d => ({
    id: d.id, name: d.name,
    type: dealTypeLabels[d.deal_type] ?? d.deal_type,
    status: d.deal_status, stage: d.deal_stage,
    priority: d.priority_level,
    targetDate: formatDate(d.target_date),
  }));

  const activitiesList = (activities ?? []).map(a => ({
    id: a.id, type: a.activity_type, title: a.title ?? "—",
    summary: a.summary ?? "", date: formatDate(a.activity_date),
  }));

  const tasksList = (tasks ?? []).map(t => ({
    id: t.id, title: t.title, status: t.task_status,
    priority: t.priority_level, dueDate: formatDate(t.due_date),
  }));

  // Emails des contacts pour le mailto groupé
  const contactEmails = contacts.filter(c => c.email).map(c => c.email as string);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/protected/organisations" className="text-xs text-[#6B8CAE] hover:text-[#0F1B2D]">← Organisations</Link>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {typeLabels[org.organization_type] ?? org.organization_type}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[org.base_status] ?? "bg-slate-100 text-slate-600"}`}>
                {statusLabels[org.base_status] ?? org.base_status}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F1B2D]">{org.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#6B8CAE]">
              {org.sector && <span>{org.sector}</span>}
              {org.country && <span>📍 {org.country}</span>}
              {org.website && (
                <a href={org.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#C9A84C] hover:underline">
                  <span>{org.website}</span>
                </a>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {contactEmails.length > 0 && (
              <a
                href={`mailto:${contactEmails.join(",")}`}
                className="flex items-center gap-2 rounded-xl border border-[#E8E0D0] bg-white px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8] transition-colors"
              >
                ✉️ Emailer les contacts
              </a>
            )}
            <Link href={`/protected/organisations/${id}/modifier`} className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors">
              Modifier
            </Link>
            <form action={deleteOrganizationAction}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                Supprimer
              </button>
            </form>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4 text-center">
            <p className="text-2xl font-bold text-[#0F1B2D]">{contacts.length}</p>
            <p className="text-xs text-slate-400 mt-1">Contacts</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4 text-center">
            <p className="text-2xl font-bold text-[#0F1B2D]">{dealsList.length}</p>
            <p className="text-xs text-slate-400 mt-1">Dossiers</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4 text-center">
            <p className="text-2xl font-bold text-[#0F1B2D]">{activitiesList.length}</p>
            <p className="text-xs text-slate-400 mt-1">Activités</p>
          </div>
          <div className="rounded-xl border border-[#E8E0D0] bg-white p-4 text-center">
            <p className="text-2xl font-bold text-[#0F1B2D]">{tasksList.filter(t => t.status === "open").length}</p>
            <p className="text-xs text-slate-400 mt-1">Tâches ouvertes</p>
          </div>
        </div>

        {org.notes && (
          <div className="mt-4 rounded-xl border border-[#E8E0D0] bg-white p-4">
            <p className="text-xs font-semibold tracking-widest text-slate-400 mb-2">NOTES</p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{org.notes}</p>
          </div>
        )}
      </div>

      {/* Onglets */}
      <OrgTabs
        orgId={id}
        contacts={contacts}
        deals={dealsList}
        activities={activitiesList}
        tasks={tasksList}
      />
    </div>
  );
}

export default function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
