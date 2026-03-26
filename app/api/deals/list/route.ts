import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("id, name").eq("deal_status", "open").order("name");
  return NextResponse.json({ deals: data ?? [] });
}
