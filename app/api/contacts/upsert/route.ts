import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { first_name, last_name, email } = await req.json();
  if (!first_name || !last_name) return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });

  // Chercher si existe déjà
  if (email) {
    const { data: existing } = await supabase.from("contacts").select("*").eq("email", email.toLowerCase()).maybeSingle();
    if (existing) return NextResponse.json(existing);
  }
  // Créer
  const { data, error } = await supabase.from("contacts").insert({
    first_name, last_name, email: email?.toLowerCase() || null,
    base_status: "to_qualify", user_id: user.id,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
