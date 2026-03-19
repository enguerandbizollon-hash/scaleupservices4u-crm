import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ns(v: string | undefined): string | null {
  const s = (v ?? "").trim(); return s || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { rows } = await req.json() as { rows: Record<string, string>[] };
  if (!rows?.length) return NextResponse.json({ ok: 0, errors: [] });

  let ok = 0;
  const errors: string[] = [];

  if (type === "contacts") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const firstName = ns(r.first_name);
      const lastName = ns(r.last_name);
      if (!firstName || !lastName) { errors.push(`Ligne ${i+2}: prénom/nom manquant`); continue; }

      try {
        // Résoudre l'organisation si renseignée
        let orgId: string | null = null;
        const orgName = ns(r.organisation_name);
        if (orgName) {
          const { data: existing } = await supabase.from("organizations").select("id").ilike("name", orgName).limit(1).maybeSingle();
          if (existing) { orgId = existing.id; }
          else {
            const { data: newOrg } = await supabase.from("organizations").insert({ name: orgName, organization_type: "other", base_status: "to_qualify", user_id: user.id }).select("id").single();
            if (newOrg) orgId = newOrg.id;
          }
        }

        const { data: contact, error } = await supabase.from("contacts").insert({
          first_name: firstName, last_name: lastName,
          email: ns(r.email), phone: ns(r.phone), title: ns(r.title),
          sector: ns(r.sector), country: ns(r.country),
          linkedin_url: ns(r.linkedin_url), notes: ns(r.notes),
          base_status: "to_qualify", user_id: user.id,
        }).select("id").single();

        if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }

        if (orgId && contact) {
          await supabase.from("organization_contacts").insert({
            organization_id: orgId, contact_id: contact.id,
            role_label: ns(r.role_label), is_primary: false, user_id: user.id,
          });
        }
        ok++;
      } catch (e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
  }

  else if (type === "organisations") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      const validTypes = ["client","prospect_client","investor","buyer","target","law_firm","bank","advisor","accounting_firm","family_office","corporate","consulting_firm","other"];
      const orgType = validTypes.includes(r.organization_type) ? r.organization_type : "other";
      const validStatuses = ["to_qualify","qualified","priority","active","dormant","inactive","excluded"];
      const orgStatus = validStatuses.includes(r.base_status) ? r.base_status : "to_qualify";
      const { error } = await supabase.from("organizations").insert({
        name, organization_type: orgType, base_status: orgStatus,
        sector: ns(r.sector), country: ns(r.country), website: ns(r.website), notes: ns(r.notes),
        user_id: user.id,
      });
      if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
      ok++;
    }
  }

  else if (type === "dossiers") {
    const validTypes = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
    const validStages = ["kickoff","preparation","outreach","management_meetings","dd","negotiation","closing","post_closing","ongoing_support","search"];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      const dealType = validTypes.includes(r.deal_type) ? r.deal_type : "fundraising";
      const dealStage = validStages.includes(r.deal_stage) ? r.deal_stage : "kickoff";
      const dealStatus = ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : "active";
      const priority = ["high","medium","low"].includes(r.priority_level) ? r.priority_level : "medium";

      let orgId: string | null = null;
      const orgName = ns(r.organisation_name);
      if (orgName) {
        const { data: existing } = await supabase.from("organizations").select("id").ilike("name", orgName).limit(1).maybeSingle();
        orgId = existing?.id ?? null;
      }

      const { error } = await supabase.from("deals").insert({
        name, deal_type: dealType, deal_status: dealStatus, deal_stage: dealStage,
        priority_level: priority, client_organization_id: orgId,
        sector: ns(r.sector), description: ns(r.description), user_id: user.id,
      });
      if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
      ok++;
    }
  }

  return NextResponse.json({ ok, errors });
}
