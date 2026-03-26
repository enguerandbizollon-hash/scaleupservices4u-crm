"use client";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding: "6px 16px", borderRadius: 7, background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
    >
      Imprimer / PDF
    </button>
  );
}
