import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = ["todo","email_sent","email_received","call","meeting","follow_up","intro","note","deck_sent","nda","document_sent","other"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const { data: task, error } = await supabase.from("tasks").insert({
    deal_id:        id,
    user_id:        user.id,
    title:          body.title,
    task_type:      VALID_TYPES.includes(body.task_type) ? body.task_type : "todo",
    task_status:    "open",
    priority_level: body.priority_level || "medium",
    due_date:       body.due_date || null,
    due_time:       body.due_time || null,
    summary:        body.summary || null,
    description:    body.summary || null, // compat
    contact_id:     body.contact_ids?.[0] || null,
    organization_id: body.organization_id || null,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lier les contacts via task_contacts
  const contactIds: string[] = body.contact_ids ?? [];
  if (contactIds.length > 0 && task) {
    await supabase.from("task_contacts").insert(
      contactIds.map(cid => ({ task_id: task.id, contact_id: cid, user_id: user.id }))
    );
  }

  return NextResponse.json({ ...task, contact_ids: contactIds });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { task_id, contact_ids, ...updates } = await req.json();
  if (!task_id) return NextResponse.json({ error: "task_id requis" }, { status: 400 });
  if (updates.task_type && !VALID_TYPES.includes(updates.task_type)) updates.task_type = "todo";
  if (updates.summary) updates.description = updates.summary;
  if (updates.task_status === "done") updates.completed_at = new Date().toISOString();

  const { data: task, error } = await supabase.from("tasks")
    .update(updates).eq("id", task_id).eq("deal_id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (contact_ids !== undefined) {
    await supabase.from("task_contacts").delete().eq("task_id", task_id);
    if (contact_ids.length > 0) {
      await supabase.from("task_contacts").insert(
        contact_ids.map((cid: string) => ({ task_id, contact_id: cid, user_id: user.id }))
      );
    }
  }

  const { data: tc } = await supabase.from("task_contacts")
    .select("contacts(id,first_name,last_name)").eq("task_id", task_id);
  const resolved_ids = (tc??[]).map((r:any) => { const c=Array.isArray(r.contacts)?r.contacts[0]:r.contacts; return c?.id; }).filter(Boolean);

  return NextResponse.json({ ...task, contact_ids: resolved_ids });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { task_id } = await req.json();
  const { error } = await supabase.from("tasks").delete().eq("id", task_id).eq("deal_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
