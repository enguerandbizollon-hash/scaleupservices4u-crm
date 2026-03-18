import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id,first_name,last_name,email,phone,title,linkedin_url,sector,investment_ticket_label,country,notes,base_status,first_contact_at,last_contact_at,next_follow_up_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Erreur chargement contact: ${error.message}`);
  if (!contact) notFound();

  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

  function formatDate(value: string | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Fiche contact</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{fullName}</h1>
            {contact.title && (
              <p className="mt-1 text-sm text-slate-500">{contact.title}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/protected/contacts"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retour
            </Link>
            <Link
              href={`/protected/contacts/${id}/modifier`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Modifier
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Informations</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 text-sm font-medium">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                      {contact.email}
                    </a>
                  ) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Téléphone</p>
                <p className="mt-1 text-sm font-medium">{contact.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">LinkedIn</p>
                <p className="mt-1 text-sm font-medium">
                  {contact.linkedin_url ? (
                    <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Voir le profil
                    </a>
                  ) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
                <p className="mt-1 text-sm font-medium">{contact.base_status ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Secteur</p>
                <p className="mt-1 text-sm font-medium">{contact.sector ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Pays</p>
                <p className="mt-1 text-sm font-medium">{contact.country ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Ticket investissement</p>
                <p className="mt-1 text-sm font-medium">{contact.investment_ticket_label ?? "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Suivi</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Premier contact</p>
                <p className="mt-1 text-sm font-medium">{formatDate(contact.first_contact_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Dernier échange</p>
                <p className="mt-1 text-sm font-medium">{formatDate(contact.last_contact_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Prochaine relance</p>
                <p className="mt-1 text-sm font-medium">{formatDate(contact.next_follow_up_at)}</p>
              </div>
            </div>
          </div>

          {contact.notes && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Notes</h2>
              <p className="text-sm text-slate-700 whitespace-pre-line">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Content params={params} />
    </Suspense>
  );
}
