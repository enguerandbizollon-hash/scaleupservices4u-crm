import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMandateById } from "@/actions/mandates";
import { getFeesByMandate } from "@/actions/fees";
import { MandateDetail } from "./mandate-detail";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [mandate, fees] = await Promise.all([
    getMandateById(id),
    getFeesByMandate(id),
  ]);

  if (!mandate) notFound();

  // Dossiers liés à ce mandat
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, deal_type, deal_stage, deal_status")
    .eq("mandate_id", id)
    .order("created_at", { ascending: false });

  return (
    <MandateDetail
      mandate={mandate}
      initialFees={fees as any}
      deals={deals ?? []}
    />
  );
}

export default function MandatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
