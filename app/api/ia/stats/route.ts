import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const [d, c, o] = await Promise.all([
    supabase.from("deals").select("*", { count:"exact", head:true }).eq("deal_status","active"),
    supabase.from("contacts").select("*", { count:"exact", head:true }),
    supabase.from("organizations").select("*", { count:"exact", head:true }),
  ]);
  return NextResponse.json({ deals: d.count??0, contacts: c.count??0, orgs: o.count??0 });
}
