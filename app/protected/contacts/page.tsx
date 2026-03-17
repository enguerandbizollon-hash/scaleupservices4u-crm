import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  sector: string | null;
  investment_ticket_label: string | null;
  country: string | null;
  notes: string | null;
  base_status: string;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
};

type OrganizationContactRow = {
  contact_id: string;
  organization_id: string;
  role_label: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type DealContactRow = {
  contact_id: string;
  deal_id: string;
  organization_id: string | null;
  role_in_deal: string | null;
  status_in_deal: string | null;
  contacted: boolean;
  contacted_at: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
};

type DealRow = {
  id: string;
  name: string;
};

type ContactView = {
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
  linkedDeals: Array<{
    dealName: string;
    roleInDeal: string;
    contacted: boolean;
    contactedAt: string;
    lastContactAt: string;
    nextFollowUpAt: string;
    statusInDeal: string;
    notes: string;
  }>;
};

const baseStatusLabels: Record<string, string> = {
  to_qualify: "À qualifier",
  qualified: "Qualifié",
  priority: "Prioritaire",
  active: "Actif",
  dormant: "Dormant",
  inactive: "Inactif",
  excluded: "Exclu",
};

const pipelineStatusLabels: Record<string, string> = {
  to_contact: "À contacter",
  contacted: "Contacté",
  to_follow_up: "À relancer",
  in_discussion: "En discussion",
  meeting_done: "Meeting tenu",
  strong_interest: "Intérêt marqué",
  waiting: "En attente",
  no_go: "No go",
  partner_active: "Suivi en cours",
  document_requested: "Document demandé",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function statusBadgeClass(status: string) {
  if (status === "Actif") return "bg-emerald-100 text-emerald-800";
  if (status === "Qualifié") return "bg-amber-100 text-amber-800";
  if (status === "Prioritaire") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function dealStatusBadgeClass(status: string) {
  if (status === "En discussion") return "bg-blue-100 text-blue-800";
  if (status === "À relancer") return "bg-rose-100 text-rose-800";
  if (status === "À contacter") return "bg-amber-100 text-amber-800";
  if (status === "Suivi en cours") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function ContactsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="mt-2 text-sm text-slate-500">Chargement depuis Supabase…</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

async function ContactsContent() {
  const supabase = await createClient();

  const { data: contactsData, error: contactsError } = await supabase
    .from("contacts")
    .select(
      "id,first_name,last_name,full_name,email,phone,title,linkedin_url,sector,investment_ticket_label,country,notes,base_status,first_contact_at,last_contact_at,next_follow_up_at"
    )
    .order("last_name", { ascending: true });

  if (contactsError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Erreur Supabase</h1>
          <p className="mt-3 text-sm text-slate-600">
            Impossible de charger les contacts depuis la base.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-sm text-white">
            {contactsError.message}
          </pre>
        </div>
      </div>
    );
  }

  const contacts = (contactsData ?? []) as ContactRow[];
  const contactIds = contacts.map((contact) => contact.id);

  const { data: organizationContactsData } = await supabase
    .from("organization_contacts")
    .select("contact_id,organization_id,role_label")
    .in("contact_id", contactIds);

  const organizationContacts = (organizationContactsData ?? []) as OrganizationContactRow[];

  const { data: dealContactsData } = await supabase
    .from("deal_contacts")
    .select(
      "contact_id,deal_id,organization_id,role_in_deal,status_in_deal,contacted,contacted_at,first_contact_at,last_contact_at,next_follow_up_at,notes"
    )
    .in("contact_id", contactIds);

  const dealContacts = (dealContactsData ?? []) as DealContactRow[];

  const organizationIds = [
    ...new Set([
      ...organizationContacts.map((row) => row.organization_id),
      ...dealContacts.map((row) => row.organization_id).filter(Boolean),
    ]),
  ] as string[];

  const dealIds = [...new Set(dealContacts.map((row) => row.deal_id))];

  let organizationsMap: Record<string, string> = {};
  let dealsMap: Record<string, string> = {};

  if (organizationIds.length > 0) {
    const { data: organizationsData } = await supabase
      .from("organizations")
      .select("id,name")
      .in("id", organizationIds);

    const organizations = (organizationsData ?? []) as OrganizationRow[];
    organizationsMap = Object.fromEntries(organizations.map((org) => [org.id, org.name]));
  }

  if (dealIds.length > 0) {
    const { data: dealsData } = await supabase
      .from("deals")
      .select("id,name")
      .in("id", dealIds);

    const deals = (dealsData ?? []) as DealRow[];
    dealsMap = Object.fromEntries(deals.map((deal) => [deal.id, deal.name]));
  }

  const contactView: ContactView[] = contacts.map((contact) => {
    const contactOrganizations = organizationContacts.filter(
      (row) => row.contact_id === contact.id
    );

    const mainOrganisation =
      contactOrganizations.length > 0
        ? organizationsMap[contactOrganizations[0].organization_id] ?? "Organisation inconnue"
        : "Organisation inconnue";

    const linkedDeals = dealContacts
      .filter((row) => row.contact_id === contact.id)
      .map((row) => ({
        dealName: dealsMap[row.deal_id] ?? "Dossier inconnu",
        roleInDeal: row.role_in_deal ?? "—",
        contacted: row.contacted,
        contactedAt: formatDate(row.contacted_at),
        lastContactAt: formatDate(row.last_contact_at),
        nextFollowUpAt: formatDate(row.next_follow_up_at),
        statusInDeal: pipelineStatusLabels[row.status_in_deal ?? ""] ?? (row.status_in_deal ?? "—"),
        notes: row.notes ?? "—",
      }));

    return {
      id: contact.id,
      fullName: contact.full_name || `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      title: contact.title ?? "—",
      email: contact.email ?? "—",
      phone: contact.phone ?? "—",
      linkedinUrl: contact.linkedin_url,
      sector: contact.sector ?? "N/A",
      ticket: contact.investment_ticket_label ?? "N/A",
      organisation: mainOrganisation,
      status: baseStatusLabels[contact.base_status] ?? contact.base_status,
      notes: contact.notes ?? "—",
      linkedDeals,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="mt-2 text-sm text-slate-500">
            Base contacts connectée à Supabase avec gestion multi-dossiers
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts total</p>
            <p className="mt-3 text-3xl font-bold">{contactView.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts actifs</p>
            <p className="mt-3 text-3xl font-bold">
              {contactView.filter((c) => c.status === "Actif").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Liens dossiers</p>
            <p className="mt-3 text-3xl font-bold">
              {contactView.reduce((acc, c) => acc + c.linkedDeals.length, 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">Supabase</p>
          </div>
        </div>

        {contactView.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Aucun contact trouvé dans Supabase.
          </div>
        ) : (
          <div className="space-y-6">
            {contactView.map((contact) => (
              <div
                key={contact.id}
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
                    {contact.email !== "—" ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Contacter
                      </a>
                    ) : null}

                    {contact.linkedinUrl ? (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                    <p className="mt-1 break-all text-sm font-medium">{contact.email}</p>
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
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Dossiers concernés
                    </p>
                    <p className="mt-1 text-sm font-medium">{contact.linkedDeals.length}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Notes contact</p>
                  <p className="mt-1 text-sm text-slate-700">{contact.notes}</p>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Dossiers concernés
                  </h3>

                  <div className="mt-3 space-y-3">
                    {contact.linkedDeals.length > 0 ? (
                      contact.linkedDeals.map((deal) => (
                        <div
                          key={`${contact.id}-${deal.dealName}`}
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
                              <p className="mt-1 text-sm font-medium">{deal.contactedAt}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Dernier échange
                              </p>
                              <p className="mt-1 text-sm font-medium">{deal.lastContactAt}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Prochaine relance
                              </p>
                              <p className="mt-1 text-sm font-medium">{deal.nextFollowUpAt}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Statut
                              </p>
                              <p className="mt-1 text-sm font-medium">{deal.statusInDeal}</p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
                            <p className="mt-1 text-sm text-slate-700">{deal.notes}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                        Aucun dossier lié pour ce contact.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<ContactsLoading />}>
      <ContactsContent />
    </Suspense>
  );
}