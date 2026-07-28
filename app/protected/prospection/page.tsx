import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProspectionClient, type UniversRow, type ProfileRow } from "./prospection-client";

export const revalidate = 0;
// Les server actions invoquées depuis cette page (run de chasse) héritent de
// cette limite : un run plafonné à 10 000 fiches tient largement dans 300 s.
export const maxDuration = 300;

const PAGE_SIZE = 50;
const VALID_STATUTS = new Set(["nouveau", "a_approcher", "approche", "ecarte", "promu"]);

async function Content({ searchParams }: { searchParams: Promise<{ statut?: string; page?: string }> }) {
  const { statut, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const activeStatut = statut && VALID_STATUTS.has(statut) ? statut : null;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let universQuery = supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, departement, ville, date_creation, effectif_label, categorie, finances, age_dirigeant_principal, statut, organization_id, last_seen_at", { count: "exact" })
    .order("last_seen_at", { ascending: false })
    .order("siren", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (activeStatut) universQuery = universQuery.eq("statut", activeStatut);

  const countByStatut = (s: string) =>
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).eq("statut", s);

  const [universRes, profilesRes, nouveau, aApprocher, approche, ecarte, promu] = await Promise.all([
    universQuery,
    supabase
      .from("screening_profiles")
      .select("id, name, filters, last_run_at, last_total_results, watch_enabled")
      .order("created_at", { ascending: true }),
    countByStatut("nouveau"),
    countByStatut("a_approcher"),
    countByStatut("approche"),
    countByStatut("ecarte"),
    countByStatut("promu"),
  ]);

  if (universRes.error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ padding: "16px 20px", background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13.5 }}>
          Univers indisponible : {universRes.error.message}. La migration v66 est-elle appliquée ?
        </div>
      </div>
    );
  }

  const statCounts = {
    nouveau: nouveau.count ?? 0,
    a_approcher: aApprocher.count ?? 0,
    approche: approche.count ?? 0,
    ecarte: ecarte.count ?? 0,
    promu: promu.count ?? 0,
  };

  return (
    <ProspectionClient
      profiles={(profilesRes.data ?? []) as ProfileRow[]}
      univers={(universRes.data ?? []) as UniversRow[]}
      universTotal={universRes.count ?? 0}
      statCounts={statCounts}
      activeStatut={activeStatut}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}

export default function ProspectionPage({ searchParams }: { searchParams: Promise<{ statut?: string; page?: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
