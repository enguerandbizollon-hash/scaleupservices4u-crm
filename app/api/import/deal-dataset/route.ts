import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { deal_name, orgs, contacts } = await req.json() as {
    deal_name: string;
    orgs: Record<string, string>[];
    contacts: Record<string, string>[];
  };

  if (!deal_name) return NextResponse.json({ error: "Nom du dossier requis" }, { status: 400 });

  const { data, error } = await supabase.rpc("import_deal_dataset", {
    p_deal_name: deal_name,
    p_orgs:      orgs ?? [],
    p_contacts:  contacts ?? [],
    p_user_id:   user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
