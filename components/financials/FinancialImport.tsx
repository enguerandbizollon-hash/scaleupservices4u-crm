"use client";
import { useState, useRef } from "react";
import { Upload, AlertTriangle, Check, X } from "lucide-react";

// Column mapping: flexible, case-insensitive, accent-insensitive
const COLUMN_MAP: Record<string, string> = {
  // Revenue
  "chiffre d'affaires": "revenue", "ca": "revenue", "revenue": "revenue", "revenus": "revenue",
  "récurrent": "revenue_recurring", "recurring": "revenue_recurring", "revenue_recurring": "revenue_recurring",
  "non récurrent": "revenue_non_recurring", "non_recurring": "revenue_non_recurring",
  // Charges
  "cogs": "cogs", "cout des ventes": "cogs", "coût des ventes": "cogs",
  "masse salariale": "payroll", "payroll": "payroll", "personnel": "payroll",
  "r&d": "payroll_rd", "payroll_rd": "payroll_rd",
  "commercial": "payroll_sales", "payroll_sales": "payroll_sales",
  "g&a": "payroll_ga", "payroll_ga": "payroll_ga",
  "marketing": "marketing", "acquisition": "marketing",
  "loyers": "rent", "loyer": "rent", "rent": "rent",
  "autres charges": "other_opex", "other_opex": "other_opex",
  "d&a": "da", "da": "da", "amortissement": "da", "depreciation": "da",
  "charges financieres": "financial_charges", "financial_charges": "financial_charges",
  "impots": "taxes", "taxes": "taxes", "is": "taxes",
  "capex": "capex", "investissements": "capex",
  // Récurrent
  "arr": "arr", "churn": "churn_rate", "churn_rate": "churn_rate",
  "nrr": "nrr", "cac": "cac", "growth": "growth_fcst", "croissance": "growth_fcst",
  // Bilan actif
  "immobilisations incorporelles": "intangible_assets", "goodwill": "intangible_assets",
  "immobilisations corporelles": "tangible_assets",
  "immobilisations financieres": "financial_assets",
  "stocks": "inventory", "inventory": "inventory",
  "creances clients": "accounts_receivable", "accounts_receivable": "accounts_receivable",
  "tresorerie": "cash", "cash": "cash", "trésorerie": "cash",
  // Bilan passif
  "capital social": "share_capital", "capital": "share_capital",
  "reserves": "reserves", "réserves": "reserves",
  "resultat exercice": "net_income_bs", "résultat exercice": "net_income_bs",
  "dettes lt": "debt_lt", "dette lt": "debt_lt", "debt_lt": "debt_lt",
  "dettes ct": "debt_st", "dette ct": "debt_st", "debt_st": "debt_st",
  "dettes fournisseurs": "accounts_payable", "accounts_payable": "accounts_payable",
  // Valorisation
  "ev/ebitda low": "multiple_ev_ebitda_low", "ev/ebitda mid": "multiple_ev_ebitda_mid", "ev/ebitda high": "multiple_ev_ebitda_high",
  "ev/ebit low": "multiple_ev_ebit_low", "ev/ebit mid": "multiple_ev_ebit_mid", "ev/ebit high": "multiple_ev_ebit_high",
  "ev/ca low": "multiple_ev_revenue_low", "ev/ca mid": "multiple_ev_revenue_mid", "ev/ca high": "multiple_ev_revenue_high",
  "wacc": "wacc", "taux croissance terminal": "terminal_growth_rate",
  // Meta
  "annee": "fiscal_year", "année": "fiscal_year", "year": "fiscal_year",
  "type": "_type", "devise": "currency", "currency": "currency",
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]/g, " ");
}

type MappedRow = Record<string, number | string | null>;

interface FinancialImportProps {
  dealId?: string;
  organizationId?: string;
  onImported: () => void;
}

export function FinancialImport({ dealId, organizationId, onImported }: FinancialImportProps) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (await import("xlsx")).default ?? await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (raw.length === 0) return;

    // Map headers
    const headers = Object.keys(raw[0]);
    const map: Record<string, string> = {};
    const ign: string[] = [];
    for (const h of headers) {
      const norm = normalizeHeader(h);
      const mapped = COLUMN_MAP[norm];
      if (mapped) {
        map[h] = mapped;
      } else {
        // Try partial match
        const partial = Object.entries(COLUMN_MAP).find(([k]) => norm.includes(k) || k.includes(norm));
        if (partial) map[h] = partial[1];
        else ign.push(h);
      }
    }

    // Parse rows
    const parsed: MappedRow[] = raw.map(r => {
      const row: MappedRow = {};
      for (const [header, field] of Object.entries(map)) {
        const val = r[header];
        if (field === "_type" || field === "currency" || field === "fiscal_year") {
          row[field] = String(val).trim();
        } else {
          const n = parseFloat(String(val).replace(/\s/g, "").replace(",", "."));
          row[field] = isNaN(n) ? null : n;
        }
      }
      // Detect year from filename if not in data
      if (!row.fiscal_year) {
        const yearMatch = file.name.match(/20\d{2}/);
        if (yearMatch) row.fiscal_year = yearMatch[0];
      }
      // Detect forecast
      const typeVal = String(row._type ?? "").toLowerCase();
      row._is_forecast = (typeVal.includes("prévision") || typeVal.includes("budget") || typeVal.includes("forecast")) ? "true" : "false";
      return row;
    });

    setMapping(map);
    setIgnored(ign);
    setRows(parsed);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    const { upsertFinancialData } = await import("@/actions/financial-data");
    const errors: string[] = [];
    let created = 0, updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const year = parseInt(String(r.fiscal_year ?? new Date().getFullYear()));
        if (isNaN(year)) { errors.push(`Ligne ${i + 1}: année invalide`); continue; }

        const payload: Record<string, unknown> = {
          deal_id: dealId || undefined,
          organization_id: organizationId || undefined,
          fiscal_year: year,
          currency: String(r.currency || "EUR"),
          is_forecast: r._is_forecast === "true",
          source: "csv",
        };

        for (const [, field] of Object.entries(mapping)) {
          if (field.startsWith("_") || field === "fiscal_year" || field === "currency") continue;
          if (r[field] != null) payload[field] = r[field];
        }

        await upsertFinancialData(payload as unknown as Parameters<typeof upsertFinancialData>[0]);
        updated++;
      } catch (e) {
        errors.push(`Ligne ${i + 1}: ${e instanceof Error ? e.message : "erreur"}`);
      }
    }

    setResult({ created, updated, errors });
    setStep("done");
    setImporting(false);
    if (errors.length === 0) onImported();
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20,
  };

  if (step === "done" && result) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Check size={16} color="#065F46" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Import terminé</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8 }}>
          {result.updated} exercice{result.updated > 1 ? "s" : ""} importé{result.updated > 1 ? "s" : ""}
        </div>
        {result.errors.length > 0 && (
          <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 8 }}>
            {result.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        <button onClick={() => { setStep("upload"); setRows([]); setResult(null); }}
          style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", color: "var(--text-3)" }}>
          Nouvel import
        </button>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>Aperçu import</div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            <strong>{Object.keys(mapping).length}</strong> colonnes mappées
          </div>
          {ignored.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#92400E", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} /> {ignored.length} ignorées : {ignored.join(", ")}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            <strong>{rows.length}</strong> ligne{rows.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* Preview table (first 5 rows) */}
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {Object.values(mapping).filter(f => !f.startsWith("_")).map(f => (
                  <th key={f} style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-4)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  {Object.values(mapping).filter(f => !f.startsWith("_")).map(f => (
                    <td key={f} style={{ padding: "5px 10px", textAlign: "right", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                      {r[f] != null ? String(r[f]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => { setStep("upload"); setRows([]); }}
            style={{ fontSize: 12.5, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", color: "var(--text-3)" }}>
            <X size={12} /> Annuler
          </button>
          <button onClick={handleImport} disabled={importing}
            style={{ fontSize: 12.5, padding: "7px 18px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: importing ? 0.6 : 1 }}>
            {importing ? "Import en cours…" : `Confirmer l'import (${rows.length} lignes)`}
          </button>
        </div>
      </div>
    );
  }

  // Upload step
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>Importer des données financières</div>
      <div style={{ fontSize: 12.5, color: "var(--text-5)", marginBottom: 14 }}>CSV ou Excel (.xlsx). Les colonnes sont mappées automatiquement.</div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>
        <Upload size={14} /> Choisir un fichier
      </button>
    </div>
  );
}
