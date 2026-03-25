import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/search/contacts-by-org?org_id=<uuid>&query=<search>
 *
 * Cherche les contacts dans une organisation spécifique
 * Utilise la RPC search_contacts_by_org() de Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get("org_id");
    const query = searchParams.get("query") || "%";

    if (!org_id) {
      return NextResponse.json(
        { error: "org_id is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Appeler la RPC search_contacts_by_org
    const { data, error } = await supabase.rpc(
      "search_contacts_by_org",
      {
        p_org_id: org_id,
        p_query: query,
      }
    );

    if (error) {
      console.error("RPC error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Transformer les données en format attendu par OrgContactPicker
    const contacts = (data || []).map((c: any) => ({
      contactId: c.id,
      firstName: c.full_name?.split(" ")[0] || "",
      lastName: c.full_name?.split(" ").slice(1).join(" ") || "",
      email: c.email,
      title: c.title,
      primaryOrganizationId: c.primary_organization_id,
      isPrimary: c.has_primary,
    }));

    return NextResponse.json({
      contacts,
      total: contacts.length,
    });
  } catch (err) {
    console.error("Error in /api/search/contacts-by-org:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
