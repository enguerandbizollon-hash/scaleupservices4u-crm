// Template Excel standardisé pour l'import des données financières.
// Structure : 5 onglets (P&L, Bilan, Dettes & BFR, Ratios, Valorisation).
// Pour chaque onglet : ligne 1 = en-tête (colonne A = "Indicateur", colonnes B+ =
// années), lignes suivantes = une métrique par ligne. Source de vérité unique
// pour la génération du modèle ET le parsing d'un fichier rempli.

import type * as XLSXType from "xlsx";

// ── Définition des onglets ─────────────────────────────────────────────────────
// Clé: libellé normalisé (via normalizeLabel) → champ BDD financial_data.
// L'ordre des rows est l'ordre d'affichage dans le template téléchargé.

export interface TemplateRow {
  /** Libellé affiché dans la colonne A du template */
  label: string;
  /** Champ cible dans financial_data (undefined = ligne de section / titre) */
  field?: string;
  /** Section de regroupement (affichée en gras, pas de saisie) */
  isSection?: boolean;
  /** Indentation visuelle (sous-ligne) */
  indent?: boolean;
}

export interface TemplateSheet {
  name: string;
  description: string;
  rows: TemplateRow[];
}

export const TEMPLATE_SHEETS: TemplateSheet[] = [
  {
    name: "P&L",
    description: "Compte de résultat — revenus, charges, résultat",
    rows: [
      { label: "COMPTE DE RÉSULTAT", isSection: true },
      { label: "Chiffre d'affaires", field: "revenue" },
      { label: "Dont récurrent", field: "revenue_recurring", indent: true },
      { label: "Dont non-récurrent", field: "revenue_non_recurring", indent: true },
      { label: "Coût des ventes (COGS)", field: "cogs" },
      { label: "CHARGES OPÉRATIONNELLES", isSection: true },
      { label: "Masse salariale", field: "payroll" },
      { label: "Dont R&D", field: "payroll_rd", indent: true },
      { label: "Dont Commercial", field: "payroll_sales", indent: true },
      { label: "Dont G&A", field: "payroll_ga", indent: true },
      { label: "Marketing", field: "marketing" },
      { label: "Loyers", field: "rent" },
      { label: "Autres charges", field: "other_opex" },
      { label: "D&A (amortissements)", field: "da" },
      { label: "Charges financières", field: "financial_charges" },
      { label: "Impôts", field: "taxes" },
      { label: "Capex", field: "capex" },
    ],
  },
  {
    name: "Bilan",
    description: "Actif et passif à la clôture de l'exercice",
    rows: [
      { label: "ACTIF", isSection: true },
      { label: "Immobilisations incorporelles", field: "intangible_assets" },
      { label: "Immobilisations corporelles", field: "tangible_assets" },
      { label: "Immobilisations financières", field: "financial_assets" },
      { label: "Stocks", field: "inventory" },
      { label: "Créances clients", field: "accounts_receivable" },
      { label: "Autres actifs courants", field: "other_current_assets" },
      { label: "Trésorerie", field: "cash" },
      { label: "PASSIF", isSection: true },
      { label: "Capital social", field: "share_capital" },
      { label: "Réserves", field: "reserves" },
      { label: "Résultat de l'exercice", field: "net_income_bs" },
      { label: "Dettes long terme", field: "debt_lt" },
      { label: "Dettes court terme", field: "debt_st" },
      { label: "Dettes fournisseurs", field: "accounts_payable" },
      { label: "Autres passifs courants", field: "other_current_liabilities" },
    ],
  },
  {
    name: "Dettes & BFR",
    description: "Focus endettement et besoin en fonds de roulement (facultatif — données déjà dans Bilan)",
    rows: [
      { label: "Dettes long terme", field: "debt_lt" },
      { label: "Dettes court terme", field: "debt_st" },
      { label: "Trésorerie", field: "cash" },
      { label: "Créances clients", field: "accounts_receivable" },
      { label: "Stocks", field: "inventory" },
      { label: "Dettes fournisseurs", field: "accounts_payable" },
    ],
  },
  {
    name: "Ratios",
    description: "Indicateurs SaaS/récurrence et opérationnels non-calculables",
    rows: [
      { label: "SAAS / RÉCURRENCE", isSection: true },
      { label: "ARR", field: "arr" },
      { label: "MRR", field: "mrr" },
      { label: "NRR (%)", field: "nrr" },
      { label: "GRR (%)", field: "grr" },
      { label: "Churn rate (%)", field: "churn_rate" },
      { label: "CAGR (%)", field: "cagr" },
      { label: "LTV", field: "ltv" },
      { label: "CAC", field: "cac" },
      { label: "Payback (mois)", field: "payback_months" },
      { label: "Croissance prévue (%)", field: "growth_fcst" },
      { label: "OPÉRATIONNEL", isSection: true },
      { label: "Effectif", field: "headcount" },
    ],
  },
  {
    name: "Valorisation",
    description: "Multiples, DCF et bridge VE → capitaux propres",
    rows: [
      { label: "MULTIPLES EV / EBITDA", isSection: true },
      { label: "EV/EBITDA bas", field: "multiple_ev_ebitda_low" },
      { label: "EV/EBITDA mid", field: "multiple_ev_ebitda_mid" },
      { label: "EV/EBITDA haut", field: "multiple_ev_ebitda_high" },
      { label: "MULTIPLES EV / EBIT", isSection: true },
      { label: "EV/EBIT bas", field: "multiple_ev_ebit_low" },
      { label: "EV/EBIT mid", field: "multiple_ev_ebit_mid" },
      { label: "EV/EBIT haut", field: "multiple_ev_ebit_high" },
      { label: "MULTIPLES EV / REVENUE", isSection: true },
      { label: "EV/Revenue bas", field: "multiple_ev_revenue_low" },
      { label: "EV/Revenue mid", field: "multiple_ev_revenue_mid" },
      { label: "EV/Revenue haut", field: "multiple_ev_revenue_high" },
      { label: "MULTIPLES EV / ARR", isSection: true },
      { label: "EV/ARR bas", field: "multiple_ev_arr_low" },
      { label: "EV/ARR mid", field: "multiple_ev_arr_mid" },
      { label: "EV/ARR haut", field: "multiple_ev_arr_high" },
      { label: "DCF", isSection: true },
      { label: "WACC (%)", field: "wacc" },
      { label: "Taux croissance terminal (%)", field: "terminal_growth_rate" },
      { label: "FCF N+1", field: "fcf_n1" },
      { label: "FCF N+2", field: "fcf_n2" },
      { label: "FCF N+3", field: "fcf_n3" },
      { label: "FCF N+4", field: "fcf_n4" },
      { label: "FCF N+5", field: "fcf_n5" },
      { label: "BRIDGE VE → CAPITAUX PROPRES", isSection: true },
      { label: "Ajustements divers", field: "misc_adjustments" },
      { label: "Passifs contingents", field: "contingent_liabilities" },
      { label: "Trésorerie excédentaire", field: "excess_cash" },
    ],
  },
];

// ── Normalisation des libellés pour matching tolérant ──────────────────────────

/** Normalise un libellé : lowercase, sans accents, trim, collapse spaces. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise un nom d'onglet (idem libellé + strip séparateurs courants). */
export function normalizeSheetName(s: string): string {
  return normalizeLabel(s).replace(/[&\-_/]/g, " ").replace(/\s+/g, " ").trim();
}

// Index précalculé : normalized label → field, par onglet normalisé
interface SheetIndex {
  name: string; // canonical
  normalized: string;
  labelToField: Map<string, string>;
}

const SHEET_INDEX: SheetIndex[] = TEMPLATE_SHEETS.map(sheet => {
  const labelToField = new Map<string, string>();
  for (const row of sheet.rows) {
    if (row.field) {
      labelToField.set(normalizeLabel(row.label), row.field);
    }
  }
  return { name: sheet.name, normalized: normalizeSheetName(sheet.name), labelToField };
});

/** Retourne l'index template correspondant à un nom d'onglet utilisateur, ou null. */
function findSheetIndex(userSheetName: string): SheetIndex | null {
  const n = normalizeSheetName(userSheetName);
  for (const idx of SHEET_INDEX) {
    if (idx.normalized === n) return idx;
  }
  // Tolérance : matching partiel (le nom utilisateur contient le nom template)
  for (const idx of SHEET_INDEX) {
    if (n.includes(idx.normalized) || idx.normalized.includes(n)) return idx;
  }
  return null;
}

// ── Génération du template (.xlsx) ─────────────────────────────────────────────

export interface GenerateTemplateOptions {
  /** Années à afficher (colonnes B+). Ex: [2023, 2024, 2025]. */
  years: number[];
  /** Nom du dossier/organisation, affiché en commentaire Excel (facultatif). */
  dealName?: string;
}

/**
 * Génère un fichier Excel modèle, prêt à être rempli. Retourne un Uint8Array
 * directement téléchargeable côté client (Blob + lien).
 */
export async function generateFinancialTemplate(opts: GenerateTemplateOptions): Promise<Uint8Array> {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // Feuille de garde (instructions)
  const coverRows: (string | number)[][] = [
    ["Modèle d'import financier — ScaleUp Services 4U"],
    [],
    ["Mode d'emploi"],
    ["1. Renseignez les valeurs dans les onglets suivants. Toutes les colonnes et lignes peuvent rester vides."],
    ["2. Les années sont en colonnes B, C, D… Vous pouvez ajouter des colonnes au besoin."],
    ["3. Les libellés en colonne A doivent être conservés tels quels pour la reconnaissance automatique."],
    ["4. Une même donnée peut apparaître dans plusieurs onglets (ex: Dettes LT dans Bilan et Dettes & BFR) — la dernière valeur non vide gagne."],
    ["5. Les valeurs sont en devise native du dossier. Pas besoin de convertir."],
    [],
    ["Dossier", opts.dealName ?? ""],
    ["Généré le", new Date().toISOString().slice(0, 10)],
  ];
  const coverWs = XLSX.utils.aoa_to_sheet(coverRows);
  XLSX.utils.book_append_sheet(wb, coverWs, "Instructions");

  // Un onglet par section du template
  for (const sheet of TEMPLATE_SHEETS) {
    const aoa: (string | number | null)[][] = [];
    // Ligne 1 : en-tête
    aoa.push(["Indicateur", ...opts.years]);
    // Lignes suivantes : métriques / sections
    for (const row of sheet.rows) {
      if (row.isSection) {
        aoa.push([`— ${row.label} —`, ...opts.years.map(() => null)]);
      } else {
        const labelCol = row.indent ? `    ${row.label}` : row.label;
        aoa.push([labelCol, ...opts.years.map(() => null)]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Largeur de colonne : A large pour les libellés
    ws["!cols"] = [{ wch: 42 }, ...opts.years.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out as ArrayBuffer);
}

// ── Parsing d'un fichier rempli ────────────────────────────────────────────────

export interface TemplateParsedRow {
  fiscal_year: number;
  fields: Record<string, number>;
  /** Onglets où au moins une valeur a été lue pour cette année. */
  sheetsSeen: string[];
}

export interface TemplateParseResult {
  rows: TemplateParsedRow[];
  warnings: string[];
  /** Indique si au moins un onglet reconnu a été trouvé dans le fichier. */
  recognized: boolean;
}

/**
 * Parse un workbook Excel rempli à partir du template multi-onglets.
 * Retourne une ligne par fiscal_year détectée, avec les champs mergés
 * depuis tous les onglets reconnus (ordre P&L → Bilan → Dettes & BFR →
 * Ratios → Valorisation ; dernière valeur non-nulle gagne).
 */
export async function parseFinancialTemplate(buffer: ArrayBuffer): Promise<TemplateParseResult> {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(buffer, { type: "array" });

  const warnings: string[] = [];
  // Accumulateur par année
  const accumulator = new Map<number, { fields: Record<string, number>; sheetsSeen: Set<string> }>();
  let recognized = false;

  // Itération dans l'ordre canonique pour que la précédence soit déterministe
  for (const idx of SHEET_INDEX) {
    // Trouver l'onglet utilisateur correspondant
    const userSheetName = wb.SheetNames.find(n => {
      const ni = findSheetIndex(n);
      return ni !== null && ni.name === idx.name;
    });
    if (!userSheetName) continue;
    recognized = true;

    const ws = wb.Sheets[userSheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    if (aoa.length < 2) {
      warnings.push(`Onglet "${userSheetName}" vide ou sans données.`);
      continue;
    }

    // Lecture ligne 1 : détecte les colonnes année
    const header = aoa[0] ?? [];
    const yearCols: { col: number; year: number }[] = [];
    for (let c = 1; c < header.length; c++) {
      const raw = header[c];
      const parsed = typeof raw === "number" ? Math.trunc(raw) : parseInt(String(raw ?? "").trim(), 10);
      if (!isNaN(parsed) && parsed >= 1990 && parsed <= 2100) {
        yearCols.push({ col: c, year: parsed });
      }
    }
    if (yearCols.length === 0) {
      warnings.push(`Onglet "${userSheetName}" : aucune année reconnue en ligne 1.`);
      continue;
    }

    // Parcours des lignes de métriques
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const rawLabel = String(row[0] ?? "").trim();
      if (!rawLabel) continue;
      // Sections de type "— XXX —" : ignorées
      if (rawLabel.startsWith("—") && rawLabel.endsWith("—")) continue;

      const normalized = normalizeLabel(rawLabel);
      const field = idx.labelToField.get(normalized);
      if (!field) {
        warnings.push(`Onglet "${userSheetName}" ligne ${r + 1} : libellé non reconnu "${rawLabel}".`);
        continue;
      }

      for (const { col, year } of yearCols) {
        const cell = row[col];
        if (cell === null || cell === undefined || cell === "") continue;
        const num = typeof cell === "number" ? cell : parseNumericCell(String(cell));
        if (num === null) continue;

        let entry = accumulator.get(year);
        if (!entry) {
          entry = { fields: {}, sheetsSeen: new Set() };
          accumulator.set(year, entry);
        }
        entry.fields[field] = num;
        entry.sheetsSeen.add(idx.name);
      }
    }
  }

  const rows: TemplateParsedRow[] = [...accumulator.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { fields, sheetsSeen }]) => ({
      fiscal_year: year,
      fields,
      sheetsSeen: [...sheetsSeen],
    }));

  return { rows, warnings, recognized };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseNumericCell(s: string): number | null {
  const cleaned = s.replace(/\s/g, "").replace(/[€$£]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Import dynamique de xlsx — évite d'inclure la lib dans le bundle serveur par défaut.
async function loadXLSX(): Promise<typeof XLSXType> {
  const mod = await import("xlsx");
  return (mod.default ?? mod) as typeof XLSXType;
}
