import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ns(v: string | undefined): string | null {
  const s = (v ?? "").trim(); return s || null;
}

const VALID_ORG_TYPES = ["client","prospect_client","investor","buyer","target","law_firm","bank","advisor","accounting_firm","family_office","corporate","consulting_firm","other"];
const VALID_STATUSES  = ["to_qualify","qualified","priority","active","dormant","inactive","excluded"];
const VALID_TICKETS   = ["< 50k€","50k – 200k€","200k – 500k€","500k – 1M€","1M – 3M€","3M – 10M€","> 10M€"];
const VALID_STAGES    = ["Pre-seed","Seed","Série A","Série B","Growth","PE / LBO","Restructuring"];
const VALID_SECTORS   = ["Généraliste","Technologie / SaaS","Intelligence Artificielle","Fintech / Insurtech","Santé / Medtech","Industrie / Manufacturing","Énergie / CleanTech","Immobilier","Distribution / Retail","Médias / Entertainment","Transport / Logistique","Agroalimentaire","Éducation / EdTech","Défense / Sécurité","Tourisme / Hospitality","Services B2B","Conseil / Advisory","Juridique","Finance / Investissement","Ressources Humaines","Luxe / Premium","Construction / BTP","Télécommunications","Agriculture / AgriTech","Chimie / Matériaux","Aérospatial","Environnement","Sport / Loisirs","Bien-être / Beauté","Cybersécurité","Autre"];
const GENERALIST_TYPES = ["family_office","bank","advisor","law_firm","accounting_firm","other"];

const STATUS_MAP: Record<string,string> = {
  rencontre:"qualified", arencontrer:"to_qualify", contacte:"active",
  arelancer:"active", qualified:"qualified", active:"active",
  to_qualify:"to_qualify", priority:"priority", dormant:"dormant",
  inactive:"inactive", excluded:"excluded",
};

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return null;
}

function matchVal(raw: string|null, list: string[]): string|null {
  if (!raw) return null;
  return list.find(v => v.toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(v.toLowerCase())) ?? raw;
}

function matchSector(raw: string|null, orgType: string): string {
  if (!raw) return "Généraliste";
  return VALID_SECTORS.find(s => s.toLowerCase().includes(raw.toLowerCase())) ?? raw;
}

async function linkOrgToDeal(supabase: any, orgId: string, dealName: string, contactDate: string|null, orgName: string, userId: string) {
  const { data: deal } = await supabase.from("deals").select("id").ilike("name", dealName).limit(1).maybeSingle();
  if (!deal) return;

  // INSERT avec ON CONFLICT ignoré — pas besoin de contrainte unique préalable
  await supabase.from("deal_organizations").upsert(
    { deal_id: deal.id, organization_id: orgId, user_id: userId },
    { onConflict: "deal_id,organization_id", ignoreDuplicates: true }
  );

  if (contactDate) {
    const { data: exist } = await supabase.from("activities")
      .select("id").eq("organization_id", orgId).eq("deal_id", deal.id).limit(1).maybeSingle();
    if (!exist) {
      await supabase.from("activities").insert({
        title: `Prise de contact — ${orgName}`,
        activity_type: "email", activity_date: contactDate,
        organization_id: orgId, deal_id: deal.id,
        summary: `Import CSV`, user_id: userId,
      });
    }
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { rows } = await req.json() as { rows: Record<string,string>[] };
  if (!rows?.length) return NextResponse.json({ ok:0, errors:[] });

  let ok = 0;
  const errors: string[] = [];

  /* ═══ CONTACTS ═══ */
  if (type === "contacts") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const firstName = ns(r.first_name);
      const lastName  = ns(r.last_name);
      if (!firstName || !lastName) { errors.push(`Ligne ${i+2}: prénom/nom manquant`); continue; }
      try {
        // Résoudre org
        let orgId: string|null = null;
        const orgName = ns(r.organisation_name);
        if (orgName) {
          const { data: eo } = await supabase.from("organizations").select("id").ilike("name", orgName).limit(1).maybeSingle();
          orgId = eo?.id ?? null;
          if (!orgId) {
            const { data: no } = await supabase.from("organizations")
              .insert({ name: orgName, organization_type:"other", base_status:"to_qualify", user_id: user.id })
              .select("id").single();
            orgId = no?.id ?? null;
          }
        }

        const emailVal = ns(r.email);
        const contactStatus = VALID_STATUSES.includes(r.base_status) ? r.base_status : "to_qualify";
        const lastContactDate = parseDate(r.last_contact_date);

        // Déduplication email → prénom+nom
        let existingId: string|null = null;
        if (emailVal) {
          const { data } = await supabase.from("contacts").select("id").eq("email", emailVal).maybeSingle();
          if (data) existingId = data.id;
        }
        if (!existingId) {
          const { data } = await supabase.from("contacts").select("id")
            .ilike("first_name", firstName).ilike("last_name", lastName).limit(1).maybeSingle();
          if (data) existingId = data.id;
        }

        if (existingId) {
          // Enrichissement non-destructif
          const { data: cur } = await supabase.from("contacts")
            .select("email,phone,title,sector,country,linkedin_url,notes,base_status,last_contact_date").eq("id", existingId).single();
          const upd: Record<string,any> = {};
          if (!cur.email        && emailVal)           upd.email = emailVal;
          if (!cur.phone        && ns(r.phone))        upd.phone = ns(r.phone);
          if (!cur.title        && ns(r.title))        upd.title = ns(r.title);
          if (!cur.sector       && ns(r.sector))       upd.sector = ns(r.sector);
          if (!cur.country      && ns(r.country))      upd.country = ns(r.country);
          if (!cur.linkedin_url && ns(r.linkedin_url)) upd.linkedin_url = ns(r.linkedin_url);
          if (!cur.notes        && ns(r.notes))        upd.notes = ns(r.notes);
          if (r.base_status && VALID_STATUSES.includes(r.base_status)) upd.base_status = r.base_status;
          if (lastContactDate) upd.last_contact_date = lastContactDate;
          if (Object.keys(upd).length) await supabase.from("contacts").update(upd).eq("id", existingId);

          if (orgId) {
            const { data: oc } = await supabase.from("organization_contacts")
              .select("id").eq("contact_id", existingId).eq("organization_id", orgId).maybeSingle();
            if (!oc) await supabase.from("organization_contacts").insert({
              organization_id: orgId, contact_id: existingId,
              role_label: ns(r.role_label), is_primary: false, user_id: user.id,
            });
          }
          ok++; continue;
        }

        const { data: contact, error: cErr } = await supabase.from("contacts").insert({
          first_name: firstName, last_name: lastName,
          email: emailVal, phone: ns(r.phone), title: ns(r.title),
          sector: ns(r.sector), country: ns(r.country),
          linkedin_url: ns(r.linkedin_url), notes: ns(r.notes),
          base_status: contactStatus, last_contact_date: lastContactDate,
          user_id: user.id,
        }).select("id").single();
        if (cErr) { errors.push(`Ligne ${i+2}: ${cErr.message}`); continue; }
        if (orgId && contact) {
          await supabase.from("organization_contacts").insert({
            organization_id: orgId, contact_id: contact.id,
            role_label: ns(r.role_label), is_primary: false, user_id: user.id,
          });
        }
        ok++;
      } catch(e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
  }

  /* ═══ ORGANISATIONS ═══ */
  else if (type === "organisations") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      try {
        const orgType   = VALID_ORG_TYPES.includes(r.organization_type) ? r.organization_type : "other";
        const rawStatus = (r.base_status||"").toLowerCase().replace(/\s/g,"");
        const orgStatus = STATUS_MAP[rawStatus] ?? "to_qualify";
        const ticket    = matchVal(ns(r.investment_ticket), VALID_TICKETS);
        const stage     = matchVal(ns(r.investment_stage), VALID_STAGES);
        const sector    = matchSector(ns(r.sector), orgType);
        const dealName  = ns(r.deal_name);
        const contactDate = parseDate(r.contact_date);

        const orgData = {
          organization_type: orgType, base_status: orgStatus,
          sector, location: ns(r.location),
          website: ns(r.website), notes: ns(r.notes),
          description: ns(r.description),
          investment_ticket: ticket, investment_stage: stage,
          deal_name_hint: dealName, // ← stocker le hint pour le retrolink
        };

        const { data: existOrg } = await supabase.from("organizations")
          .select("id").ilike("name", name).limit(1).maybeSingle();

        let orgId: string|null = null;
        if (existOrg) {
          await supabase.from("organizations").update(orgData).eq("id", existOrg.id);
          orgId = existOrg.id;
        } else {
          const { data: newOrg, error: insErr } = await supabase.from("organizations")
            .insert({ name, ...orgData, user_id: user.id }).select("id").single();
          if (insErr) { errors.push(`Ligne ${i+2}: ${insErr.message}`); continue; }
          orgId = newOrg?.id ?? null;
        }

        // Lier au dossier immédiatement si possible
        if (orgId && dealName) {
          await linkOrgToDeal(supabase, orgId, dealName, contactDate, name, user.id);
        }
        ok++;
      } catch(e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
  }

  /* ═══ DOSSIERS ═══ */
  else if (type === "dossiers") {
    const DEAL_TYPES  = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
    const DEAL_STAGES = ["kickoff","preparation","outreach","management_meetings","dd","negotiation","closing","post_closing","ongoing_support","search"];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      try {
        const { data: exist } = await supabase.from("deals").select("id").ilike("name", name).limit(1).maybeSingle();
        if (exist) {
          await supabase.from("deals").update({
            deal_type:  DEAL_TYPES.includes(r.deal_type)   ? r.deal_type   : undefined,
            deal_stage: DEAL_STAGES.includes(r.deal_stage) ? r.deal_stage  : undefined,
            deal_status: ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : undefined,
            priority_level: ["high","medium","low"].includes(r.priority_level) ? r.priority_level : undefined,
            sector: ns(r.sector)||undefined, location: ns(r.location)||undefined,
            description: ns(r.description)||undefined,
          }).eq("id", exist.id);
          ok++; continue;
        }
        const { error } = await supabase.from("deals").insert({
          name,
          deal_type:      DEAL_TYPES.includes(r.deal_type)   ? r.deal_type   : "fundraising",
          deal_status:    ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : "active",
          deal_stage:     DEAL_STAGES.includes(r.deal_stage) ? r.deal_stage  : "kickoff",
          priority_level: ["high","medium","low"].includes(r.priority_level) ? r.priority_level : "medium",
          client_organization_id: null,
          sector: ns(r.sector), location: ns(r.location),
          description: ns(r.description), user_id: user.id,
        });
        if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
        ok++;
      } catch(e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
  }

  return NextResponse.json({ ok, errors });
}
