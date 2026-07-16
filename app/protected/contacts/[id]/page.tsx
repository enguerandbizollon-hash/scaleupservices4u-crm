import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactDetail } from "./contact-detail";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id,first_name,last_name,email,phone,title,sector,country,linkedin_url,base_status,last_contact_date,notes,primary_organization_id")
    .eq("id", id).maybeSingle();

  if (!contact) notFound();

  // Les actions du contact sont chargées côté client par
  // <ActionTimeline filters={{ contact_id: id }} /> dans ContactDetail.
  const { data: orgContacts } = await supabase.from("organization_contacts")
    .select("role_label,is_primary,organizations(id,name,organization_type,base_status,location,website,investment_ticket)")
    .eq("contact_id", id);

  const orgs = (orgContacts ?? []).map(oc => {
    const o = Array.isArray(oc.organizations) ? oc.organizations[0] : oc.organizations as any;
    return { ...o, role_label: oc.role_label, is_primary: oc.is_primary };
  }).filter(Boolean);

  // Stat email : nombre d'emails échangés + date du dernier. On passe via la
  // table de liaison action_contacts en filtrant type=email côté actions.
  const { data: emailLinks } = await supabase
    .from("action_contacts")
    .select("actions!inner(id, due_date, email_direction)")
    .eq("contact_id", id)
    .eq("actions.type", "email");

  type EmailRel = { id: string; due_date: string | null; email_direction: string | null };
  const emailActions: EmailRel[] = (emailLinks ?? []).flatMap((row) => {
    const acts = (row as { actions: EmailRel | EmailRel[] | null }).actions;
    if (!acts) return [] as EmailRel[];
    return Array.isArray(acts) ? acts : [acts];
  });
  const emailStats = {
    total: emailActions.length,
    inbound: emailActions.filter((a) => a.email_direction !== "outbound").length,
    outbound: emailActions.filter((a) => a.email_direction === "outbound").length,
    lastDate: emailActions
      .map((a) => a.due_date)
      .filter((d): d is string => !!d)
      .sort()
      .reverse()[0] ?? null,
  };

  return <ContactDetail contact={contact} orgs={orgs} emailStats={emailStats} />;
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding:40 }}><div style={{ height:300, borderRadius:16, background:"var(--surface-2)" }}/></div>}>
      <Content params={params} />
    </Suspense>
  );
}
