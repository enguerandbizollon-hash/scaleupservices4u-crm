import { Suspense } from "react";
import {
  getContactsView,
  type ContactView,
} from "@/lib/crm/get-contacts";

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

function ContactCard({ contact }: { contact: ContactView }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
  );
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
  const { allContacts, activeContactsCount, linkedDealsCount } =
    await getContactsView();

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
  <div>
    <p className="text-sm font-medium text-slate-500">Module CRM</p>
    <h1 className="mt-1 text-3xl font-bold tracking-tight">Contacts</h1>
    <p className="mt-2 text-sm text-slate-500">
      Base contacts connectée à Supabase avec gestion multi-dossiers
    </p>
  </div>

  <a
    href="/protected/contacts/nouveau"
    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
  >
    Nouveau contact
  </a>
</div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts total</p>
            <p className="mt-3 text-3xl font-bold">{allContacts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contacts actifs</p>
            <p className="mt-3 text-3xl font-bold">{activeContactsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Liens dossiers</p>
            <p className="mt-3 text-3xl font-bold">{linkedDealsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Source</p>
            <p className="mt-3 text-xl font-bold">lib/crm</p>
          </div>
        </div>

        {allContacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Aucun contact trouvé dans Supabase.
          </div>
        ) : (
          <div className="space-y-6">
            {allContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
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