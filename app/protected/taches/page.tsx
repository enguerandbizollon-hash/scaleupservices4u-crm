import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TasksList, type TaskRow } from "./tasks-list";

export const revalidate = 60;

async function Content() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("actions")
    .select(
      "id,title,description,priority,status,due_date,due_time,deal_id,organization_id,deals(id,name,deal_type),organizations(id,name)",
    )
    .eq("type", "task")
    .not("status", "in", '("done","cancelled","completed")')
    .order("due_date", { ascending: true, nullsFirst: false });

  const tasks: TaskRow[] = (rows ?? []).map((r) => {
    const deal = Array.isArray(r.deals) ? r.deals[0] : r.deals;
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      priority: r.priority ?? "medium",
      status: r.status ?? "todo",
      due_date: r.due_date ?? null,
      due_time: r.due_time ?? null,
      deal_id: r.deal_id ?? null,
      organization_id: r.organization_id ?? null,
      deal_name: deal?.name ?? null,
      deal_type: deal?.deal_type ?? null,
      organization_name: org?.name ?? null,
    };
  });

  return <TasksList tasks={tasks} />;
}

export default function TachesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 32, background: "var(--bg)", minHeight: "100vh" }}>
          <div className="skeleton" style={{ height: 40, width: 220, marginBottom: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
