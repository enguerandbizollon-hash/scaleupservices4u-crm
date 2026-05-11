"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit =
  | { kind: "deal"; id: string; title: string; subtitle: string | null; meta: string | null }
  | { kind: "organization"; id: string; title: string; subtitle: string | null; meta: string | null }
  | { kind: "contact"; id: string; title: string; subtitle: string | null; meta: string | null }
  | { kind: "mandate"; id: string; title: string; subtitle: string | null; meta: string | null }
  | { kind: "action"; id: string; title: string; subtitle: string | null; meta: string | null; deal_id: string | null };

export async function searchGlobal(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const limit = 5;

  const [dealsRes, orgsRes, contactsRes, mandatesRes, actionsRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id,name,deal_type,deal_status,deal_stage,sector")
      .or(`name.ilike.${like},description.ilike.${like}`)
      .eq("user_id", user.id)
      .limit(limit),
    supabase
      .from("organizations")
      .select("id,name,organization_type,sector,location")
      .ilike("name", like)
      .eq("user_id", user.id)
      .limit(limit),
    supabase
      .from("contacts")
      .select("id,first_name,last_name,email,title")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .eq("user_id", user.id)
      .limit(limit),
    supabase
      .from("mandates")
      .select("id,name,type,status")
      .ilike("name", like)
      .eq("user_id", user.id)
      .limit(limit),
    supabase
      .from("actions")
      .select("id,title,type,deal_id,due_date")
      .ilike("title", like)
      .eq("user_id", user.id)
      .limit(limit),
  ]);

  const hits: SearchHit[] = [];

  for (const d of dealsRes.data ?? []) {
    hits.push({
      kind: "deal",
      id: d.id,
      title: d.name,
      subtitle: [d.deal_type, d.deal_stage].filter(Boolean).join(" · "),
      meta: d.sector,
    });
  }
  for (const o of orgsRes.data ?? []) {
    hits.push({
      kind: "organization",
      id: o.id,
      title: o.name,
      subtitle: o.organization_type,
      meta: [o.sector, o.location].filter(Boolean).join(" · ") || null,
    });
  }
  for (const c of contactsRes.data ?? []) {
    hits.push({
      kind: "contact",
      id: c.id,
      title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact",
      subtitle: c.title,
      meta: c.email,
    });
  }
  for (const m of mandatesRes.data ?? []) {
    hits.push({
      kind: "mandate",
      id: m.id,
      title: m.name,
      subtitle: [m.type, m.status].filter(Boolean).join(" · "),
      meta: null,
    });
  }
  for (const a of actionsRes.data ?? []) {
    hits.push({
      kind: "action",
      id: a.id,
      title: a.title,
      subtitle: a.type,
      meta: a.due_date,
      deal_id: a.deal_id,
    });
  }

  return hits;
}
