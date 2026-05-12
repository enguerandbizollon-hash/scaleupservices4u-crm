"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Download,
} from "lucide-react";
import { downloadCSV, rowsToCSV } from "@/lib/export/csv";

// ─────────────────────────────────────────────────────────────
// Wizard générique d'import CSV/Excel — réutilisable.
// Chaque entité (Contacts, Organisations, ...) passe sa config
// et la fonction qui exécute l'import en base.
// ─────────────────────────────────────────────────────────────

export type ImportFieldSpec = {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

export type ImportResult = {
  total: number;
  created: number;
  matched: number;
  errors: { line: number; reason: string }[];
  extras?: { label: string; value: number }[];
};

export type ImportWizardConfig = {
  entityLabel: string;
  entityLabelPlural: string;
  fields: ImportFieldSpec[];
  templateFilename: string;
  templateRow: Record<string, string>;
  templateHeaderLabels?: Record<string, string>;
  runImport: (records: Record<string, string>[]) => Promise<ImportResult>;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-.]/g, "");
}

function autoMap(header: string, fields: ImportFieldSpec[]): string {
  const n = normalize(header);
  for (const f of fields) {
    if (f.aliases.some((a) => normalize(a) === n)) return f.key;
    if (f.aliases.some((a) => n.includes(normalize(a)))) return f.key;
  }
  return "ignore";
}

async function parseFile(
  file: File,
): Promise<{ headers: string[]; rows: string[][] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = (raw[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = raw
    .slice(1)
    .map((r) => r.map((c) => String(c ?? "").trim()))
    .filter((r) => r.some((c) => c.length > 0));
  return { headers, rows };
}

type Step = "file" | "mapping" | "run";

export function ImportWizardModal({
  config,
  onClose,
  onImported,
}: {
  config: ImportWizardConfig;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("file");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [parseErr, setParseErr] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const requiredKeys = config.fields.filter((f) => f.required).map((f) => f.key);
  const fieldsByKey = useMemo(() => {
    const m = new Map<string, ImportFieldSpec>();
    for (const f of config.fields) m.set(f.key, f);
    return m;
  }, [config.fields]);

  async function onFile(file: File) {
    setParseErr("");
    setFilename(file.name);
    try {
      const { headers: h, rows: r } = await parseFile(file);
      if (h.length === 0 || r.length === 0) {
        setParseErr("Fichier vide ou illisible");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(h.map((header) => autoMap(header, config.fields)));
      setStep("mapping");
    } catch (e) {
      setParseErr(
        e instanceof Error ? e.message : "Impossible de lire le fichier",
      );
    }
  }

  function downloadTemplate() {
    const headerLabels = config.templateHeaderLabels ?? {};
    const keys = Object.keys(config.templateRow);
    const csv = rowsToCSV(
      [config.templateRow],
      keys.map((k) => ({ key: k, label: headerLabels[k] ?? k })),
    );
    downloadCSV(config.templateFilename, csv);
  }

  const validRows = useMemo(() => {
    if (step !== "run") return { valid: [] as Record<string, string>[], invalid: 0 };
    const requiredIdxs = requiredKeys.map((k) => mapping.indexOf(k));
    if (requiredIdxs.some((i) => i < 0))
      return { valid: [], invalid: rows.length };
    const valid: Record<string, string>[] = [];
    let invalid = 0;
    for (const r of rows) {
      const missingRequired = requiredKeys.some((k, idx) => {
        const colIdx = requiredIdxs[idx];
        return !(r[colIdx] ?? "").trim();
      });
      if (missingRequired) {
        invalid++;
        continue;
      }
      const obj: Record<string, string> = {};
      mapping.forEach((target, colIdx) => {
        if (target === "ignore") return;
        const v = (r[colIdx] ?? "").trim();
        if (v) obj[target] = v;
      });
      valid.push(obj);
    }
    return { valid, invalid };
  }, [step, mapping, rows, requiredKeys]);

  const hasRequiredMapping = requiredKeys.every((k) => mapping.includes(k));

  async function runImport() {
    setRunning(true);
    try {
      const res = await config.runImport(validRows.valid);
      setResult(res);
      onImported();
    } finally {
      setRunning(false);
    }
  }

  const targetOptions: { key: string; label: string }[] = [
    { key: "ignore", label: "— Ignorer cette colonne —" },
    ...config.fields.map((f) => ({ key: f.key, label: f.label })),
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9,22,40,.6)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <div
        className="animate-scalein card"
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderBottom: "1px solid var(--border-1)",
          }}
        >
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>
              Importer des {config.entityLabelPlural}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {step === "file" && "1. Choisir un fichier CSV ou Excel"}
              {step === "mapping" && "2. Associer les colonnes"}
              {step === "run" && (result ? "Import terminé" : "3. Confirmer et lancer")}
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 28, overflowY: "auto", flex: 1 }}>
          {step === "file" && (
            <FileStep
              filename={filename}
              parseErr={parseErr}
              onPick={() => fileRef.current?.click()}
              onTemplate={downloadTemplate}
            />
          )}
          {step === "mapping" && (
            <MappingStep
              headers={headers}
              rows={rows}
              mapping={mapping}
              setMapping={setMapping}
              targetOptions={targetOptions}
              fieldsByKey={fieldsByKey}
            />
          )}
          {step === "run" && !result && (
            <RunStep
              entityLabelPlural={config.entityLabelPlural}
              total={rows.length}
              valid={validRows.valid.length}
              invalid={validRows.invalid}
              hasRequiredMapping={hasRequiredMapping}
            />
          )}
          {step === "run" && result && (
            <ResultStep result={result} entityLabelPlural={config.entityLabelPlural} />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 28px",
            borderTop: "1px solid var(--border-1)",
            gap: 12,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.tsv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <div style={{ fontSize: 12, color: "var(--text-4)" }}>
            {step === "mapping" && `${rows.length} ligne${rows.length > 1 ? "s" : ""} détectée${rows.length > 1 ? "s" : ""}`}
            {step === "run" && !result && `${validRows.valid.length} valides · ${validRows.invalid} ignorées`}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {step === "mapping" && (
              <>
                <button className="btn btn-secondary" onClick={() => setStep("file")}>
                  <ChevronLeft size={14} /> Retour
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep("run")}
                  disabled={!hasRequiredMapping}
                  title={hasRequiredMapping ? "" : "Mappe au minimum les champs obligatoires (*)"}
                >
                  Continuer <ChevronRight size={14} />
                </button>
              </>
            )}
            {step === "run" && !result && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep("mapping")}
                  disabled={running}
                >
                  <ChevronLeft size={14} /> Retour
                </button>
                <button
                  className="btn btn-primary"
                  onClick={runImport}
                  disabled={running || validRows.valid.length === 0}
                  style={{ minWidth: 200, justifyContent: "center" }}
                >
                  {running && <Loader2 size={14} className="animate-spin" />}
                  {running
                    ? "Import en cours…"
                    : `Importer ${validRows.valid.length} ${config.entityLabel}${validRows.valid.length > 1 ? "s" : ""}`}
                </button>
              </>
            )}
            {step === "run" && result && (
              <button className="btn btn-primary" onClick={onClose}>
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileStep({
  filename,
  parseErr,
  onPick,
  onTemplate,
}: {
  filename: string;
  parseErr: string;
  onPick: () => void;
  onTemplate: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Formats acceptés : CSV, TSV, Excel (.xlsx, .xls). Les colonnes seront
        détectées automatiquement à l&apos;étape suivante.
      </p>
      <div
        onClick={onPick}
        style={{
          border: "2px dashed var(--border-2)",
          padding: 40,
          cursor: "pointer",
          textAlign: "center",
          background: "var(--surface)",
          transition: "border-color .15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--su-400)")}
        onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-2)")}
      >
        {filename ? (
          <>
            <FileText size={28} style={{ color: "var(--su-500)", marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: 13 }}>{filename}</div>
            <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 4 }}>
              Cliquer pour choisir un autre fichier
            </div>
          </>
        ) : (
          <>
            <Upload size={28} style={{ color: "var(--text-4)", marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Cliquer pour choisir un fichier
            </div>
            <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 4 }}>
              ou faire glisser un .csv / .xlsx
            </div>
          </>
        )}
      </div>
      {parseErr && (
        <div style={{ fontSize: 12, color: "var(--rec-tx)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={13} /> {parseErr}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-1)" }}>
        <button className="btn btn-secondary" onClick={onTemplate} style={{ fontSize: 12 }}>
          <Download size={13} /> Télécharger le modèle CSV
        </button>
        <span style={{ fontSize: 11, color: "var(--text-4)" }}>
          (avec exemple, prêt à remplir)
        </span>
      </div>
    </div>
  );
}

function MappingStep({
  headers,
  rows,
  mapping,
  setMapping,
  targetOptions,
  fieldsByKey,
}: {
  headers: string[];
  rows: string[][];
  mapping: string[];
  setMapping: (m: string[]) => void;
  targetOptions: { key: string; label: string }[];
  fieldsByKey: Map<string, ImportFieldSpec>;
}) {
  const used = new Set(mapping.filter((m) => m !== "ignore"));
  function options(currentIdx: number) {
    return targetOptions.filter(
      (k) => k.key === "ignore" || k.key === mapping[currentIdx] || !used.has(k.key),
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Vérifie que chaque colonne du fichier correspond au bon champ. Les
        champs marqués * sont obligatoires.
      </p>
      <div
        style={{
          border: "1px solid var(--border-1)",
          background: "var(--surface)",
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
            <tr>
              <th style={th}>Colonne du fichier</th>
              <th style={th}>Aperçu</th>
              <th style={{ ...th, width: 240 }}>Mapper vers</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const field = fieldsByKey.get(mapping[i]);
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--border-1)" }}>
                  <td style={td}>
                    <strong style={{ color: "var(--text-1)" }}>
                      {h || `(colonne ${i + 1})`}
                    </strong>
                    {field?.required && (
                      <span style={{ marginLeft: 6, color: "var(--cs-active-tx)", fontSize: 11 }}>
                        obligatoire
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: "var(--text-4)" }}>
                    {rows.slice(0, 2).map((r) => r[i] ?? "").filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td style={td}>
                    <select
                      className="inp"
                      value={mapping[i]}
                      onChange={(e) => {
                        const next = [...mapping];
                        next[i] = e.target.value;
                        setMapping(next);
                      }}
                      style={{ width: "100%" }}
                    >
                      {options(i).map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunStep({
  entityLabelPlural,
  total,
  valid,
  invalid,
  hasRequiredMapping,
}: {
  entityLabelPlural: string;
  total: number;
  valid: number;
  invalid: number;
  hasRequiredMapping: boolean;
}) {
  if (!hasRequiredMapping) {
    return (
      <div style={{ fontSize: 13, color: "var(--rec-tx)" }}>
        Le mapping est incomplet. Reviens à l&apos;étape précédente pour
        associer les champs obligatoires (*).
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Récapitulatif avant import. Les {entityLabelPlural} existants seront
        liés sans doublon.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Stat label="Lignes lues" value={total} />
        <Stat label="Valides" value={valid} tone="ok" />
        <Stat label="Ignorées" value={invalid} tone={invalid > 0 ? "warn" : "neutral"} />
      </div>
    </div>
  );
}

function ResultStep({
  result,
  entityLabelPlural,
}: {
  result: ImportResult;
  entityLabelPlural: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--cs-active-tx)" }}>
        <CheckCircle size={20} />
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Import terminé · {result.created} {entityLabelPlural} créé{result.created > 1 ? "s" : ""}
          {result.matched > 0 && `, ${result.matched} déjà existant${result.matched > 1 ? "s" : ""}`}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        <Stat label="Lignes lues" value={result.total} />
        <Stat label="Créés" value={result.created} tone="ok" />
        <Stat label="Reconnus" value={result.matched} />
        <Stat
          label="Erreurs"
          value={result.errors.length}
          tone={result.errors.length > 0 ? "warn" : "neutral"}
        />
      </div>
      {result.extras && result.extras.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${result.extras.length},1fr)`, gap: 10 }}>
          {result.extras.map((x, i) => (
            <Stat key={i} label={x.label} value={x.value} />
          ))}
        </div>
      )}
      {result.errors.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-3)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: ".5px",
            }}
          >
            Erreurs ({result.errors.length})
          </div>
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              border: "1px solid var(--border-1)",
              background: "var(--surface)",
              padding: 10,
              fontSize: 12,
            }}
          >
            {result.errors.slice(0, 50).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                <span style={{ color: "var(--text-4)", minWidth: 60, fontWeight: 600 }}>
                  Ligne {e.line}
                </span>
                <span style={{ color: "var(--text-2)" }}>{e.reason}</span>
              </div>
            ))}
            {result.errors.length > 50 && (
              <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 6, fontStyle: "italic" }}>
                … {result.errors.length - 50} autres erreurs non affichées
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  const color =
    tone === "ok"
      ? "var(--cs-active-tx)"
      : tone === "warn"
        ? "var(--rec-tx)"
        : "var(--text-1)";
  return (
    <div style={{ border: "1px solid var(--border-1)", background: "var(--surface)", padding: "10px 12px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-4)",
          textTransform: "uppercase",
          letterSpacing: ".5px",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  color: "var(--text-3)",
  textTransform: "uppercase",
  letterSpacing: ".5px",
};
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "middle" };
