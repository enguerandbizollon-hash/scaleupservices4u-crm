import { Suspense } from "react";
import Link from "next/link";
import { getAllMandates } from "@/actions/mandates";
import { getFeesKpis } from "@/actions/fees";
import { Plus } from "lucide-react";
import { ExportCSVButton, type ExportRow } from "@/components/exports/export-csv-button";

const TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell", ma_buy: "M&A Buy",
  cfo_advisor: "CFO Advisory", recruitment: "Recrutement",
};
const TYPE_COLORS: Record<string, { bg: string; tx: string }> = {
  fundraising: { bg: "var(--fund-bg)", tx: "var(--fund-tx)" },
  ma_sell:     { bg: "var(--sell-bg)", tx: "var(--sell-tx)" },
  ma_buy:      { bg: "var(--buy-bg)",  tx: "var(--buy-tx)"  },
  cfo_advisor: { bg: "var(--cfo-bg)",  tx: "var(--cfo-tx)"  },
  recruitment: { bg: "var(--rec-bg)",  tx: "var(--rec-tx)"  },
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", active: "Actif", on_hold: "En pause",
  won: "Gagné", lost: "Perdu", closed: "Clôturé",
};
const STATUS_COLORS: Record<string, { bg: string; tx: string; bar: string }> = {
  draft:   { bg: "var(--surface-3)", tx: "var(--text-5)",  bar: "#9CA3AF" },
  active:  { bg: "#D1FAE5",          tx: "#065F46",         bar: "#10B981" },
  on_hold: { bg: "#FEF3C7",          tx: "#92400E",         bar: "#F59E0B" },
  won:     { bg: "#DBEAFE",          tx: "#1D4ED8",         bar: "#3B82F6" },
  lost:    { bg: "#FEE2E2",          tx: "#991B1B",         bar: "#EF4444" },
  closed:  { bg: "var(--surface-3)", tx: "var(--text-4)",   bar: "#6B7280" },
};
const PRIORITY_DOT: Record<string, string> = {
  high: "#EF4444", medium: "#F59E0B", low: "#6B7280",
};

function fmtAmt(n: number | null | undefined, currency = "EUR") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M ${currency}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} k ${currency}`;
  return `${n} ${currency}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}
function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

async function Content() {
  const [mandates, kpis] = await Promise.all([getAllMandates(), getFeesKpis()]);

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const total   = mandates.length;
  const active  = mandates.filter(m => m.status === "active").length;
  const won     = mandates.filter(m => m.status === "won").length;
  const lost    = mandates.filter(m => m.status === "lost").length;
  const closed  = mandates.filter(m => ["won","lost","closed"].includes(m.status)).length;
  const winRate = pct(won, closed);
  const pipeline = mandates
    .filter(m => ["draft","active","on_hold"].includes(m.status))
    .reduce((s, m) => s + (m.estimated_fee_amount ?? 0), 0);
  const confirmedTotal = mandates.reduce((s, m) => s + ((m as any).confirmed_fee_amount ?? 0), 0);

  // ── Performance par type ──────────────────────────────────────────────────
  const types = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const byType = types.map(t => {
    const rows = mandates.filter(m => m.type === t);
    const tWon   = rows.filter(m => m.status === "won").length;
    const tClosed = rows.filter(m => ["won","lost","closed"].includes(m.status)).length;
    const tPipeline = rows
      .filter(m => ["draft","active","on_hold"].includes(m.status))
      .reduce((s, m) => s + (m.estimated_fee_amount ?? 0), 0);
    return {
      type: t,
      total: rows.length,
      active: rows.filter(m => m.status === "active").length,
      won: tWon,
      winRate: pct(tWon, tClosed),
      pipeline: tPipeline,
    };
  }).filter(r => r.total > 0);

  // ── Répartition par statut ────────────────────────────────────────────────
  const statusCounts = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    key, label,
    count: mandates.filter(m => m.status === key).length,
  })).filter(s => s.count > 0);

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Mandats</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-4)" }}>
              Relations commerciales et honoraires
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ExportCSVButton
              filenamePrefix="mandats"
              rows={mandates.map<ExportRow>(m => ({
                "Nom": m.name,
                "Type": TYPE_LABELS[m.type] ?? m.type,
                "Statut": STATUS_LABELS[m.status] ?? m.status,
                "Priorité": m.priority ?? "",
                "Client": m.client_name ?? "",
                "Honoraires estimés": m.estimated_fee_amount ?? "",
                "Honoraires confirmés": (m as { confirmed_fee_amount?: number | null }).confirmed_fee_amount ?? "",
                "Devise": m.currency ?? "EUR",
                "Date de début": m.start_date ?? "",
                "Date cible closing": m.target_close_date ?? "",
              }))}
              columns={[
                { key: "Nom", label: "Nom" },
                { key: "Type", label: "Type" },
                { key: "Statut", label: "Statut" },
                { key: "Priorité", label: "Priorité" },
                { key: "Client", label: "Client" },
                { key: "Honoraires estimés", label: "Honoraires estimés" },
                { key: "Honoraires confirmés", label: "Honoraires confirmés" },
                { key: "Devise", label: "Devise" },
                { key: "Date de début", label: "Date de début" },
                { key: "Date cible closing", label: "Date cible closing" },
              ]}
            />
            <Link href="/protected/mandats/nouveau" style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 10,
              background: "var(--text-1)", color: "var(--bg)",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              <Plus size={14} /> Nouveau mandat
            </Link>
          </div>
        </div>

        {/* KPIs — ligne 1 : volume */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
          {[
            { label: "Total mandats",   value: String(total),   sub: `${active} actifs`,          bg: "var(--surface)" },
            { label: "Gagnés",          value: String(won),     sub: `${lost} perdus`,             bg: "var(--surface)" },
            { label: "Taux de succès",  value: `${winRate} %`,  sub: `sur ${closed} clôturés`,    bg: winRate >= 50 ? "#ECFDF5" : "var(--surface)", tx: winRate >= 50 ? "#065F46" : "var(--text-1)" },
            { label: "En pause",        value: String(mandates.filter(m => m.status === "on_hold").length), sub: "on hold", bg: mandates.filter(m => m.status === "on_hold").length > 0 ? "#FEF9C3" : "var(--surface)" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: (k as any).tx ?? "var(--text-1)" }}>{k.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* KPIs — ligne 2 : financier */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Pipeline estimé",    value: fmtAmt(pipeline, "EUR"),          sub: "mandats ouverts",       bg: "#EFF6FF", tx: "#1D4ED8" },
            { label: "Encaissé YTD",       value: fmtAmt(kpis.paid_ytd, "EUR"),     sub: "jalons payés cette année", bg: "#ECFDF5", tx: "#065F46" },
            { label: "Facturé en attente", value: fmtAmt(kpis.invoiced, "EUR"),      sub: "en attente de règlement",  bg: "#FFFBEB", tx: "#92400E" },
            { label: "Confirmé total",     value: fmtAmt(confirmedTotal, "EUR"),     sub: "tous mandats cumulés",     bg: "var(--surface)" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: (k as any).tx ?? "var(--text-1)" }}>{k.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Performance par type */}
        {byType.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginBottom: 14 }}>Performance par métier</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Métier","Total","Actifs","Gagnés","Win rate","Pipeline fees"].map(h => (
                    <th key={h} style={{ textAlign: h === "Métier" ? "left" : "right", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byType.map(r => {
                  const tc = TYPE_COLORS[r.type] ?? { bg: "var(--surface-3)", tx: "var(--text-4)" };
                  return (
                    <tr key={r.type} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: tc.bg, color: tc.tx }}>
                          {TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 10px", color: "var(--text-2)", fontWeight: 600 }}>{r.total}</td>
                      <td style={{ textAlign: "right", padding: "10px 10px", color: "#10B981", fontWeight: 600 }}>{r.active}</td>
                      <td style={{ textAlign: "right", padding: "10px 10px", color: "#3B82F6", fontWeight: 600 }}>{r.won}</td>
                      <td style={{ textAlign: "right", padding: "10px 10px" }}>
                        <span style={{ fontWeight: 700, color: r.winRate >= 50 ? "#059669" : r.winRate > 0 ? "#D97706" : "var(--text-5)" }}>
                          {r.total === 0 ? "—" : `${r.winRate} %`}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 10px", fontWeight: 700, color: "#1D4ED8" }}>{fmtAmt(r.pipeline, "EUR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Répartition par statut */}
        {statusCounts.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginBottom: 12 }}>Répartition par statut</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {statusCounts.map(s => {
                const sc = STATUS_COLORS[s.key] ?? STATUS_COLORS.draft;
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: sc.bg, border: `1px solid ${sc.bar}30` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: sc.tx }}>{s.count}</span>
                    <span style={{ fontSize: 11, color: sc.tx }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            {/* barre proportionnelle */}
            <div style={{ display: "flex", height: 6, borderRadius: 6, overflow: "hidden", gap: 1 }}>
              {statusCounts.map(s => (
                <div key={s.key} style={{
                  flex: s.count,
                  background: (STATUS_COLORS[s.key] ?? STATUS_COLORS.draft).bar,
                  transition: "flex .3s",
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Liste */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, padding: "0 4px" }}>
          Tous les mandats ({total})
        </div>
        {mandates.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Aucun mandat</div>
            <div style={{ fontSize: 13, color: "var(--text-5)", marginBottom: 20 }}>
              Créez votre premier mandat pour formaliser une relation commerciale.
            </div>
            <Link href="/protected/mandats/nouveau" style={{
              padding: "10px 20px", borderRadius: 10, background: "var(--text-1)", color: "var(--bg)",
              textDecoration: "none", fontSize: 13, fontWeight: 700,
            }}>
              Créer un mandat
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mandates.map(m => {
              const tc = TYPE_COLORS[m.type]  ?? { bg: "var(--surface-3)", tx: "var(--text-4)" };
              const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.draft;
              return (
                <Link key={m.id} href={`/protected/mandats/${m.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_DOT[m.priority ?? "medium"], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: tc.bg, color: tc.tx, flexShrink: 0 }}>
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 2 }}>{m.name}</div>
                      {m.client_name && (
                        <div style={{ fontSize: 12, color: "var(--text-4)" }}>{m.client_name}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-5)", textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                      {m.target_close_date ? <>🎯 {fmtDate(m.target_close_date)}</> : m.start_date ? <>📅 {fmtDate(m.start_date)}</> : "—"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textAlign: "right", flexShrink: 0, minWidth: 100 }}>
                      {fmtAmt(m.estimated_fee_amount, m.currency ?? "EUR")}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.tx, flexShrink: 0 }}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MandatsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content />
    </Suspense>
  );
}
