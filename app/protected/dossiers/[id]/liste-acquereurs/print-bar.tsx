"use client";
// Barre d'impression de la liste d'acquéreurs, masquée à l'impression.

export function PrintBar() {
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#111830", marginBottom: 24 }}>
      <button onClick={() => window.print()}
        style={{ padding: "8px 18px", background: "#7EB3D8", color: "#111830", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Imprimer / PDF
      </button>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
        Liste recalculée en direct depuis le matching : toujours à jour au moment de l&apos;impression.
      </span>
    </div>
  );
}
