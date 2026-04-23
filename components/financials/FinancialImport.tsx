"use client";
import { useState, useRef } from "react";
import { Upload, AlertTriangle, Check, X, Download } from "lucide-react";
import {
  generateFinancialTemplate,
  parseFinancialTemplate,
  type TemplateParsedRow,
} from "@/lib/import/financial-template";

// Tous les noms de champs BDD valides (priorité 1 : exact match sur le nom BDD)
const DB_FIELDS = new Set([
  "fiscal_year", "currency", "is_forecast", "sector",
  "revenue", "revenue_recurring", "revenue_non_recurring",
  "cogs", "payroll", "payroll_rd", "payroll_sales", "payroll_ga",
  "marketing", "rent", "other_opex", "da", "financial_charges", "taxes", "capex",
  "arr", "churn_rate", "nrr", "cac", "growth_fcst",
  "intangible_assets", "tangible_assets", "financial_assets",
  "inventory", "accounts_receivable", "other_current_assets", "cash",
  "share_capital", "reserves", "net_income_bs",
  "debt_lt", "debt_st", "accounts_payable", "other_current_liabilities",
  "contingent_liabilities", "excess_cash", "misc_adjustments",
  "multiple_ev_ebitda_low", "multiple_ev_ebitda_mid", "multiple_ev_ebitda_high",
  "multiple_ev_ebit_low", "multiple_ev_ebit_mid", "multiple_ev_ebit_high",
  "multiple_ev_revenue_low", "multiple_ev_revenue_mid", "multiple_ev_revenue_high",
  "multiple_ev_arr_low", "multiple_ev_arr_mid", "multiple_ev_arr_high",
  "wacc", "terminal_growth_rate", "fcf_n1", "fcf_n2", "fcf_n3", "fcf_n4", "fcf_n5",
]);

// Alias manuels (priorité 2 : correspondance sur alias FR/EN)
const ALIAS_MAP: Record<string, string> = {
  "chiffre d'affaires": "revenue", "ca": "revenue", "revenus": "revenue",
  "récurrent": "revenue_recurring", "recurring": "revenue_recurring",
  "non récurrent": "revenue_non_recurring", "non recurring": "revenue_non_recurring",
  "cout des ventes": "cogs", "coût des ventes": "cogs",
  "masse salariale": "payroll", "personnel": "payroll",
  "r&d": "payroll_rd", "commercial": "payroll_sales", "g&a": "payroll_ga",
  "acquisition": "marketing",
  "loyers": "rent", "loyer": "rent",
  "autres charges": "other_opex", "autres charges externes": "other_opex",
  "d&a": "da", "amortissement": "da", "depreciation": "da",
  "charges financières": "financial_charges", "charges financieres": "financial_charges",
  "impots": "taxes", "impôts": "taxes", "is": "taxes",
  "investissements": "capex",
  "churn": "churn_rate", "growth": "growth_fcst", "croissance": "growth_fcst",
  "secteur": "sector",
  "immobilisations incorporelles": "intangible_assets", "goodwill": "intangible_assets",
  "immobilisations corporelles": "tangible_assets",
  "immobilisations financieres": "financial_assets", "immobilisations financières": "financial_assets",
  "stocks": "inventory",
  "creances clients": "accounts_receivable", "créances clients": "accounts_receivable",
  "autres actifs courants": "other_current_assets",
  "tresorerie": "cash", "trésorerie": "cash",
  "capital social": "share_capital", "capital": "share_capital",
  "réserves": "reserves",
  "resultat exercice": "net_income_bs", "résultat exercice": "net_income_bs",
  "dettes lt": "debt_lt", "dette lt": "debt_lt",
  "dettes ct": "debt_st", "dette ct": "debt_st",
  "dettes fournisseurs": "accounts_payable",
  "autres passifs courants": "other_current_liabilities",
  "passifs éventuels": "contingent_liabilities", "passifs eventuels": "contingent_liabilities",
  "trésorerie excédentaire": "excess_cash",
  "ev/ebitda low": "multiple_ev_ebitda_low", "ev/ebitda mid": "multiple_ev_ebitda_mid", "ev/ebitda high": "multiple_ev_ebitda_high",
  "ev/ebit low": "multiple_ev_ebit_low", "ev/ebit mid": "multiple_ev_ebit_mid", "ev/ebit high": "multiple_ev_ebit_high",
  "ev/ca low": "multiple_ev_revenue_low", "ev/ca mid": "multiple_ev_revenue_mid", "ev/ca high": "multiple_ev_revenue_high",
  "taux croissance terminal": "terminal_growth_rate",
  "annee": "fiscal_year", "année": "fiscal_year", "year": "fiscal_year",
  "type": "_type", "devise": "currency",
};

/** Résout un header CSV vers un champ BDD. Priorité : exact BDD name → alias → null */
function resolveHeader(header: string): string | null {
  const lower = header.toLowerCase().trim();
  if (DB_FIELDS.has(lower)) return lower;
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  const normalized = lower.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-]/g, " ");
  if (ALIAS_MAP[normalized]) return ALIAS_MAP[normalized];
  if (lower === "type") return "_type";
  return null;
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
  const [fields, setFields] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Téléchargement du modèle ──────────────────────────────────────────────
  async function handleDownloadTemplate() {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];
    const bytes = await generateFinancialTemplate({ years });
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele-financier-${years.join("-")}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Lecture du fichier ────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buf = await file.arrayBuffer();
    const isXlsx = /\.xlsx?$/i.test(file.name);

    // Tentative parser template multi-onglets en priorité sur xlsx
    if (isXlsx) {
      const tpl = await parseFinancialTemplate(buf);
      if (tpl.recognized && tpl.rows.length > 0) {
        applyTemplateResult(tpl.rows, tpl.warnings);
        return;
      }
    }

    // Fallback : parser flat (CSV / xlsx simple)
    await parseFlat(buf, file.name);
  }

  function applyTemplateResult(parsed: TemplateParsedRow[], warn: string[]) {
    const allFields = new Set<string>();
    const mapped: MappedRow[] = parsed.map(p => {
      const row: MappedRow = { fiscal_year: p.fiscal_year };
      for (const [f, v] of Object.entries(p.fields)) {
        row[f] = v;
        allFields.add(f);
      }
      return row;
    });
    setFields(["fiscal_year", ...allFields]);
    setRows(mapped);
    setWarnings(warn);
    setSourceLabel(`Modèle ScaleUp — ${parsed.length} exercice${parsed.length > 1 ? "s" : ""} détecté${parsed.length > 1 ? "s" : ""}`);
    setStep("preview");
  }

  async function parseFlat(buf: ArrayBuffer, fileName: string) {
    const XLSX = (await import("xlsx")).default ?? await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (raw.length === 0) return;

    const headers = Object.keys(raw[0]);
    const map: Record<string, string> = {};
    const ign: string[] = [];
    const usedFields = new Set<string>();
    for (const h of headers) {
      const resolved = resolveHeader(h);
      if (resolved && !usedFields.has(resolved)) {
        map[h] = resolved;
        usedFields.add(resolved);
      } else {
        ign.push(h);
      }
    }

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
      if (!row.fiscal_year) {
        const yearMatch = fileName.match(/20\d{2}/);
        if (yearMatch) row.fiscal_year = yearMatch[0];
      }
      const typeVal = String(row._type ?? "").toLowerCase();
      row._is_forecast = (typeVal.includes("prévision") || typeVal.includes("budget") || typeVal.includes("forecast")) ? "true" : "false";
      return row;
    });

    const detectedFields = [...new Set(Object.values(map))].filter(f => !f.startsWith("_"));
    setFields(detectedFields);
    setRows(parsed);
    setWarnings(ign.length > 0 ? [`Colonnes ignorées : ${ign.join(", ")}`] : []);
    setSourceLabel(`Fichier flat — ${parsed.length} ligne${parsed.length > 1 ? "s" : ""}`);
    setStep("preview");
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    const { upsertFinancialData } = await import("@/actions/financial-data");
    const errors: string[] = [];
    let updated = 0;

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
          source: "excel",
        };

        for (const f of fields) {
          if (f.startsWith("_") || f === "fiscal_year" || f === "currency") continue;
          if (r[f] != null) payload[f] = r[f];
        }

        await upsertFinancialData(payload as unknown as Parameters<typeof upsertFinancialData>[0]);
        updated++;
      } catch (e) {
        errors.push(`Ligne ${i + 1}: ${e instanceof Error ? e.message : "erreur"}`);
      }
    }

    setResult({ created: 0, updated, errors });
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
        <button onClick={() => { setStep("upload"); setRows([]); setResult(null); setFields([]); setWarnings([]); }}
          style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", color: "var(--text-3)" }}>
          Nouvel import
        </button>
      </div>
    );
  }

  if (step === "preview") {
    const displayFields = fields.filter(f => !f.startsWith("_"));
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>Aperçu import</div>
        <div style={{ fontSize: 11.5, color: "var(--text-5)", marginBottom: 12 }}>{sourceLabel}</div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            <strong>{displayFields.length}</strong> champ{displayFields.length > 1 ? "s" : ""} détecté{displayFields.length > 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            <strong>{rows.length}</strong> exercice{rows.length > 1 ? "s" : ""}
          </div>
        </div>

        {warnings.length > 0 && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", fontSize: 12, marginBottom: 14, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              {warnings.slice(0, 5).map((w, i) => <div key={i}>{w}</div>)}
              {warnings.length > 5 && <div>… et {warnings.length - 5} autre{warnings.length - 5 > 1 ? "s" : ""}</div>}
            </div>
          </div>
        )}

        {/* Preview table : une colonne par exercice, une ligne par champ */}
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "var(--text-4)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Champ</th>
                {rows.slice(0, 5).map((r, i) => (
                  <th key={i} style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-4)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    {r.fiscal_year ?? `#${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayFields.filter(f => f !== "fiscal_year").slice(0, 20).map(f => (
                <tr key={f}>
                  <td style={{ padding: "5px 10px", textAlign: "left", color: "var(--text-3)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>{f}</td>
                  {rows.slice(0, 5).map((r, i) => (
                    <td key={i} style={{ padding: "5px 10px", textAlign: "right", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                      {r[f] != null ? String(r[f]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {displayFields.length > 20 && (
            <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 6, fontStyle: "italic" }}>
              … {displayFields.length - 20} autre{displayFields.length - 20 > 1 ? "s" : ""} champ{displayFields.length - 20 > 1 ? "s" : ""} non affiché{displayFields.length - 20 > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => { setStep("upload"); setRows([]); setFields([]); setWarnings([]); }}
            style={{ fontSize: 12.5, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", color: "var(--text-3)" }}>
            <X size={12} /> Annuler
          </button>
          <button onClick={handleImport} disabled={importing}
            style={{ fontSize: 12.5, padding: "7px 18px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: importing ? 0.6 : 1 }}>
            {importing ? "Import en cours…" : `Confirmer l'import (${rows.length})`}
          </button>
        </div>
      </div>
    );
  }

  // Upload step
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>Importer des données financières</div>
      <div style={{ fontSize: 12.5, color: "var(--text-5)", marginBottom: 14 }}>
        Téléchargez le modèle standard pour une reconnaissance automatique fiable (P&amp;L, Bilan, Dettes &amp; BFR, Ratios, Valorisation). Le parser accepte aussi un CSV ou Excel libre — les colonnes sont alors mappées par alias.
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => void handleDownloadTemplate()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>
          <Download size={14} /> Télécharger le modèle
        </button>
        <button onClick={() => fileRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface-2)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>
          <Upload size={14} /> Choisir un fichier
        </button>
      </div>
    </div>
  );
}
