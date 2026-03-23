import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const fd = await req.formData();
  const ns = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v || null; };

  const name = ns("name");
  if (!name) return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });

  // Vérif doublon
  const { data: existing } = await supabase.from("organizations")
    .select("id").ilike("name", name).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ error: `Une organisation "${name}" existe déjà.` }, { status: 409 });

  const { data, error } = await supabase.from("organizations").insert({
    name,
    organization_type: ns("organization_type") ?? "other",
    base_status:       ns("base_status") ?? "to_qualify",
    sector:            ns("sector"),
    location:          ns("location"),
    website:           ns("website"),
    linkedin_url:      ns("linkedin_url"),
    description:       ns("description"),
    notes:             ns("notes"),
    investment_ticket: ns("investment_ticket"),
    investment_stage:  ns("investment_stage"),
    user_id: user.id,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
