"use client";
// Barre d'actions de la liste de cibles : impression PDF. Masquée à l'impression.

export function ListeCiblesBar() {
  return (
    <div className="no-print" style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px", background: "#111830", marginBottom: 24,
    }}>
      <button onClick={() => window.print()}
        style={{ padding: "8px 18px", background: "#7EB3D8", color: "#111830", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Imprimer / PDF
      </button>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
        Document de travail nominatif, à partager avec le repreneur client uniquement.
      </span>
    </div>
  );
}
