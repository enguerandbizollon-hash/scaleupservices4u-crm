"use client";
// Barre d'actions du teaser : générer/régénérer (IA) et imprimer en PDF.
// Masquée à l'impression.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateTeaser } from "@/actions/livrables";

export function TeaserActionsBar({ dealId, hasContent }: { dealId: string; hasContent: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await generateTeaser(dealId);
    setBusy(false);
    if (res.success) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="no-print" style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "12px 16px", background: "#111830", marginBottom: 24,
    }}>
      <button onClick={handleGenerate} disabled={busy}
        style={{ padding: "8px 18px", background: "#7EB3D8", color: "#111830", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Génération en cours..." : hasContent ? "Régénérer le teaser" : "Générer le teaser"}
      </button>
      {hasContent && (
        <button onClick={() => window.print()}
          style={{ padding: "8px 18px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Imprimer / PDF
        </button>
      )}
      <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
        Document anonymisé : le nom de la société et le SIREN sont retirés par le code après génération. Relisez avant tout envoi.
      </span>
      {error && <span style={{ width: "100%", fontSize: 12.5, color: "#FCA5A5" }}>{error}</span>}
    </div>
  );
}
