import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignauxList, type SignalRow } from "./signaux-list";

export const revalidate = 0;

// Flux de veille marché (phase 2, temps 1). Alimenté par le cron BODACC,
// pivot SIREN, rattaché automatiquement aux organisations du CRM.
// Filtrage côté serveur via searchParams (liens, pas d'état client).

const VALID_TYPES = new Set([
  "vente_cession", "procedure_collective", "radiation", "depot_comptes", "entree_screening",
  "fusion_absorption", "location_gerance", "changement_dirigeant", "rge_expire",
]);

async function Content({ searchParams }: { searchParams: Promise<{ type?: string; nonlus?: string }> }) {
  const { type, nonlus } = await searchParams;
  const supabase = await createClient();

  const activeType = type && VALID_TYPES.has(type) ? type : null;
  const unreadOnly = nonlus === "1";

  let query = supabase
    .from("signaux")
    .select("id, siren, signal_type, signal_date, titre, severity, read_at, organization_id, payload, organizations(name)")
    .order("signal_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeType) query = query.eq("signal_type", activeType);
  if (unreadOnly) query = query.is("read_at", null);

  const [{ data: rows, error }, { count: unreadCount }] = await Promise.all([
    query,
    supabase.from("signaux").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ padding: "16px 20px", background: "#FEE2E2", color: "#991B1B", borderRadius: 12, fontSize: 13.5 }}>
          Flux indisponible : {error.message}. La migration v66 est-elle appliquée ?
        </div>
      </div>
    );
  }

  // Signal actionnable (cran 2) : si le SIREN a une fiche univers, le signal
  // mène directement au tiroir 360 au lieu d'être un mur de lecture.
  const sirens = [...new Set((rows ?? []).map((r) => r.siren))];
  const inUnivers = new Set<string>();
  for (let i = 0; i < sirens.length; i += 500) {
    const { data: uRows } = await supabase
      .from("univers_entreprises")
      .select("siren")
      .in("siren", sirens.slice(i, i + 500));
    for (const u of uRows ?? []) inUnivers.add(u.siren);
  }

  const signaux: SignalRow[] = (rows ?? []).map((r) => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      siren: r.siren,
      signal_type: r.signal_type,
      signal_date: r.signal_date,
      titre: r.titre,
      severity: r.severity,
      read_at: r.read_at,
      organization_id: r.organization_id,
      organization_name: (org as { name?: string } | null)?.name ?? null,
      in_univers: inUnivers.has(r.siren),
      ville: typeof payload.ville === "string" ? payload.ville : null,
      departement: typeof payload.departement === "string" ? payload.departement : null,
      url: typeof payload.url === "string" ? payload.url : null,
    };
  });

  return (
    <SignauxList
      signaux={signaux}
      unreadCount={unreadCount ?? 0}
      activeType={activeType}
      unreadOnly={unreadOnly}
    />
  );
}

export default function SignauxPage({ searchParams }: { searchParams: Promise<{ type?: string; nonlus?: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
