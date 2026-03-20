import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ organizations:[], contacts:[], deals:[] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data, error } = await supabase.rpc("search_crm", {
    p_query: q,
    p_user_id: user.id,
    p_limit: 30,
  });

  if (error) {
    // Fallback ILIKE si la RPC échoue (ex: vecteurs pas encore indexés)
    const [orgs, contacts, deals] = await Promise.all([
      supabase.from("organizations").select("id,name,base_status,location").ilike("name", `%${q}%`).eq("user_id", user.id).limit(10),
      supabase.from("contacts").select("id,first_name,last_name,email,base_status").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`).eq("user_id", user.id).limit(10),
      supabase.from("deals").select("id,name,deal_status,sector").ilike("name", `%${q}%`).eq("user_id", user.id).limit(10),
    ]);
    return NextResponse.json({
      organizations: (orgs.data??[]).map(o => ({ id:o.id, type:"organization", name:o.name, sub:o.location??'', status:o.base_status })),
      contacts: (contacts.data??[]).map(c => ({ id:c.id, type:"contact", name:`${c.first_name} ${c.last_name}`, sub:c.email??'', status:c.base_status })),
      deals: (deals.data??[]).map(d => ({ id:d.id, type:"deal", name:d.name, sub:d.sector??'', status:d.deal_status })),
    });
  }

  return NextResponse.json(data);
}
