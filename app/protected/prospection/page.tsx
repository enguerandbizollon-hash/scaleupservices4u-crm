import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProspectionClient, type UniversRow, type ProfileRow } from "./prospection-client";

export const revalidate = 0;
// Les server actions invoquées depuis cette page (run de chasse) héritent de
// cette limite : un run plafonné à 10 000 fiches tient largement dans 300 s.
export const maxDuration = 300;

const PAGE_SIZE = 50;
const VALID_STATUTS = new Set(["nouveau", "a_approcher", "approche", "ecarte", "promu"]);

type ProspectionSearchParams = Promise<{ statut?: string; page?: string; tri?: string; q?: string }>;

async function Content({ searchParams }: { searchParams: ProspectionSearchParams }) {
  const { statut, page: pageParam, tri, q: qParam } = await searchParams;
  const supabase = await createClient();

  const activeStatut = statut && VALID_STATUTS.has(statut) ? statut : null;
  // Tri radar par DÉFAUT (audit 2026-07-30) : les fiches chaudes en tête,
  // c'est la raison d'être de l'univers. tri=recent pour l'ordre d'arrivée.
  const sortRadar = tri !== "recent";
  const q = (qParam ?? "").trim() || null;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let universQuery = supabase
    .from("univers_entreprises")
    .select("siren, nom, naf, secteur, departement, ville, date_creation, effectif_label, categorie, finances, age_dirigeant_principal, cedabilite_score, cedabilite_raisons, statut, organization_id, last_seen_at", { count: "exact" });
  universQuery = sortRadar
    ? universQuery.order("cedabilite_score", { ascending: false, nullsFirst: false })
    : universQuery.order("last_seen_at", { ascending: false });
  universQuery = universQuery.order("siren", { ascending: true }).range(from, from + PAGE_SIZE - 1);
  if (activeStatut) universQuery = universQuery.eq("statut", activeStatut);
  if (q) {
    universQuery = /^\d{9}$/.test(q)
      ? universQuery.eq("siren", q)
      : universQuery.ilike("nom", `%${q.replace(/[%_]/g, "\\$&")}%`);
  }

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
      sortRadar={sortRadar}
      searchQ={q}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}

export default function ProspectionPage({ searchParams }: { searchParams: ProspectionSearchParams }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
