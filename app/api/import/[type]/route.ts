import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ns(v: string | undefined): string | null {
  const s = (v ?? "").trim(); return s || null;
}

const VALID_ORG_TYPES = ["client","prospect_client","investor","buyer","target","law_firm","bank","advisor","accounting_firm","family_office","corporate","consulting_firm","other"];
const VALID_ORG_STATUSES = ["rencontre","arencontrer","contacte","arelancer","to_qualify","qualified","active","dormant","inactive","excluded"];
const VALID_TICKETS = ["< 50k€","50k – 200k€","200k – 500k€","500k – 1M€","1M – 3M€","3M – 10M€","> 10M€"];
const VALID_STAGES = ["Pre-seed","Seed","Série A","Série B","Growth","PE / LBO","Restructuring"];
const VALID_SECTORS = ["Technologie / SaaS","Intelligence Artificielle","Fintech / Insurtech","Santé / Medtech","Industrie / Manufacturing","Énergie / CleanTech","Immobilier","Distribution / Retail","Médias / Entertainment","Transport / Logistique","Agroalimentaire","Éducation / EdTech","Défense / Sécurité","Tourisme / Hospitality","Services B2B","Conseil / Advisory","Juridique","Finance / Investissement","Ressources Humaines","Luxe / Premium","Construction / BTP","Télécommunications","Agriculture / AgriTech","Chimie / Matériaux","Aérospatial","Environnement","Sport / Loisirs","Bien-être / Beauté","Cybersécurité","Autre"];

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  // Formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const fr = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return null;
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

  /* ── CONTACTS ────────────────────────────────── */
  if (type === "contacts") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const firstName = ns(r.first_name);
      const lastName = ns(r.last_name);
      if (!firstName || !lastName) { errors.push(`Ligne ${i+2}: prénom/nom manquant`); continue; }
      try {
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
        const emailVal = ns(r.email);

        // ── Recherche doublon : email > prénom+nom+org > prénom+nom ──
        let existingContact: { id: string; email: string|null; phone: string|null; title: string|null; sector: string|null; country: string|null; linkedin_url: string|null; notes: string|null } | null = null;

        if (emailVal) {
          const { data } = await supabase.from("contacts").select("id,email,phone,title,sector,country,linkedin_url,notes").eq("email", emailVal).maybeSingle();
          existingContact = data;
        }
        if (!existingContact) {
          const orgName = ns(r.organisation_name);
          const { data } = await supabase.from("contacts")
            .select("id,email,phone,title,sector,country,linkedin_url,notes")
            .ilike("first_name", firstName).ilike("last_name", lastName)
            .limit(1).maybeSingle();
          existingContact = data;
        }

        if (existingContact) {
          // Enrichissement non-destructif : ne complète que les champs vides
          const updates: Record<string, string|null> = {};
          if (!existingContact.phone    && ns(r.phone))        updates.phone        = ns(r.phone);
          if (!existingContact.title    && ns(r.title))        updates.title        = ns(r.title);
          if (!existingContact.sector   && ns(r.sector))       updates.sector       = ns(r.sector);
          if (!existingContact.country  && ns(r.country))      updates.country      = ns(r.country);
          if (!existingContact.linkedin_url && ns(r.linkedin_url)) updates.linkedin_url = ns(r.linkedin_url);
          if (!existingContact.email    && emailVal)            updates.email        = emailVal;
          if (!existingContact.notes    && ns(r.notes))        updates.notes        = ns(r.notes);

          if (Object.keys(updates).length > 0) {
            await supabase.from("contacts").update(updates).eq("id", existingContact.id);
          }
          // Lier à l'organisation si pas déjà fait
          if (orgId) {
            const { data: oc } = await supabase.from("organization_contacts")
              .select("id").eq("contact_id", existingContact.id).eq("organization_id", orgId).maybeSingle();
            if (!oc) {
              await supabase.from("organization_contacts").insert({
                organization_id: orgId, contact_id: existingContact.id,
                role_label: ns(r.role_label), is_primary: false, user_id: user.id,
              });
            }
          }
          ok++;
          continue;
        }

        // Nouveau contact
        const validStatuses = ["to_qualify","qualified","active","priority","dormant","inactive","excluded"];
        const contactStatus = validStatuses.includes(r.base_status) ? r.base_status : "to_qualify";
        const lastContactDate = ns(r.last_contact_date) ? 
          (() => { const p=ns(r.last_contact_date)!.split("/"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:null; })() : null;
        
        const { data: contact, error } = await supabase.from("contacts").insert({
          first_name: firstName, last_name: lastName,
          email: emailVal, phone: ns(r.phone), title: ns(r.title),
          sector: ns(r.sector), country: ns(r.country),
          linkedin_url: ns(r.linkedin_url), notes: ns(r.notes),
          base_status: contactStatus,
          last_contact_date: lastContactDate,
          user_id: user.id,
        }).select("id").single();
        if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
        if (orgId && contact) {
          await supabase.from("organization_contacts").insert({ organization_id: orgId, contact_id: contact.id, role_label: ns(r.role_label), is_primary: false, user_id: user.id });
        }
        ok++;
      } catch (e: any) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
  }

  /* ── ORGANISATIONS ──────────────────────────── */
  else if (type === "organisations") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }

      // Normaliser les valeurs des menus déroulants
      const orgType = VALID_ORG_TYPES.includes(r.organization_type) ? r.organization_type : "other";
      // Mapper les statuts métier vers l'enum Supabase base_status
      const rawStatus = (r.base_status || "").toLowerCase().replace(/\s/g,"");
      const statusMap: Record<string,string> = {
        rencontre:   "qualified",   // Rencontré → Qualifié
        arelancer:   "active",      // À relancer → Actif (en cours)
        contacte:    "active",      // Contacté → Actif
        arencontrer: "to_qualify",  // À rencontrer → À qualifier
        excluded:    "excluded",    // Exclu → Exclu
        excluded_no_go: "excluded",
        // Valeurs enum natives (pass-through)
        to_qualify:  "to_qualify",
        qualified:   "qualified",
        priority:    "priority",
        active:      "active",
        dormant:     "dormant",
        inactive:    "inactive",
      };
      const orgStatus = statusMap[rawStatus] ?? "to_qualify";

      // Ticket — accepte valeur exacte ou partielle
      const ticketRaw = ns(r.investment_ticket);
      const ticket = ticketRaw ? (VALID_TICKETS.find(t => t.includes(ticketRaw) || ticketRaw.includes(t.replace(/[€\s]/g,""))) ?? ticketRaw) : null;

      // Stage — accepte valeur exacte ou partielle
      const stageRaw = ns(r.investment_stage);
      const stage = stageRaw ? (VALID_STAGES.find(s => s.toLowerCase().includes(stageRaw.toLowerCase()) || stageRaw.toLowerCase().includes(s.toLowerCase())) ?? stageRaw) : null;

      // Secteur
      const sectorRaw = ns(r.sector);
      const sectorMatched = sectorRaw ? (VALID_SECTORS.find(s => s.toLowerCase().includes(sectorRaw.toLowerCase())) ?? sectorRaw) : null;
      const GENERALIST_TYPES = ["family_office","bank","advisor","law_firm","accounting_firm","other"];
      const sector = sectorMatched || (GENERALIST_TYPES.includes(orgType) ? "Généraliste" : "Généraliste");

      // Insérer l'organisation
      // Vérifier si l'org existe déjà par nom (sans upsert)
      const { data: existingOrg } = await supabase
        .from("organizations").select("id").ilike("name", name).limit(1).maybeSingle();

      let org: { id: string } | null = null;
      let orgErr: any = null;

      if (existingOrg) {
        // Mettre à jour l'organisation existante
        const { error: upErr } = await supabase.from("organizations").update({
          organization_type: orgType, base_status: orgStatus,
          sector, location: ns(r.location), country: ns(r.location) ?? ns(r.country),
          website: ns(r.website), notes: ns(r.notes),
          description: ns(r.description),
          investment_ticket: ticket, investment_stage: stage,
        }).eq("id", existingOrg.id);
        org = existingOrg;
        orgErr = upErr;
      } else {
        // Insérer nouvelle organisation
        const { data: newOrg, error: insErr } = await supabase.from("organizations").insert({
          name, organization_type: orgType, base_status: orgStatus,
          sector, location: ns(r.location), country: ns(r.location) ?? ns(r.country),
          website: ns(r.website), notes: ns(r.notes),
          description: ns(r.description),
          investment_ticket: ticket, investment_stage: stage,
          user_id: user.id,
        }).select("id").single();
        org = newOrg;
        orgErr = insErr;
      }

      if (orgErr) { errors.push(`Ligne ${i+2}: ${orgErr.message}`); continue; }

      // Lien avec dossier existant
      const dealName = ns(r.deal_name);
      const contactDate = parseDate(r.contact_date);

      if (dealName && org) {
        const { data: deal } = await supabase.from("deals").select("id").ilike("name", dealName).limit(1).maybeSingle();
        if (deal) {
          // Mettre à jour le dossier pour lier l'organisation
          await supabase.from("deals").update({ client_organization_id: org.id }).eq("id", deal.id);

          // Créer une activité "prise de contact" si date fournie
          if (contactDate) {
            await supabase.from("activities").insert({
              title: `Prise de contact — ${name}`,
              activity_type: "email",
              activity_date: contactDate,
              organization_id: org.id,
              deal_id: deal.id,
              summary: `Import CSV — premier contact avec ${name}`,
              user_id: user.id,
            }).single();
          }
        }
      }

      ok++;
    }
  }

  /* ── DOSSIERS ───────────────────────────────── */
  else if (type === "dossiers") {
    const validDealTypes = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
    const validDealStages = ["kickoff","preparation","outreach","management_meetings","dd","negotiation","closing","post_closing","ongoing_support","search"];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = ns(r.name);
      if (!name) { errors.push(`Ligne ${i+2}: nom manquant`); continue; }
      const dealType = validDealTypes.includes(r.deal_type) ? r.deal_type : "fundraising";
      const dealStage = validDealStages.includes(r.deal_stage) ? r.deal_stage : "kickoff";
      const dealStatus = ["active","inactive","closed"].includes(r.deal_status) ? r.deal_status : "active";
      const priority = ["high","medium","low"].includes(r.priority_level) ? r.priority_level : "medium";

      let orgId: string | null = null;
      const orgName = ns(r.organisation_name);
      if (orgName) {
        const { data: existing } = await supabase.from("organizations").select("id").ilike("name", orgName).limit(1).maybeSingle();
        orgId = existing?.id ?? null;
      }

      // Ajouter location si fourni
      const dealLocation = ns(r.location);
      const { error } = await supabase.from("deals").insert({
        name, deal_type: dealType, deal_status: dealStatus, deal_stage: dealStage,
        priority_level: priority,
        client_organization_id: null,  // Les orgs se lient aux dossiers, pas l'inverse
        sector: ns(r.sector), location: dealLocation,
        description: ns(r.description), user_id: user.id,
      });
      if (error) { errors.push(`Ligne ${i+2}: ${error.message}`); continue; }
      ok++;
    }
  }

  return NextResponse.json({ ok, errors });
}
