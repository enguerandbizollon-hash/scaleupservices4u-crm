import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Accept both JSON and FormData
  let body: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await req.json();
  } else {
    const fd = await req.formData();
    const ns = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v || null; };
    body = {
      name: ns("name"),
      organization_type: ns("organization_type"),
      base_status: ns("base_status"),
      sector: ns("sector"),
      location: ns("location"),
      website: ns("website"),
      linkedin_url: ns("linkedin_url"),
      description: ns("description"),
      notes: ns("notes"),
      investment_ticket: ns("investment_ticket"),
      investment_stage: ns("investment_stage"),
    };
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });

  // Vérif doublon
  const { data: existing } = await supabase.from("organizations")
    .select("id").eq("user_id", user.id).ilike("name", name).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ error: `Une organisation "${name}" existe déjà.` }, { status: 409 });

  // Validate investor_sectors max 3
  const sectors = Array.isArray(body.investor_sectors) ? body.investor_sectors as string[] : [];
  if (sectors.length > 3) {
    return NextResponse.json({ error: "Un fonds peut sélectionner au maximum 3 secteurs d'investissement" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    name,
    organization_type: body.organization_type ?? "other",
    base_status:       body.base_status ?? "to_qualify",
    location:          body.location ?? null,
    website:           body.website ?? null,
    linkedin_url:      body.linkedin_url ?? null,
    description:       body.description ?? null,
    notes:             body.notes ?? null,
    user_id:           user.id,
    // Legacy text fields (kept for backward compat)
    investment_ticket: body.investment_ticket ?? null,
    investment_stage:  body.investment_stage ?? null,
    // New structured investor fields
    investor_ticket_min:  body.investor_ticket_min ?? null,
    investor_ticket_max:  body.investor_ticket_max ?? null,
    investor_sectors:     sectors.length > 0 ? sectors : null,
    investor_stages:      Array.isArray(body.investor_stages) ? body.investor_stages : null,
    investor_thesis:      body.investor_thesis ?? null,
  };

  const { data, error } = await supabase.from("organizations")
    .insert(insert).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
