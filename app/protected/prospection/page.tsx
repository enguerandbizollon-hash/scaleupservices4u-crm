import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProspectionClient, type UniversRow, type ProfileRow } from "./prospection-client";

export const revalidate = 0;
// Les server actions invoquées depuis cette page (run de chasse) héritent de
// cette limite : un run plafonné à 10 000 fiches tient largement dans 300 s.
export const maxDuration = 300;

const PAGE_SIZE = 50;
const VALID_STATUTS = new Set(["nouveau", "a_approcher", "approche", "echange", "dormant", "ecarte", "promu"]);

type ProspectionSearchParams = Promise<{ statut?: string; page?: string; tri?: string; q?: string; fiche?: string; filtre?: string }>;

async function Content({ searchParams }: { searchParams: ProspectionSearchParams }) {
  const { statut, page: pageParam, tri, q: qParam, fiche: ficheParam, filtre } = await searchParams;
  const supabase = await createClient();

  const activeStatut = statut && VALID_STATUTS.has(statut) ? statut : null;
  // Filtres du bandeau KPI : le clic sur une tuile doit montrer EXACTEMENT la
  // population comptée (audit 2026-07-31 : chiffre 0 face à une liste de 74).
  const activeFiltre = filtre === "chaudes" || filtre === "entrees7j" ? filtre : null;
  // Tri radar par DÉFAUT (audit 2026-07-30) : les fiches chaudes en tête,
  // c'est la raison d'être de l'univers. tri=recent pour l'ordre d'arrivée.
  const sortRadar = tri !== "recent";
  const q = (qParam ?? "").trim() || null;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const sevenDaysAgoDate = sevenDaysAgoIso.slice(0, 10);

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
  // Mêmes prédicats que les compteurs KPI plus bas, à l'identique.
  if (activeFiltre === "chaudes") {
    universQuery = universQuery.gte("cedabilite_score", 70).not("statut", "in", '("ecarte","promu")');
  } else if (activeFiltre === "entrees7j") {
    universQuery = universQuery.gte("first_seen_at", sevenDaysAgoIso);
  }

  const countByStatut = (s: string) =>
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).eq("statut", s);

  // Bandeau de flux (audit 2026-07-30 : « il me faut des KPI, du flux ») :
  // l'écran dit ce qui entre, ce qui chauffe, ce qui attend une décision.
  const [universRes, profilesRes, nouveau, aApprocher, approche, echange, dormant, ecarte, promu, totalAll, chaudes, entrees7j, scorees, signaux7j] = await Promise.all([
    universQuery,
    supabase
      .from("screening_profiles")
      .select("id, name, filters, last_run_at, last_total_results, watch_enabled")
      .order("created_at", { ascending: true }),
    countByStatut("nouveau"),
    countByStatut("a_approcher"),
    countByStatut("approche"),
    countByStatut("echange"),
    countByStatut("dormant"),
    countByStatut("ecarte"),
    countByStatut("promu"),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).gte("cedabilite_score", 70).not("statut", "in", '("ecarte","promu")'),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).gte("first_seen_at", sevenDaysAgoIso),
    supabase.from("univers_entreprises").select("siren", { count: "exact", head: true }).not("cedabilite_score", "is", null),
    supabase.from("signaux").select("id", { count: "exact", head: true }).gte("signal_date", sevenDaysAgoDate),
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
    echange: echange.count ?? 0,
    dormant: dormant.count ?? 0,
    ecarte: ecarte.count ?? 0,
    promu: promu.count ?? 0,
  };

  // Deep-link ?fiche=SIREN (cran 2) : un signal, une notification ou un lien
  // externe ouvre directement le tiroir 360 de la fiche visée.
  let initialFiche: { siren: string; nom: string; statut: string } | null = null;
  if (ficheParam && /^\d{9}$/.test(ficheParam)) {
    const { data: f } = await supabase
      .from("univers_entreprises")
      .select("siren, nom, statut")
      .eq("siren", ficheParam)
      .maybeSingle();
    if (f) initialFiche = { siren: f.siren, nom: f.nom, statut: f.statut };
  }

  const flux = {
    total: totalAll.count ?? 0,
    chaudes: chaudes.count ?? 0,
    entrees7j: entrees7j.count ?? 0,
    aTrier: statCounts.nouveau,
    signaux7j: signaux7j.count ?? 0,
    couvertureRadar: (totalAll.count ?? 0) > 0 ? Math.round(((scorees.count ?? 0) / (totalAll.count ?? 1)) * 100) : 0,
  };

  return (
    <ProspectionClient
      profiles={(profilesRes.data ?? []) as ProfileRow[]}
      univers={(universRes.data ?? []) as UniversRow[]}
      universTotal={universRes.count ?? 0}
      statCounts={statCounts}
      flux={flux}
      activeStatut={activeStatut}
      activeFiltre={activeFiltre}
      sortRadar={sortRadar}
      searchQ={q}
      initialFiche={initialFiche}
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
