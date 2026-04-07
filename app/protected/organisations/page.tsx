import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrganisationsList } from "./organisations-list";

export const revalidate = 60;

const TYPE_LABELS: Record<string,string> = {
  client:"Client", prospect_client:"Prospect client", investor:"Investisseur",
  business_angel:"Business Angel", buyer:"Repreneur", target:"Cible",
  law_firm:"Cabinet juridique", bank:"Banque", advisor:"Conseil",
  accounting_firm:"Cabinet comptable", family_office:"Family office",
  corporate:"Corporate", consulting_firm:"Cabinet de conseil", other:"Autre"
};

async function Content() {
  const supabase = await createClient();

  const [orgsRes, contactLinksRes, openTasksRes, recentActsRes] = await Promise.all([
    supabase.from("organizations")
      .select("id,name,organization_type,base_status,sector,location,country,website,notes,investment_ticket,investment_stage,description")
      .order("name", { ascending: true }),
    supabase.from("organization_contacts")
      .select("organization_id,contact_id,role_label,is_primary,contacts(id,first_name,last_name,title,email,base_status,last_contact_date)"),
    supabase.from("actions")
      .select("id,organization_id,status")
      .eq("type", "task")
      .not("status", "in", '("done","cancelled","completed")')
      .not("organization_id", "is", null),
    supabase.from("actions")
      .select("id,organization_id,start_datetime,due_date,created_at")
      .neq("type", "task")
      .not("organization_id", "is", null)
      .order("start_datetime", { ascending: false, nullsFirst: false }),
  ]);

  const orgs = orgsRes.data ?? [];

  // Indexer contacts par org
  const contactsByOrg: Record<string, any[]> = {};
  for (const link of contactLinksRes.data ?? []) {
    if (!contactsByOrg[link.organization_id]) contactsByOrg[link.organization_id] = [];
    const c = Array.isArray(link.contacts) ? link.contacts[0] : link.contacts as any;
    if (c) contactsByOrg[link.organization_id].push({ ...c, role_label: link.role_label, is_primary: link.is_primary });
  }

  // Tâches ouvertes par org
  const tasksByOrg: Record<string, number> = {};
  for (const t of openTasksRes.data ?? []) {
    if (t.organization_id) tasksByOrg[t.organization_id] = (tasksByOrg[t.organization_id] ?? 0) + 1;
  }

  // Dernière activité par org (première trouvée = la plus récente grâce au ORDER BY)
  const lastActivityByOrg: Record<string, string> = {};
  for (const a of recentActsRes.data ?? []) {
    if (a.organization_id && !lastActivityByOrg[a.organization_id]) {
      lastActivityByOrg[a.organization_id] = a.start_datetime ?? a.due_date ?? a.created_at;
    }
  }

  const enriched = orgs.map(o => ({
    id:              o.id,
    name:            o.name,
    typeKey:         o.organization_type,
    typeLabel:       TYPE_LABELS[o.organization_type] ?? o.organization_type,
    status:          o.base_status ?? "to_qualify",
    sector:          o.sector ?? "",
    location:        (o as any).location || o.country || "",
    website:         o.website ?? null,
    notes:           o.notes ?? "",
    investmentTicket: (o as any).investment_ticket ?? "",
    investmentStage:  (o as any).investment_stage ?? "",
    description:     (o as any).description ?? "",
    contacts:        contactsByOrg[o.id] ?? [],
    openTasks:       tasksByOrg[o.id] ?? 0,
    lastActivity:    lastActivityByOrg[o.id] ?? null,
  }));

  return <OrganisationsList orgs={enriched} stats={{ total: orgs.length }}/>;
}

function Skeleton() {
  return (
    <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
      <div className="skeleton" style={{ height:36, width:180, marginBottom:24 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12 }}>
        {[...Array(9)].map((_,i) => <div key={i} className="skeleton" style={{ height:220, borderRadius:14 }}/>)}
      </div>
    </div>
  );
}

export default function OrganisationsPage() {
  return <Suspense fallback={<Skeleton/>}><Content/></Suspense>;
}
