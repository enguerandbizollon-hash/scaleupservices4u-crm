"use client";
import { useState, useCallback } from "react";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { upsertFinancialData, getFinancialDataByDeal, getFinancialDataByOrganization, deleteFinancialData } from "@/actions/financial-data";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FinancialRow {
  id: string;
  fiscal_year: number;
  period_type: string;
  currency: string;
  source?: string | null;
  ai_extracted?: boolean;
  // P&L
  revenue?: number | null;
  gross_profit?: number | null;
  gross_margin?: number | null;
  ebitda?: number | null;
  ebitda_margin?: number | null;
  ebit?: number | null;
  net_income?: number | null;
  // Bilan
  total_assets?: number | null;
  net_debt?: number | null;
  equity?: number | null;
  cash?: number | null;
  capex?: number | null;
  working_capital?: number | null;
  // Opérationnel
  headcount?: number | null;
  revenue_per_employee?: number | null;
  // SaaS
  arr?: number | null;
  mrr?: number | null;
  nrr?: number | null;
  grr?: number | null;
  churn_rate?: number | null;
  cagr?: number | null;
  ltv?: number | null;
  cac?: number | null;
  ltv_cac_ratio?: number | null;
  payback_months?: number | null;
  // Valorisation
  ev_estimate?: number | null;
  ev_ebitda_multiple?: number | null;
  ev_revenue_multiple?: number | null;
  ev_arr_multiple?: number | null;
  equity_value?: number | null;
}

interface Props {
  dealId?: string;
  organizationId?: string;
  dealType?: string;
  initialData: FinancialRow[];
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtM(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)} k€`;
  return `${v} €`;
}
function fmtPct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function fmtInt(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("fr-FR");
}
function fmtX(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}x`;
}

function varPct(n: number | null | undefined, n1: number | null | undefined): { text: string; positive: boolean } | null {
  if (n == null || n1 == null || n1 === 0) return null;
  const pct = (n - n1) / Math.abs(n1) * 100;
  return { text: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%", positive: pct >= 0 };
}
function varPp(n: number | null | undefined, n1: number | null | undefined): { text: string; positive: boolean } | null {
  if (n == null || n1 == null) return null;
  const pp = n - n1;
  return { text: (pp >= 0 ? "+" : "") + pp.toFixed(1) + "pp", positive: pp >= 0 };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid var(--border)",
  borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none",
  background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box",
};
const sel: React.CSSProperties = { ...inp };
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-4)", marginBottom: 4,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
  letterSpacing: ".07em", marginBottom: 10, paddingTop: 6,
};
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

// ── Variation badge ──────────────────────────────────────────────────────────

function VarBadge({ v, invertColor = false }: { v: ReturnType<typeof varPct>; invertColor?: boolean }) {
  if (!v) return <span style={{ fontSize: 11, color: "var(--text-5)" }}>—</span>;
  const positive = invertColor ? !v.positive : v.positive;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
      background: positive ? "#D1FAE5" : "#FEE2E2",
      color: positive ? "#065F46" : "#991B1B",
    }}>
      {v.text}
    </span>
  );
}

// ── Row in table ──────────────────────────────────────────────────────────────

function MetricRow({
  label, n, n1, n2, delta, invertColor = false,
}: {
  label: string;
  n: string; n1: string; n2: string;
  delta: ReturnType<typeof varPct>;
  invertColor?: boolean;
}) {
  return (
    <tr>
      <td style={{ padding: "7px 12px", fontSize: 12.5, color: "var(--text-3)", fontWeight: 500, borderRight: "1px solid var(--border)" }}>
        {label}
      </td>
      <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-1)", textAlign: "right" }}>{n}</td>
      <td style={{ padding: "7px 12px", fontSize: 12.5, color: "var(--text-3)", textAlign: "right" }}>{n1}</td>
      <td style={{ padding: "7px 12px", fontSize: 12.5, color: "var(--text-3)", textAlign: "right" }}>{n2}</td>
      <td style={{ padding: "7px 12px", textAlign: "right" }}>
        <VarBadge v={delta} invertColor={invertColor} />
      </td>
    </tr>
  );
}

// ── Form fields helper ────────────────────────────────────────────────────────

function Field({ label, name, value, onChange, type = "number" }: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input
        type={type}
        style={inp}
        value={value}
        placeholder="—"
        onChange={e => onChange(name, e.target.value)}
      />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
        Aucune donnée financière
      </div>
      <div style={{ fontSize: 13, color: "var(--text-5)", marginBottom: 16 }}>
        Saisissez manuellement les données historiques N / N-1 / N-2
      </div>
      <button
        onClick={onAdd}
        style={{ padding: "8px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
      >
        + Ajouter un exercice
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

type FormState = Record<string, string>;

function emptyForm(year?: number): FormState {
  return { fiscal_year: String(year ?? CURRENT_YEAR), currency: "EUR", period_type: "annual" };
}

function rowToForm(r: FinancialRow): FormState {
  const keys: (keyof FinancialRow)[] = [
    "fiscal_year","currency","period_type",
    "revenue","gross_profit","gross_margin","ebitda","ebitda_margin","ebit","net_income",
    "total_assets","net_debt","equity","cash","capex","working_capital",
    "headcount","revenue_per_employee",
    "arr","mrr","nrr","grr","churn_rate","cagr","ltv","cac","ltv_cac_ratio","payback_months",
    "ev_estimate","ev_ebitda_multiple","ev_revenue_multiple","ev_arr_multiple","equity_value",
  ];
  const f: FormState = {};
  for (const k of keys) {
    const v = r[k];
    f[k] = v != null ? String(v) : "";
  }
  return f;
}

export function FinancialTab({ dealId, organizationId, dealType = "", initialData }: Props) {
  const [rows, setRows] = useState<FinancialRow[]>(
    [...initialData].sort((a, b) => b.fiscal_year - a.fiscal_year)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaaS, setShowSaaS] = useState(false);
  const [showValorisation, setShowValorisation] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isFundraising = dealType === "fundraising";
  const hasSaas = rows.some(r => r.arr || r.mrr);

  function setField(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function openAdd() {
    const nextYear = rows.length > 0 ? rows[0].fiscal_year - 1 : CURRENT_YEAR;
    setForm(emptyForm(nextYear));
    setEditingId(null);
    setError(null);
    setShowSaaS(isFundraising);
    setModalOpen(true);
  }

  function openEdit(row: FinancialRow) {
    setForm(rowToForm(row));
    setEditingId(row.id);
    setError(null);
    setShowSaaS(!!(row.arr || row.mrr));
    setShowValorisation(!!(row.ev_estimate || row.ev_ebitda_multiple));
    setModalOpen(true);
  }

  function num(k: string): number | undefined {
    const v = form[k];
    if (!v || v.trim() === "") return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  async function handleSave() {
    if (!form.fiscal_year) { setError("L'exercice est obligatoire"); return; }
    setSaving(true);
    setError(null);
    try {
      await upsertFinancialData({
        deal_id:         dealId         || undefined,
        organization_id: organizationId || undefined,
        source:          "manual",
        fiscal_year:  parseInt(form.fiscal_year),
        period_type:  form.period_type || "annual",
        currency:     form.currency || "EUR",
        revenue:              num("revenue"),
        gross_profit:         num("gross_profit"),
        gross_margin:         num("gross_margin"),
        ebitda:               num("ebitda"),
        ebitda_margin:        num("ebitda_margin"),
        ebit:                 num("ebit"),
        net_income:           num("net_income"),
        total_assets:         num("total_assets"),
        net_debt:             num("net_debt"),
        equity:               num("equity"),
        cash:                 num("cash"),
        capex:                num("capex"),
        working_capital:      num("working_capital"),
        headcount:            num("headcount"),
        revenue_per_employee: num("revenue_per_employee"),
        arr:          num("arr"),
        mrr:          num("mrr"),
        nrr:          num("nrr"),
        grr:          num("grr"),
        churn_rate:   num("churn_rate"),
        cagr:         num("cagr"),
        ltv:          num("ltv"),
        cac:          num("cac"),
        ltv_cac_ratio: num("ltv_cac_ratio"),
        payback_months: num("payback_months"),
        ev_estimate:          num("ev_estimate"),
        ev_ebitda_multiple:   num("ev_ebitda_multiple"),
        ev_revenue_multiple:  num("ev_revenue_multiple"),
        ev_arr_multiple:      num("ev_arr_multiple"),
        equity_value:         num("equity_value"),
      });
      // Reload
      const refreshed = dealId
        ? await getFinancialDataByDeal(dealId)
        : await getFinancialDataByOrganization(organizationId!);
      setRows([...(refreshed as FinancialRow[])].sort((a, b) => b.fiscal_year - a.fiscal_year));
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteFinancialData(id);
      setRows(r => r.filter(x => x.id !== id));
    } catch {}
    setDeletingId(null);
  }

  // N, N-1, N-2
  const [n, n1, n2] = [rows[0], rows[1], rows[2]];

  return (
    <div style={{ padding: "20px 0" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Données financières</span>
          {rows.length > 0 && (
            <span style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600 }}>
              {rows.length} exercice{rows.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <button
            onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus size={13} /> Exercice
          </button>
        )}
      </div>

      {/* Empty state */}
      {rows.length === 0 && <EmptyState onAdd={openAdd} />}

      {/* Tableau N / N-1 / N-2 */}
      {rows.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".06em", borderRight: "1px solid var(--border)", minWidth: 140 }}>
                  Indicateur
                </th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--text-1)" }}>
                  {n ? `${n.fiscal_year} (N)` : "—"}
                </th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11.5, fontWeight: 600, color: "var(--text-3)" }}>
                  {n1 ? `${n1.fiscal_year} (N-1)` : "—"}
                </th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11.5, fontWeight: 600, color: "var(--text-3)" }}>
                  {n2 ? `${n2.fiscal_year} (N-2)` : "—"}
                </th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Δ N/N-1
                </th>
              </tr>
            </thead>
            <tbody>
              {/* P&L */}
              <tr style={{ background: "var(--surface-2)" }}>
                <td colSpan={5} style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", borderRight: "1px solid var(--border)" }}>
                  Compte de résultat
                </td>
              </tr>
              <MetricRow label="Chiffre d'affaires" n={fmtM(n?.revenue)} n1={fmtM(n1?.revenue)} n2={fmtM(n2?.revenue)} delta={varPct(n?.revenue, n1?.revenue)} />
              {(n?.gross_margin || n1?.gross_margin) && (
                <MetricRow label="Marge brute" n={fmtPct(n?.gross_margin)} n1={fmtPct(n1?.gross_margin)} n2={fmtPct(n2?.gross_margin)} delta={varPp(n?.gross_margin, n1?.gross_margin)} />
              )}
              {(n?.ebitda || n1?.ebitda) && (
                <MetricRow label="EBITDA" n={fmtM(n?.ebitda)} n1={fmtM(n1?.ebitda)} n2={fmtM(n2?.ebitda)} delta={varPct(n?.ebitda, n1?.ebitda)} />
              )}
              {(n?.ebitda_margin || n1?.ebitda_margin) && (
                <MetricRow label="Marge EBITDA" n={fmtPct(n?.ebitda_margin)} n1={fmtPct(n1?.ebitda_margin)} n2={fmtPct(n2?.ebitda_margin)} delta={varPp(n?.ebitda_margin, n1?.ebitda_margin)} />
              )}
              {(n?.net_income || n1?.net_income) && (
                <MetricRow label="Résultat net" n={fmtM(n?.net_income)} n1={fmtM(n1?.net_income)} n2={fmtM(n2?.net_income)} delta={varPct(n?.net_income, n1?.net_income)} />
              )}

              {/* Opérationnel */}
              {(n?.headcount || n1?.headcount) && (
                <>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={5} style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", borderRight: "1px solid var(--border)" }}>
                      Opérationnel
                    </td>
                  </tr>
                  <MetricRow label="Effectifs" n={fmtInt(n?.headcount)} n1={fmtInt(n1?.headcount)} n2={fmtInt(n2?.headcount)} delta={varPct(n?.headcount, n1?.headcount)} />
                </>
              )}

              {/* Bilan */}
              {(n?.net_debt || n1?.net_debt || n?.equity || n1?.equity || n?.cash || n1?.cash) && (
                <>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={5} style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", borderRight: "1px solid var(--border)" }}>
                      Bilan
                    </td>
                  </tr>
                  {(n?.net_debt || n1?.net_debt) && (
                    <MetricRow label="Dette nette" n={fmtM(n?.net_debt)} n1={fmtM(n1?.net_debt)} n2={fmtM(n2?.net_debt)} delta={varPct(n?.net_debt, n1?.net_debt)} invertColor />
                  )}
                  {(n?.equity || n1?.equity) && (
                    <MetricRow label="Capitaux propres" n={fmtM(n?.equity)} n1={fmtM(n1?.equity)} n2={fmtM(n2?.equity)} delta={varPct(n?.equity, n1?.equity)} />
                  )}
                  {(n?.cash || n1?.cash) && (
                    <MetricRow label="Trésorerie" n={fmtM(n?.cash)} n1={fmtM(n1?.cash)} n2={fmtM(n2?.cash)} delta={varPct(n?.cash, n1?.cash)} />
                  )}
                </>
              )}

              {/* SaaS */}
              {hasSaas && (
                <>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={5} style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", borderRight: "1px solid var(--border)" }}>
                      Métriques SaaS
                    </td>
                  </tr>
                  {(n?.arr || n1?.arr) && (
                    <MetricRow label="ARR" n={fmtM(n?.arr)} n1={fmtM(n1?.arr)} n2={fmtM(n2?.arr)} delta={varPct(n?.arr, n1?.arr)} />
                  )}
                  {(n?.mrr || n1?.mrr) && (
                    <MetricRow label="MRR" n={fmtM(n?.mrr)} n1={fmtM(n1?.mrr)} n2={fmtM(n2?.mrr)} delta={varPct(n?.mrr, n1?.mrr)} />
                  )}
                  {(n?.nrr || n1?.nrr) && (
                    <MetricRow label="NRR" n={fmtPct(n?.nrr)} n1={fmtPct(n1?.nrr)} n2={fmtPct(n2?.nrr)} delta={varPp(n?.nrr, n1?.nrr)} />
                  )}
                  {(n?.churn_rate || n1?.churn_rate) && (
                    <MetricRow label="Churn" n={fmtPct(n?.churn_rate)} n1={fmtPct(n1?.churn_rate)} n2={fmtPct(n2?.churn_rate)} delta={varPp(n?.churn_rate, n1?.churn_rate)} invertColor />
                  )}
                  {(n?.ltv_cac_ratio || n1?.ltv_cac_ratio) && (
                    <MetricRow label="LTV/CAC" n={fmtX(n?.ltv_cac_ratio)} n1={fmtX(n1?.ltv_cac_ratio)} n2={fmtX(n2?.ltv_cac_ratio)} delta={varPct(n?.ltv_cac_ratio, n1?.ltv_cac_ratio)} />
                  )}
                </>
              )}

              {/* Valorisation */}
              {(n?.ev_estimate || n1?.ev_estimate) && (
                <>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td colSpan={5} style={{ padding: "4px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", borderRight: "1px solid var(--border)" }}>
                      Valorisation
                    </td>
                  </tr>
                  <MetricRow label="Valeur d'entreprise" n={fmtM(n?.ev_estimate)} n1={fmtM(n1?.ev_estimate)} n2={fmtM(n2?.ev_estimate)} delta={varPct(n?.ev_estimate, n1?.ev_estimate)} />
                  {(n?.ev_ebitda_multiple || n1?.ev_ebitda_multiple) && (
                    <MetricRow label="Multiple EV/EBITDA" n={fmtX(n?.ev_ebitda_multiple)} n1={fmtX(n1?.ev_ebitda_multiple)} n2={fmtX(n2?.ev_ebitda_multiple)} delta={varPct(n?.ev_ebitda_multiple, n1?.ev_ebitda_multiple)} />
                  )}
                  {(n?.ev_arr_multiple || n1?.ev_arr_multiple) && (
                    <MetricRow label="Multiple EV/ARR" n={fmtX(n?.ev_arr_multiple)} n1={fmtX(n1?.ev_arr_multiple)} n2={fmtX(n2?.ev_arr_multiple)} delta={varPct(n?.ev_arr_multiple, n1?.ev_arr_multiple)} />
                  )}
                </>
              )}
            </tbody>
          </table>

          {/* Actions sur les années */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {rows.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{r.fiscal_year}</span>
                {r.source && r.source !== "manual" && (
                  <span style={{ fontSize: 10, color: "var(--text-5)" }}>· {r.source}</span>
                )}
                {r.ai_extracted && (
                  <span style={{ fontSize: 10, color: "#7C3AED" }}>· IA</span>
                )}
                <button
                  onClick={() => openEdit(r)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-4)", padding: "0 2px", lineHeight: 1 }}
                  title="Modifier"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#DC2626", padding: "0 2px", lineHeight: 1 }}
                  title="Supprimer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>

            {/* Header modale */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>
                {editingId ? "Modifier l'exercice" : "Nouvel exercice"}
              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)" }}>
                <X size={16} />
              </button>
            </div>

            {/* Exercice */}
            <div style={{ ...grid3, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Exercice *</label>
                <input type="number" style={inp} min={1900} max={2100} value={form.fiscal_year} onChange={e => setField("fiscal_year", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Devise</label>
                <select style={sel} value={form.currency} onChange={e => setField("currency", e.target.value)}>
                  {["EUR","CHF","USD","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Période</label>
                <select style={sel} value={form.period_type} onChange={e => setField("period_type", e.target.value)}>
                  <option value="annual">Annuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            </div>

            {/* P&L */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Compte de résultat</div>
            <div style={{ ...grid3, marginBottom: 6 }}>
              <Field label="CA (€)" name="revenue" value={form.revenue ?? ""} onChange={setField} />
              <Field label="Marge brute (%)" name="gross_margin" value={form.gross_margin ?? ""} onChange={setField} />
              <Field label="EBITDA (€)" name="ebitda" value={form.ebitda ?? ""} onChange={setField} />
            </div>
            <div style={{ ...grid3, marginBottom: 16 }}>
              <Field label="Marge EBITDA (%)" name="ebitda_margin" value={form.ebitda_margin ?? ""} onChange={setField} />
              <Field label="EBIT (€)" name="ebit" value={form.ebit ?? ""} onChange={setField} />
              <Field label="Résultat net (€)" name="net_income" value={form.net_income ?? ""} onChange={setField} />
            </div>

            {/* Opérationnel */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Opérationnel</div>
            <div style={{ ...grid2, marginBottom: 16 }}>
              <Field label="Effectifs" name="headcount" value={form.headcount ?? ""} onChange={setField} />
              <Field label="CA / collaborateur (€)" name="revenue_per_employee" value={form.revenue_per_employee ?? ""} onChange={setField} />
            </div>

            {/* Bilan */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Bilan</div>
            <div style={{ ...grid3, marginBottom: 16 }}>
              <Field label="Dette nette (€)" name="net_debt" value={form.net_debt ?? ""} onChange={setField} />
              <Field label="Capitaux propres (€)" name="equity" value={form.equity ?? ""} onChange={setField} />
              <Field label="Trésorerie (€)" name="cash" value={form.cash ?? ""} onChange={setField} />
            </div>

            {/* SaaS (toggle) */}
            <button
              type="button"
              onClick={() => setShowSaaS(p => !p)}
              style={{ fontSize: 11.5, color: "var(--text-3)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}
            >
              {showSaaS ? "▲ Masquer métriques SaaS" : "▼ Métriques SaaS (ARR, MRR, NRR…)"}
            </button>
            {showSaaS && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...grid3, marginBottom: 6 }}>
                  <Field label="ARR (€)" name="arr" value={form.arr ?? ""} onChange={setField} />
                  <Field label="MRR (€)" name="mrr" value={form.mrr ?? ""} onChange={setField} />
                  <Field label="NRR (%)" name="nrr" value={form.nrr ?? ""} onChange={setField} />
                </div>
                <div style={{ ...grid3 }}>
                  <Field label="Churn (%)" name="churn_rate" value={form.churn_rate ?? ""} onChange={setField} />
                  <Field label="LTV (€)" name="ltv" value={form.ltv ?? ""} onChange={setField} />
                  <Field label="CAC (€)" name="cac" value={form.cac ?? ""} onChange={setField} />
                </div>
              </div>
            )}

            {/* Valorisation (toggle) */}
            <button
              type="button"
              onClick={() => setShowValorisation(p => !p)}
              style={{ fontSize: 11.5, color: "var(--text-3)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}
            >
              {showValorisation ? "▲ Masquer valorisation" : "▼ Valorisation (EV, multiples…)"}
            </button>
            {showValorisation && (
              <div style={{ ...grid3, marginBottom: 16 }}>
                <Field label="EV estimée (€)" name="ev_estimate" value={form.ev_estimate ?? ""} onChange={setField} />
                <Field label="Multiple EV/EBITDA" name="ev_ebitda_multiple" value={form.ev_ebitda_multiple ?? ""} onChange={setField} />
                <Field label="Multiple EV/ARR" name="ev_arr_multiple" value={form.ev_arr_multiple ?? ""} onChange={setField} />
              </div>
            )}

            {error && (
              <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, fontSize: 12.5, color: "#DC2626", marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "8px 20px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
