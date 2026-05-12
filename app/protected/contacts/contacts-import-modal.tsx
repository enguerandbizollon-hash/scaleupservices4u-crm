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
import {
  importContacts,
  type ImportContactRow,
  type ImportContactsResult,
} from "@/actions/import";
import { downloadCSV, rowsToCSV } from "@/lib/export/csv";

type TargetField =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "title"
  | "sector"
  | "organisation_name"
  | "linkedin_url"
  | "base_status"
  | "notes";

const TARGET_LABELS: Record<TargetField | "ignore", string> = {
  ignore: "— Ignorer cette colonne —",
  first_name: "Prénom *",
  last_name: "Nom *",
  email: "Email",
  phone: "Téléphone",
  title: "Fonction",
  sector: "Secteur",
  organisation_name: "Organisation",
  linkedin_url: "LinkedIn",
  base_status: "Statut",
  notes: "Notes",
};

const ALIASES: Record<TargetField, string[]> = {
  first_name: ["prenom", "firstname", "first name", "first_name", "given name"],
  last_name: [
    "nom",
    "lastname",
    "last name",
    "last_name",
    "surname",
    "family name",
    "nom de famille",
  ],
  email: ["email", "e-mail", "mail", "courriel", "adresse mail"],
  phone: ["telephone", "tel", "mobile", "phone", "gsm", "portable", "numero"],
  title: ["fonction", "titre", "title", "role", "poste", "position", "job title"],
  sector: ["secteur", "sector", "industry", "industrie", "domaine"],
  organisation_name: [
    "organisation",
    "organization",
    "entreprise",
    "company",
    "societe",
    "société",
    "boite",
    "employer",
  ],
  linkedin_url: ["linkedin", "linkedin url", "linkedin_url", "profil linkedin"],
  base_status: ["statut", "status"],
  notes: ["notes", "remarques", "comments", "commentaires", "commentaire"],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-.]/g, "");
}

function autoMap(header: string): TargetField | "ignore" {
  const n = normalize(header);
  for (const [field, aliases] of Object.entries(ALIASES) as [
    TargetField,
    string[],
  ][]) {
    if (aliases.some((a) => normalize(a) === n)) return field;
    if (aliases.some((a) => n.includes(normalize(a)))) return field;
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

function downloadTemplate() {
  const headers: TargetField[] = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "title",
    "sector",
    "organisation_name",
    "linkedin_url",
    "notes",
  ];
  const labelMap: Record<TargetField, string> = {
    first_name: "Prenom",
    last_name: "Nom",
    email: "Email",
    phone: "Telephone",
    title: "Fonction",
    sector: "Secteur",
    organisation_name: "Organisation",
    linkedin_url: "LinkedIn",
    base_status: "Statut",
    notes: "Notes",
  };
  const exampleRow = {
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@example.com",
    phone: "+33 6 12 34 56 78",
    title: "Directeur Financier",
    sector: "Industrie",
    organisation_name: "ACME SAS",
    linkedin_url: "https://linkedin.com/in/jean-dupont",
    notes: "Rencontré au salon BPI",
  };
  const csv = rowsToCSV(
    [exampleRow],
    headers.map((h) => ({ key: h, label: labelMap[h] })),
  );
  downloadCSV("template-import-contacts.csv", csv);
}

type Step = "file" | "mapping" | "run";

export function ContactsImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("file");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(TargetField | "ignore")[]>([]);
  const [parseErr, setParseErr] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportContactsResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setMapping(h.map((header) => autoMap(header)));
      setStep("mapping");
    } catch (e) {
      setParseErr(
        e instanceof Error ? e.message : "Impossible de lire le fichier",
      );
    }
  }

  const validRows = useMemo(() => {
    if (step !== "run") return { valid: [] as ImportContactRow[], invalid: 0 };
    const firstIdx = mapping.indexOf("first_name");
    const lastIdx = mapping.indexOf("last_name");
    if (firstIdx < 0 || lastIdx < 0) return { valid: [], invalid: rows.length };
    const valid: ImportContactRow[] = [];
    let invalid = 0;
    for (const r of rows) {
      const first = (r[firstIdx] ?? "").trim();
      const last = (r[lastIdx] ?? "").trim();
      if (!first || !last) {
        invalid++;
        continue;
      }
      const obj: ImportContactRow = { first_name: first, last_name: last };
      mapping.forEach((target, colIdx) => {
        if (target === "ignore" || target === "first_name" || target === "last_name")
          return;
        const v = (r[colIdx] ?? "").trim();
        if (!v) return;
        obj[target] = v;
      });
      valid.push(obj);
    }
    return { valid, invalid };
  }, [step, mapping, rows]);

  const hasRequiredMapping =
    mapping.includes("first_name") && mapping.includes("last_name");

  async function runImport() {
    setRunning(true);
    try {
      const res = await importContacts(validRows.valid);
      setResult(res);
      onImported();
    } finally {
      setRunning(false);
    }
  }

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
              Importer des contacts
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
        <div
          style={{
            padding: 28,
            overflowY: "auto",
            flex: 1,
          }}
        >
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
            />
          )}
          {step === "run" && !result && (
            <RunStep
              total={rows.length}
              valid={validRows.valid.length}
              invalid={validRows.invalid}
              hasRequiredMapping={hasRequiredMapping}
            />
          )}
          {step === "run" && result && <ResultStep result={result} />}
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep("file")}
                >
                  <ChevronLeft size={14} /> Retour
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep("run")}
                  disabled={!hasRequiredMapping}
                  title={
                    hasRequiredMapping
                      ? ""
                      : "Mappe au minimum Prénom et Nom"
                  }
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
                    : `Importer ${validRows.valid.length} contact${validRows.valid.length > 1 ? "s" : ""}`}
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
        onMouseOver={(e) =>
          (e.currentTarget.style.borderColor = "var(--su-400)")
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.borderColor = "var(--border-2)")
        }
      >
        {filename ? (
          <>
            <FileText
              size={28}
              style={{ color: "var(--su-500)", marginBottom: 8 }}
            />
            <div style={{ fontWeight: 600, fontSize: 13 }}>{filename}</div>
            <div
              style={{ fontSize: 12, color: "var(--text-4)", marginTop: 4 }}
            >
              Cliquer pour choisir un autre fichier
            </div>
          </>
        ) : (
          <>
            <Upload
              size={28}
              style={{ color: "var(--text-4)", marginBottom: 8 }}
            />
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Cliquer pour choisir un fichier
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-4)", marginTop: 4 }}
            >
              ou faire glisser un .csv / .xlsx
            </div>
          </>
        )}
      </div>
      {parseErr && (
        <div
          style={{
            fontSize: 12,
            color: "var(--rec-tx)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertCircle size={13} /> {parseErr}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-1)",
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={onTemplate}
          style={{ fontSize: 12 }}
        >
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
}: {
  headers: string[];
  rows: string[][];
  mapping: (TargetField | "ignore")[];
  setMapping: (m: (TargetField | "ignore")[]) => void;
}) {
  const used = new Set(mapping.filter((m) => m !== "ignore"));
  function options(currentIdx: number) {
    return (Object.keys(TARGET_LABELS) as (TargetField | "ignore")[]).filter(
      (k) =>
        k === "ignore" || k === mapping[currentIdx] || !used.has(k),
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Vérifie que chaque colonne du fichier correspond au bon champ. Prénom
        et Nom sont obligatoires.
      </p>
      <div
        style={{
          border: "1px solid var(--border-1)",
          background: "var(--surface)",
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
            <tr>
              <th style={th}>Colonne du fichier</th>
              <th style={th}>Aperçu</th>
              <th style={{ ...th, width: 220 }}>Mapper vers</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border-1)" }}>
                <td style={td}>
                  <strong style={{ color: "var(--text-1)" }}>
                    {h || `(colonne ${i + 1})`}
                  </strong>
                </td>
                <td style={{ ...td, color: "var(--text-4)" }}>
                  {rows
                    .slice(0, 2)
                    .map((r) => r[i] ?? "")
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td style={td}>
                  <select
                    className="inp"
                    value={mapping[i]}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[i] = e.target.value as TargetField | "ignore";
                      setMapping(next);
                    }}
                    style={{ width: "100%" }}
                  >
                    {options(i).map((k) => (
                      <option key={k} value={k}>
                        {TARGET_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunStep({
  total,
  valid,
  invalid,
  hasRequiredMapping,
}: {
  total: number;
  valid: number;
  invalid: number;
  hasRequiredMapping: boolean;
}) {
  if (!hasRequiredMapping) {
    return (
      <div style={{ fontSize: 13, color: "var(--rec-tx)" }}>
        Le mapping est incomplet. Reviens à l&apos;étape précédente pour
        associer Prénom et Nom.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        Récapitulatif avant import. Les contacts existants (même email) seront
        liés sans doublon. Les organisations citées seront créées si elles
        n&apos;existent pas.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
      >
        <Stat label="Lignes lues" value={total} />
        <Stat label="Valides" value={valid} tone="ok" />
        <Stat label="Ignorées" value={invalid} tone={invalid > 0 ? "warn" : "neutral"} />
      </div>
    </div>
  );
}

function ResultStep({ result }: { result: ImportContactsResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--cs-active-tx)",
        }}
      >
        <CheckCircle size={20} />
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Import terminé · {result.created} créé{result.created > 1 ? "s" : ""}
          {result.matched > 0 && `, ${result.matched} déjà existant${result.matched > 1 ? "s" : ""}`}
        </div>
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}
      >
        <Stat label="Lignes lues" value={result.total} />
        <Stat label="Créés" value={result.created} tone="ok" />
        <Stat label="Reconnus" value={result.matched} />
        <Stat label="Erreurs" value={result.errors.length} tone={result.errors.length > 0 ? "warn" : "neutral"} />
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
      >
        <Stat
          label="Organisations créées"
          value={result.organisations_created}
        />
        <Stat
          label="Contacts liés à une organisation"
          value={result.organisations_linked}
        />
      </div>
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
                <span
                  style={{ color: "var(--text-4)", minWidth: 60, fontWeight: 600 }}
                >
                  Ligne {e.line}
                </span>
                <span style={{ color: "var(--text-2)" }}>{e.reason}</span>
              </div>
            ))}
            {result.errors.length > 50 && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-4)",
                  marginTop: 6,
                  fontStyle: "italic",
                }}
              >
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
    <div
      style={{
        border: "1px solid var(--border-1)",
        background: "var(--surface)",
        padding: "10px 12px",
      }}
    >
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
