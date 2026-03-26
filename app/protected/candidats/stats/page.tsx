import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CANDIDATE_STATUSES } from "@/lib/crm/matching-maps";
import { ArrowLeft } from "lucide-react";

export const revalidate = 0;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

async function Content() {
  const supabase = await createClient();

  const now       = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1).toISOString();
  const start30d  = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const start7d   = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: allCandidates },
    { data: dcRows },
    { data: interviews30d },
    { data: feesRows },
    { data: statusLogYTD },
  ] = await Promise.all([
    supabase.from("candidates").select("candidate_status,created_at,source"),
    supabase
      .from("deal_candidates")
      .select("stage,combined_score,placement_fee,deals(deal_type,deal_status)")
      .eq("deals.deal_type" as never, "recruitment"),
    supabase
      .from("candidate_interviews")
      .select("interview_date,score,recommendation")
      .gte("interview_date", start30d.split("T")[0]),
    supabase
      .from("deal_candidates")
      .select("placement_fee")
      .not("placement_fee", "is", null),
    supabase
      .from("candidate_status_log")
      .select("new_status,created_at")
      .gte("created_at", startYear),
  ]);

  const candidates = allCandidates ?? [];
  const dc = (dcRows ?? []).filter((r) => {
    const deal = Array.isArray(r.deals) ? r.deals[0] : r.deals;
    return deal?.deal_type === "recruitment";
  });

  // Comptages par statut
  const byStatus: Record<string, number> = {};
  for (const c of candidates) byStatus[c.candidate_status] = (byStatus[c.candidate_status] ?? 0) + 1;

  // Ajouts cette semaine
  const addedThisWeek = candidates.filter(c => c.created_at >= start7d).length;

  // Placements YTD (via status_log)
  const placedYTD = (statusLogYTD ?? []).filter(l => l.new_status === "placed").length;

  // Pipeline stages
  const stageCount: Record<string, number> = {};
  for (const row of dc) stageCount[row.stage ?? "sourcing"] = (stageCount[row.stage ?? "sourcing"] ?? 0) + 1;

  // Score moyen des candidats avec score
  const scores = dc.map(r => r.combined_score).filter((s): s is number => s != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Entretiens 30j
  const intCount  = (interviews30d ?? []).length;
  const intAvgScore = (interviews30d ?? []).filter(i => i.score != null).length > 0
    ? Math.round((interviews30d ?? []).reduce((a, i) => a + (i.score ?? 0), 0) / (interviews30d ?? []).filter(i => i.score != null).length * 10) / 10
    : null;
  const goCount  = (interviews30d ?? []).filter(i => i.recommendation === "go").length;

  // Honoraires placés (fees)
  const totalFees = (feesRows ?? []).reduce((a, r) => a + (r.placement_fee ?? 0), 0);

  // Sources
  const sources: Record<string, number> = {};
  for (const c of candidates) sources[c.source ?? "manual"] = (sources[c.source ?? "manual"] ?? 0) + 1;

  const STAGE_LABELS: Record<string, string> = {
    sourcing: "Sourcing", approche: "Approche", entretien_rh: "Entretien RH",
    entretien_client: "Entretien client", offre: "Offre", closing: "Closing",
  };

  const kpiCard = (label: string, value: string | number, sub?: string, accent?: string) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? "var(--text-1)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 5 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link href="/protected/candidats" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-4)", textDecoration: "none" }}>
            <ArrowLeft size={14} /> Candidats
          </Link>
          <span style={{ color: "var(--text-5)" }}>·</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-1)" }}>Statistiques RH</h1>
        </div>

        {/* KPIs globaux */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {kpiCard("Vivier total", candidates.length, `+${addedThisWeek} cette semaine`)}
          {kpiCard("Placements YTD", placedYTD, `${new Date().getFullYear()}`)}
          {kpiCard("Entretiens (30j)", intCount, intAvgScore != null ? `Score moyen ${intAvgScore}/10` : undefined)}
          {kpiCard("Honoraires placés", totalFees > 0 ? fmtMoney(totalFees) : "—", "Total cumulé", "#1a56db")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Statuts */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Vivier par statut</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CANDIDATE_STATUSES.map(s => {
                const count = byStatus[s.value] ?? 0;
                const pct = candidates.length > 0 ? Math.round(count / candidates.length * 100) : 0;
                return (
                  <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 20, background: s.bg, color: s.tx, fontWeight: 600, minWidth: 90, textAlign: "center" }}>
                      {s.label}
                    </span>
                    <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: s.tx, borderRadius: 3, transition: "width .3s" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", minWidth: 28, textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pipeline */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Pipeline recrutement</div>
              {avgScore != null && (
                <span style={{ fontSize: 11.5, background: "#DBEAFE", color: "#1D4ED8", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>
                  Score moyen {avgScore}pts
                </span>
              )}
            </div>
            {Object.keys(stageCount).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-5)", fontStyle: "italic" }}>Aucun candidat en pipeline</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["sourcing","approche","entretien_rh","entretien_client","offre","closing"].map(stage => {
                  const count = stageCount[stage] ?? 0;
                  const max   = Math.max(...Object.values(stageCount), 1);
                  const pct   = Math.round(count / max * 100);
                  return (
                    <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-3)", minWidth: 120 }}>{STAGE_LABELS[stage] ?? stage}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#1a56db", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", minWidth: 24, textAlign: "right" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Entretiens 30j */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Entretiens — 30 derniers jours</div>
            {intCount === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-5)", fontStyle: "italic" }}>Aucun entretien ce mois-ci</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { label: "Total", value: intCount, bg: "#EEF2FF", tx: "#3730A3" },
                    { label: "Go ✓", value: goCount, bg: "#D1FAE5", tx: "#065F46" },
                    { label: "Score moyen", value: intAvgScore != null ? `${intAvgScore}/10` : "—", bg: "#F3F4F6", tx: "#374151" },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: item.bg, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: item.tx }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: item.tx, marginTop: 2, opacity: .8 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sources */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Sources vivier</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
                const pct = candidates.length > 0 ? Math.round(count / candidates.length * 100) : 0;
                const SRC_LABELS: Record<string, string> = {
                  manual: "Saisie manuelle", linkedin: "LinkedIn", apollo: "Apollo.io", other: "Autre",
                };
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-3)", minWidth: 120 }}>{SRC_LABELS[src] ?? src}</span>
                    <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#0891B2", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", minWidth: 28, textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function StatsRHPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content />
    </Suspense>
  );
}
