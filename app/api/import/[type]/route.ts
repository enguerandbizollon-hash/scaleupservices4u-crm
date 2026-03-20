import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ns(v: string | undefined): string | null {
  const s = (v ?? "").trim(); return s || null;
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return null;
}

const DEAL_TYPES  = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
const DEAL_STAGES = ["kickoff","preparation","outreach","management_meetings","dd","negotiation","closing","post_closing","ongoing_support","search"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { rows } = await req.json() as { rows: Record<string,string>[] };
  if (!rows?.length) return NextResponse.json({ ok: 0, errors: [] });

  /* ══ ORGANISATIONS — RPC PostgreSQL (1 transaction) ══ */
  if (type === "organisations") {
    // Préparer le JSON pour la RPC
    const payload = rows.map(r => ({
      name:              ns(r.name),
      organization_type: ns(r.organization_type) ?? "other",
      base_status:       ns(r.base_status) ?? "to_qualify",
      sector:            ns(r.sector),
      location:          ns(r.location),
      website:           ns(r.website),
      notes:             ns(r.notes),
      description:       ns(r.description),
      investment_ticket: ns(r.investment_ticket),
      investment_stage:  ns(r.investment_stage),
      deal_name:         ns(r.deal_name),
      contact_date:      parseDate(r.contact_date),
    })).filter(r => r.name);

    const { data, error } = await supabase.rpc("bulk_import_organizations", {
      p_rows: payload,
      p_user_id: user.id,
    });

    if (error) return NextResponse.json({ ok: 0, errors: [error.message] }, { status: 500 });
    return NextResponse.json({ ok: data.ok, errors: data.errors ?? [] });
  }

  /* ══ CONTACTS — RPC PostgreSQL (1 transaction) ══ */
  if (type === "contacts") {
    const payload = rows.map(r => ({
      first_name:        ns(r.first_name),
      last_name:         ns(r.last_name),
      email:             ns(r.email),
      phone:             ns(r.phone),
      title:             ns(r.title),
      organisation_name: ns(r.organisation_name),
      role_label:        ns(r.role_label),
      sector:            ns(r.sector),
      country:           ns(r.country),
      linkedin_url:      ns(r.linkedin_url),
      notes:             ns(r.notes),
      base_status:       ns(r.base_status) ?? "to_qualify",
      last_contact_date: ns(r.last_contact_date),
    })).filter(r => r.first_name && r.last_name);

    const { data, error } = await supabase.rpc("bulk_import_contacts", {
      p_rows: payload,
      p_user_id: user.id,
    });

    if (error) return NextResponse.json({ ok: 0, errors: [error.message] }, { status: 500 });
    return NextResponse.json({ ok: data.ok, errors: data.errors ?? [] });
  }

  /* ══ DOSSIERS — direct (peu fréquent, pas besoin de RPC) ══ */
  if (type === "dossiers") {
    let ok = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      try {
        const { data: exist } = await supabase.from("deals")
          .select("id").ilike("name", name).limit(1).maybeSingle();
        if (exist) {
          await supabase.from("deals").update({
            deal_type:      DEAL_TYPES.includes(r.deal_type)   ? r.deal_type  : undefined,
            deal_stage:     DEAL_STAGES.includes(r.deal_stage) ? r.deal_stage : undefined,
            deal_status:    ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : undefined,
            priority_level: ["high","medium","low"].includes(r.priority_level) ? r.priority_level : undefined,
            sector:         ns(r.sector) ?? undefined,
            location:       ns(r.location) ?? undefined,
            description:    ns(r.description) ?? undefined,
          }).eq("id", exist.id);
          ok++; continue;
        }
        const { error } = await supabase.from("deals").insert({
          name,
          deal_type:      DEAL_TYPES.includes(r.deal_type)    ? r.deal_type   : "fundraising",
          deal_status:    ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : "active",
          deal_stage:     DEAL_STAGES.includes(r.deal_stage)  ? r.deal_stage  : "kickoff",
          priority_level: ["high","medium","low"].includes(r.priority_level) ? r.priority_level : "medium",
          client_organization_id: null,
          sector:      ns(r.sector),
          location:    ns(r.location),
          description: ns(r.description),
          user_id: user.id,
        });
        if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
        ok++;
      } catch(e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
    return NextResponse.json({ ok, errors });
  }

  return NextResponse.json({ ok: 0, errors: ["Type inconnu"] }, { status: 400 });
}
