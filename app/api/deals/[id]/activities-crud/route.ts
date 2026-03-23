import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Types valides dans la base
const VALID_TYPES = [
  "email_sent","email_received","call","meeting","follow_up",
  "intro","note","document_sent","document_received","nda",
  "deck_sent","bp_sent","im_sent","dataroom_opened","other"
];

function safeType(t: string): string {
  return VALID_TYPES.includes(t) ? t : "other";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const { data: activity, error } = await supabase.from("activities").insert({
    deal_id:       id,
    user_id:       user.id,
    title:         body.title,
    activity_type: safeType(body.activity_type),
    activity_date: body.activity_date || new Date().toISOString().split("T")[0],
    summary:       body.summary || null,
    organization_id: null, // plus de lien org direct
    contact_id:    body.contact_ids?.[0] || null, // premier contact pour compat
  }).select("id,title,activity_type,activity_date,summary").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lier tous les contacts via activity_contacts
  const contactIds: string[] = body.contact_ids ?? [];
  if (contactIds.length > 0 && activity) {
    await supabase.from("activity_contacts").insert(
      contactIds.map(cid => ({ activity_id: activity.id, contact_id: cid, user_id: user.id }))
    );
  }

  // Récupérer les noms des contacts liés
  const { data: linkedContacts } = await supabase
    .from("activity_contacts")
    .select("contacts(id,first_name,last_name)")
    .eq("activity_id", activity!.id);

  const contactNames = (linkedContacts ?? []).map((r: any) => {
    const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return c ? `${c.first_name} ${c.last_name}` : null;
  }).filter(Boolean);

  return NextResponse.json({ ...activity, contact_names: contactNames, contact_ids: contactIds });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { activity_id, contact_ids, ...updates } = await req.json();
  if (updates.activity_type) updates.activity_type = safeType(updates.activity_type);

  const { data: activity, error } = await supabase.from("activities")
    .update(updates).eq("id", activity_id).eq("deal_id", id)
    .select("id,title,activity_type,activity_date,summary").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mettre à jour les contacts liés
  if (contact_ids !== undefined && activity) {
    await supabase.from("activity_contacts").delete().eq("activity_id", activity_id);
    if (contact_ids.length > 0) {
      await supabase.from("activity_contacts").insert(
        contact_ids.map((cid: string) => ({ activity_id, contact_id: cid, user_id: user.id }))
      );
    }
  }

  const { data: linkedContacts } = await supabase
    .from("activity_contacts")
    .select("contacts(id,first_name,last_name)")
    .eq("activity_id", activity!.id);

  const contactNames = (linkedContacts ?? []).map((r: any) => {
    const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return c ? `${c.first_name} ${c.last_name}` : null;
  }).filter(Boolean);

  return NextResponse.json({ ...activity, contact_names: contactNames });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { activity_id } = await req.json();
  const { error } = await supabase.from("activities").delete().eq("id", activity_id).eq("deal_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
