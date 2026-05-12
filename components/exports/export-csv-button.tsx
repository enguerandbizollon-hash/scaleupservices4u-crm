"use client";

import { Download } from "lucide-react";
import { downloadCSV, rowsToCSV, timestampedFilename } from "@/lib/export/csv";

export type ExportRow = Record<string, string | number | boolean | null>;

export function ExportCSVButton({
  filenamePrefix,
  rows,
  columns,
  label = "Exporter",
  variant = "secondary",
}: {
  filenamePrefix: string;
  rows: ExportRow[];
  columns: { key: string; label: string }[];
  label?: string;
  variant?: "primary" | "secondary";
}) {
  function go() {
    const csv = rowsToCSV(rows, columns);
    downloadCSV(timestampedFilename(filenamePrefix), csv);
  }
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={go}
      disabled={rows.length === 0}
      title={`Exporter ${rows.length} ligne${rows.length > 1 ? "s" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        borderRadius: 9,
        background: isPrimary ? "#1a56db" : "var(--surface)",
        color: isPrimary ? "#fff" : "var(--text-2)",
        border: isPrimary ? "none" : "1px solid var(--border)",
        cursor: rows.length === 0 ? "not-allowed" : "pointer",
        opacity: rows.length === 0 ? 0.5 : 1,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
      }}
    >
      <Download size={14} /> {label}
    </button>
  );
}
