import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ContactsList } from "./contacts-list";

export const revalidate = 60; // cache 60s

async function Content() {
  const supabase = await createClient();

  // Requête légère : pas de JOIN lourd
  const [{ data: contacts }, { data: orgContacts }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, full_name, email, phone, title, linkedin_url, sector, investment_ticket_label, base_status, notes")
      .order("last_name", { ascending: true }),
    supabase
      .from("organization_contacts")
      .select("contact_id, organizations(id, name)")
  ]);

  // Map org par contact_id côté JS — plus rapide qu'un JOIN Supabase
  const orgMap = new Map<string, string>();
  for (const oc of orgContacts ?? []) {
    if (!orgMap.has(oc.contact_id)) {
      const org = Array.isArray(oc.organizations) ? oc.organizations[0] : oc.organizations as any;
      if (org?.name) orgMap.set(oc.contact_id, org.name);
    }
  }

  const list = (contacts ?? []).map(c => ({
    id: c.id,
    fullName: c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    title: c.title ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    linkedinUrl: c.linkedin_url ?? null,
    sector: c.sector ?? "",
    ticket: c.investment_ticket_label ?? "",
    organisation: orgMap.get(c.id) ?? "",
    status: c.base_status ?? "to_qualify",
    notes: c.notes ?? "",
  }));

  return (
    <ContactsList
      contacts={list}
      stats={{ total: list.length, active: list.filter(c => ["active","priority"].includes(c.status)).length }}
    />
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
        <div style={{ height:40, width:200, borderRadius:10, background:"var(--border)", marginBottom:24, animation:"pulse 1.5s infinite" }}/>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height:60, borderRadius:12, background:"var(--border)", animation:"pulse 1.5s infinite" }}/>)}
        </div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
