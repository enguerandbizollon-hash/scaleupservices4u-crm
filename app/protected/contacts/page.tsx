import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ContactsList } from "./contacts-list";

async function Content() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select(`
      id,
      first_name,
      last_name,
      full_name,
      email,
      phone,
      title,
      linkedin_url,
      sector,
      investment_ticket_label,
      notes,
      base_status,
      organization_contacts (
        organizations ( id, name )
      )
    `)
    .order("last_name", { ascending: true });

  if (error) throw new Error(error.message);

  const contacts = (data ?? []).map(c => {
    const org = c.organization_contacts?.[0]?.organizations as { id: string; name: string } | null;
    return {
      id: c.id,
      fullName: c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      title: c.title ?? "—",
      email: c.email ?? "—",
      phone: c.phone ?? "—",
      linkedinUrl: c.linkedin_url ?? null,
      sector: c.sector ?? "N/A",
      ticket: c.investment_ticket_label ?? "N/A",
      organisation: org?.name ?? "—",
      status: c.base_status ?? "active",
      notes: c.notes ?? "—",
    };
  });

  const active = contacts.filter(c => c.status === "active" || c.status === "priority").length;

  return (
    <ContactsList
      contacts={contacts}
      stats={{ total: contacts.length, active }}
    />
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 mb-8" />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
