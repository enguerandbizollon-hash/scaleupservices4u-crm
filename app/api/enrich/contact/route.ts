import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { contact_id, first_name, last_name, org_name, domain } = await req.json();

  // Résoudre les données manquantes depuis la base
  let fname = first_name, lname = last_name, orgn = org_name, dom = domain;

  if (contact_id && (!fname || !lname)) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name, organization_contacts(organizations(name, website))")
      .eq("id", contact_id).single();
    if (c) {
      fname = fname || c.first_name;
      lname = lname || c.last_name;
      const orgs = (c.organization_contacts as any[]) ?? [];
      if (!orgn && orgs[0]) {
        const o = Array.isArray(orgs[0].organizations) ? orgs[0].organizations[0] : orgs[0].organizations;
        orgn = o?.name;
        dom  = dom || extractDomain(o?.website);
      }
    }
  }

  if (!fname || !lname) return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });

  const hunterKey = process.env.HUNTER_API_KEY;
  const apolloKey = process.env.APOLLO_API_KEY;

  const results: Record<string, any> = { sources: [] };

  // ── Hunter.io ──────────────────────────────────────────────
  if (hunterKey && (dom || orgn)) {
    try {
      const hunterDomain = dom || await guessDomain(orgn ?? "");
      if (hunterDomain) {
        const url = `https://api.hunter.io/v2/email-finder?domain=${hunterDomain}&first_name=${encodeURIComponent(fname)}&last_name=${encodeURIComponent(lname)}&api_key=${hunterKey}`;
        const res = await fetch(url);
        const d = await res.json();
        if (d.data?.email) {
          results.email     = d.data.email;
          results.email_conf = d.data.confidence;
          results.linkedin  = d.data.linkedin;
          results.sources.push("hunter");
        }
      }
    } catch(e) { console.error("[Hunter]", e); }
  }

  // ── Apollo.io ──────────────────────────────────────────────
  if (apolloKey && !results.email) {
    try {
      const res = await fetch("https://api.apollo.io/v1/people/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey },
        body: JSON.stringify({
          first_name: fname, last_name: lname,
          organization_name: orgn,
          reveal_personal_emails: false,
        }),
      });
      const d = await res.json();
      const person = d.person;
      if (person) {
        if (person.email)            results.email    = person.email;
        if (person.linkedin_url)     results.linkedin = person.linkedin_url;
        if (person.phone_numbers?.[0]?.sanitized_number) results.phone = person.phone_numbers[0].sanitized_number;
        if (person.title)            results.title    = person.title;
        results.sources.push("apollo");
      }
    } catch(e) { console.error("[Apollo]", e); }
  }

  // Mettre à jour le contact si on a trouvé des données
  if (contact_id && results.sources.length > 0) {
    const { data: cur } = await supabase.from("contacts")
      .select("email, linkedin_url, phone, title").eq("id", contact_id).single();

    const updates: Record<string, any> = {};
    if (!cur?.email        && results.email)    updates.email        = results.email;
    if (!cur?.linkedin_url && results.linkedin) updates.linkedin_url = results.linkedin;
    if (!cur?.phone        && results.phone)    updates.phone        = results.phone;
    if (!cur?.title        && results.title)    updates.title        = results.title;

    if (Object.keys(updates).length) {
      await supabase.from("contacts").update(updates).eq("id", contact_id);
      results.updated = Object.keys(updates);
    }
  }

  return NextResponse.json({
    found: results.sources.length > 0,
    data: results,
    keys_configured: {
      hunter: !!hunterKey,
      apollo: !!apolloKey,
    }
  });
}

function extractDomain(url?: string): string {
  if (!url) return "";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace("www.", "");
  } catch { return ""; }
}

async function guessDomain(orgName: string): Promise<string> {
  // Heuristique simple : google.fr → google.fr
  const clean = orgName.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
  return ""; // Sans API externe, on ne peut pas deviner le domaine
}
