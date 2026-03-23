import { createClient } from "@/lib/supabase/server";

export async function getDealFormData(dealId?: string) {
  const supabase = await createClient();
  const [orgsRes, dealRes] = await Promise.all([
    supabase.from("organizations").select("id,name,organization_type").order("name"),
    dealId ? supabase.from("deals").select("*").eq("id", dealId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    organizations: orgsRes.data ?? [],
    deal: dealRes.data ?? null,
  };
}
