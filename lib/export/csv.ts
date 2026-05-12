/**
 * Util CSV : génération + téléchargement côté client.
 * BOM UTF-8 ajouté pour qu'Excel ouvre correctement les caractères accentués.
 */

export type CSVColumn<T> = {
  key: string;
  label: string;
  format?: (row: T) => string | number | boolean | null | undefined;
};

export function rowsToCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.format
          ? c.format(row)
          : (row as Record<string, unknown>)[c.key];
        return escapeCSV(v);
      })
      .join(","),
  );
  return [header, ...lines].join("\r\n");
}

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function timestampedFilename(prefix: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${yyyy}${mm}${dd}.csv`;
}

export function exportRowsAsCSV<T>(
  filenamePrefix: string,
  rows: T[],
  columns: CSVColumn<T>[],
): void {
  const csv = rowsToCSV(rows, columns);
  downloadCSV(timestampedFilename(filenamePrefix), csv);
}
