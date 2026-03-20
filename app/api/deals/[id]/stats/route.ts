import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [dealRes, orgsRes, commitmentsRes, activitiesRes] = await Promise.all([
    supabase.from("deals")
      .select("id,name,deal_type,deal_status,deal_stage,target_amount,committed_amount,closed_amount,currency,target_date")
      .eq("id", id).maybeSingle(),
    supabase.from("deal_organizations")
      .select("organizations(id,name,base_status,organization_type,investment_ticket)")
      .eq("deal_id", id),
    supabase.from("investor_commitments")
      .select("id,amount,currency,status,committed_at,organization_id,organizations(name)")
      .eq("deal_id", id).order("committed_at", { ascending: false }),
    supabase.from("activities")
      .select("id,activity_type,activity_date").eq("deal_id", id)
      .order("activity_date", { ascending: false }).limit(30),
  ]);

  const deal = dealRes.data;
  const orgs = (orgsRes.data ?? []).map((r: any) => Array.isArray(r.organizations) ? r.organizations[0] : r.organizations).filter(Boolean);
  const commitments = commitmentsRes.data ?? [];

  const orgByStatus: Record<string,number> = {};
  for (const o of orgs) orgByStatus[(o as any).base_status] = (orgByStatus[(o as any).base_status] ?? 0) + 1;

  const totalHard = (commitments as any[]).filter(c => ["hard","signed","transferred"].includes(c.status)).reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
  const totalSoft = (commitments as any[]).filter(c => ["soft","hard","signed","transferred"].includes(c.status)).reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
  const target = deal?.target_amount ?? 0;

  return NextResponse.json({
    deal, orgs_total: orgs.length, orgs_by_status: orgByStatus,
    commitments, total_committed: totalSoft, total_hard: totalHard,
    target_amount: target,
    completion_pct: target ? Math.round((totalHard / target) * 100) : 0,
  });
}
