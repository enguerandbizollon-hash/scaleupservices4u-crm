import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtAmt(n: number, currency = "EUR") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M ${currency}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} k ${currency}`;
  return `${n} ${currency}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)} %`; }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(a / b * 100); }

const TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell", ma_buy: "M&A Buy",
  cfo_advisor: "CFO Advisory", recruitment: "Recrutement",
};
const TYPE_COLORS: Record<string, { bg: string; tx: string }> = {
  fundraising: { bg: "#EFF6FF", tx: "#1D4ED8" },
  ma_sell:     { bg: "#FFF7ED", tx: "#C2410C" },
  ma_buy:      { bg: "#FFFBEB", tx: "#92400E" },
  cfo_advisor: { bg: "#F0FDF4", tx: "#166534" },
  recruitment: { bg: "#FDF4FF", tx: "#7E22CE" },
};

// ── Server data ──────────────────────────────────────────────────────────────

async function Content() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  // Parallel queries
  const [
    { data: fees },
    { data: deals },
    { data: mandates },
    { data: candidates },
    { data: feesAllTime },
  ] = await Promise.all([
    supabase.from("fee_milestones")
      .select("amount, currency, status, paid_date, invoiced_date, mandate_id")
      .eq("user_id", user.id)
      .neq("status", "cancelled"),
    supabase.from("deals")
      .select("id, deal_type, deal_status, deal_stage, target_amount, committed_amount, currency, created_at")
      .eq("user_id", user.id),
    supabase.from("mandates")
      .select("id, type, status, estimated_fee_amount, confirmed_fee_amount, currency")
      .eq("user_id", user.id),
    supabase.from("candidates")
      .select("id, candidate_status, updated_at")
      .eq("user_id", user.id),
    supabase.from("fee_milestones")
      .select("amount, currency, status, paid_date")
      .eq("user_id", user.id)
      .eq("status", "paid"),
  ]);

  const allFees       = fees ?? [];
  const allDeals      = deals ?? [];
  const allMandates   = mandates ?? [];
  const allCandidates = candidates ?? [];

  // ── Fees ────────────────────────────────────────────────────────────────
  const paidYtd     = allFees.filter(f => f.status === "paid"     && f.paid_date?.startsWith(String(year)));
  const invoicedYtd = allFees.filter(f => f.status === "invoiced" && f.invoiced_date?.startsWith(String(year)));
  const pending     = allFees.filter(f => f.status === "pending");

  const paidYtdTotal     = paidYtd.reduce((s, f) => s + (f.amount ?? 0), 0);
  const invoicedYtdTotal = invoicedYtd.reduce((s, f) => s + (f.amount ?? 0), 0);
  const pendingTotal     = pending.reduce((s, f) => s + (f.amount ?? 0), 0);
  const pipelineTotal    = allMandates.reduce((s, m) => s + (m.estimated_fee_amount ?? 0), 0);

  // Projection linéaire : extrapolation sur le reste de l'année
  const dayOfYear   = Math.floor((Date.now() - new Date(yearStart).getTime()) / 86400000);
  const projection  = dayOfYear > 0 ? Math.round(paidYtdTotal / dayOfYear * 365) : 0;

  // ── Deals ────────────────────────────────────────────────────────────────
  const openDeals  = allDeals.filter(d => d.deal_status === "open");
  const wonDeals   = allDeals.filter(d => d.deal_status === "won");
  const lostDeals  = allDeals.filter(d => d.deal_status === "lost");
  const closedAll  = wonDeals.length + lostDeals.length;
  const winRate    = pct(wonDeals.length, closedAll);

  // Par deal_type
  const dealTypes = Array.from(new Set(allDeals.map(d => d.deal_type))).sort();
  const statsByType = dealTypes.map(type => {
    const group = allDeals.filter(d => d.deal_type === type);
    const open  = group.filter(d => d.deal_status === "open").length;
    const won   = group.filter(d => d.deal_status === "won").length;
    const lost  = group.filter(d => d.deal_status === "lost").length;
    const total = group.length;
    const mandate = allMandates.filter(m => m.type === type);
    const feesPipeline = mandate.reduce((s, m) => s + (m.estimated_fee_amount ?? 0), 0);
    const feesConfirmed = mandate.reduce((s, m) => s + (m.confirmed_fee_amount ?? 0), 0);
    return { type, total, open, won, lost, winRate: pct(won, won + lost), feesPipeline, feesConfirmed };
  });

  // ── Mandats ──────────────────────────────────────────────────────────────
  const activeMandates = allMandates.filter(m => m.status === "active").length;
  const wonMandates    = allMandates.filter(m => m.status === "won").length;
  const confirmedTotal = allMandates.reduce((s, m) => s + (m.confirmed_fee_amount ?? 0), 0);

  // ── Recrutement ──────────────────────────────────────────────────────────
  const placed       = allCandidates.filter((c: any) => c.candidate_status === "placed");
  const searching    = allCandidates.filter((c: any) => c.candidate_status === "searching").length;
  const inProcess    = allCandidates.filter((c: any) => c.candidate_status === "in_process").length;
  const placedYtd    = placed.filter((c: any) => c.updated_at?.startsWith(String(year))).length;
  const convRate     = pct(placed.length, allCandidates.length);
  const rhDeals      = allDeals.filter(d => d.deal_type === "recruitment");
  const rhOpen       = rhDeals.filter(d => d.deal_status === "open").length;

  // ── Fundraising pipeline ────────────────────────────────────────────────
  const fundDeals      = allDeals.filter(d => d.deal_type === "fundraising" && d.deal_status === "open");
  const fundPipeline   = fundDeals.reduce((s, d) => s + (d.target_amount ?? 0), 0);
  const fundCommitted  = fundDeals.reduce((s, d) => s + (d.committed_amount ?? 0), 0);

  // ── Stages pipeline ──────────────────────────────────────────────────────
  const stageOrder = ["kickoff","preparation","outreach","management_meetings","dd","negotiation","closing"];
  const stageLabels: Record<string, string> = {
    kickoff:"Kickoff", preparation:"Préparation", outreach:"Prospection",
    management_meetings:"Meetings", dd:"Due diligence", negotiation:"Négociation", closing:"Closing",
  };
  const byStage = stageOrder.map(stage => ({
    stage,
    label: stageLabels[stage] ?? stage,
    count: openDeals.filter(d => d.deal_stage === stage).length,
  })).filter(s => s.count > 0);
  const maxStageCount = Math.max(...byStage.map(s => s.count), 1);

  // ── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".1em", marginBottom: 14,
  };
  const kpiVal: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.1 };
  const kpiLbl: React.CSSProperties = { fontSize: 12, color: "var(--text-4)", marginTop: 4 };

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Statistiques cabinet</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-4)" }}>Performance {year} — toutes missions</p>
        </div>

        {/* ── Revenue KPIs ────────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sectionTitle}>Honoraires {year}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <div>
              <div style={{ ...kpiVal, color: "#065F46" }}>{fmtAmt(paidYtdTotal)}</div>
              <div style={kpiLbl}>Encaissé YTD</div>
            </div>
            <div>
              <div style={{ ...kpiVal, color: "#1D4ED8" }}>{fmtAmt(invoicedYtdTotal)}</div>
              <div style={kpiLbl}>Facturé en attente</div>
            </div>
            <div>
              <div style={{ ...kpiVal, color: "#92400E" }}>{fmtAmt(pendingTotal)}</div>
              <div style={kpiLbl}>Pipeline jalons</div>
            </div>
            <div>
              <div style={{ ...kpiVal, color: "var(--text-3)" }}>{fmtAmt(projection)}</div>
              <div style={kpiLbl}>Projection annuelle (extrapolée)</div>
            </div>
          </div>

          {/* Barre de progression encaissé vs pipeline total */}
          {pipelineTotal > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-4)", marginBottom: 6 }}>
                <span>Réalisé vs pipeline estimé mandats ({fmtAmt(pipelineTotal)})</span>
                <span style={{ fontWeight: 600 }}>{fmtPct(pct(confirmedTotal, pipelineTotal))}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 4, background: "#065F46", width: `${Math.min(pct(confirmedTotal, pipelineTotal), 100)}%`, transition: "width .3s" }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

          {/* ── Dossiers globaux ───────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Dossiers</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={kpiVal}>{openDeals.length}</div>
                <div style={kpiLbl}>En cours</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#065F46" }}>{wonDeals.length}</div>
                <div style={kpiLbl}>Gagnés</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#991B1B" }}>{lostDeals.length}</div>
                <div style={kpiLbl}>Perdus</div>
              </div>
            </div>
            {closedAll > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "#065F46", width: `${winRate}%` }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46", flexShrink: 0 }}>
                  {winRate}% win rate
                </span>
              </div>
            )}
          </div>

          {/* ── Mandats ────────────────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Mandats</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={kpiVal}>{activeMandates}</div>
                <div style={kpiLbl}>Actifs</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#065F46" }}>{wonMandates}</div>
                <div style={kpiLbl}>Gagnés</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#1D4ED8" }}>{allMandates.length}</div>
                <div style={kpiLbl}>Total</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-4)" }}>
              Encaissé total : <strong style={{ color: "var(--text-1)" }}>{fmtAmt(confirmedTotal)}</strong>
            </div>
          </div>
        </div>

        {/* ── Pipeline par stade ─────────────────────────────────────────── */}
        {byStage.length > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={sectionTitle}>Pipeline actif par stade</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byStage.map(({ stage, label, count }) => (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", minWidth: 140, flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1, height: 20, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", borderRadius: 6, background: "var(--accent,#1a56db)", width: `${Math.round(count / maxStageCount * 100)}%`, opacity: 0.8 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", minWidth: 28, textAlign: "right", flexShrink: 0 }}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats par deal_type ────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sectionTitle}>Performance par métier</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "180px repeat(5,1fr)", gap: 10, padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>
              <div>Type</div>
              <div style={{ textAlign: "right" }}>Total</div>
              <div style={{ textAlign: "right" }}>En cours</div>
              <div style={{ textAlign: "right" }}>Gagnés</div>
              <div style={{ textAlign: "right" }}>Win rate</div>
              <div style={{ textAlign: "right" }}>Fees pipeline</div>
            </div>
            {statsByType.length === 0 ? (
              <div style={{ padding: "20px 10px", fontSize: 13, color: "var(--text-5)", textAlign: "center" }}>Aucun dossier</div>
            ) : statsByType.map(s => {
              const tc = TYPE_COLORS[s.type] ?? { bg: "var(--surface-2)", tx: "var(--text-3)" };
              return (
                <div key={s.type} style={{ display: "grid", gridTemplateColumns: "180px repeat(5,1fr)", gap: 10, padding: "10px 10px", borderRadius: 8, background: "var(--surface-2)", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: tc.bg, color: tc.tx, width: "fit-content" }}>
                    {TYPE_LABELS[s.type] ?? s.type}
                  </span>
                  <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{s.total}</div>
                  <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-3)" }}>{s.open}</div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#065F46" }}>{s.won}</div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: s.winRate >= 50 ? "#065F46" : s.winRate >= 25 ? "#92400E" : "var(--text-3)" }}>
                    {s.won + s.lost > 0 ? `${s.winRate}%` : "—"}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 13, color: "#1D4ED8", fontWeight: 600 }}>
                    {s.feesPipeline > 0 ? fmtAmt(s.feesPipeline) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* ── Recrutement ────────────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Recrutement</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ ...kpiVal, color: "#7E22CE" }}>{placedYtd}</div>
                <div style={kpiLbl}>Placements {year}</div>
              </div>
              <div>
                <div style={kpiVal}>{inProcess}</div>
                <div style={kpiLbl}>En process</div>
              </div>
              <div>
                <div style={kpiVal}>{searching}</div>
                <div style={kpiLbl}>Vivier actif</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: placed.length > 0 ? "#7E22CE" : "var(--text-3)" }}>
                  {allCandidates.length > 0 ? `${convRate}%` : "—"}
                </div>
                <div style={kpiLbl}>Taux conversion global</div>
              </div>
            </div>
            {rhOpen > 0 && (
              <div style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "#FDF4FF", color: "#7E22CE" }}>
                {rhOpen} mission{rhOpen > 1 ? "s" : ""} de recrutement active{rhOpen > 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* ── Fundraising ────────────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Fundraising</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={kpiVal}>{fundDeals.length}</div>
                <div style={kpiLbl}>Rounds actifs</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#1D4ED8" }}>{fmtAmt(fundPipeline)}</div>
                <div style={kpiLbl}>Levées cibles</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: "#065F46" }}>{fmtAmt(fundCommitted)}</div>
                <div style={kpiLbl}>Engagements reçus</div>
              </div>
              <div>
                <div style={{ ...kpiVal, color: fundPipeline > 0 ? "#065F46" : "var(--text-3)" }}>
                  {fundPipeline > 0 ? `${pct(fundCommitted, fundPipeline)}%` : "—"}
                </div>
                <div style={kpiLbl}>Taux couverture</div>
              </div>
            </div>
            {fundPipeline > 0 && (
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "#1D4ED8", width: `${Math.min(pct(fundCommitted, fundPipeline), 100)}%` }} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function StatistiquesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content />
    </Suspense>
  );
}
