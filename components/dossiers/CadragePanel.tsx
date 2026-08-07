"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { extractCadrageAction, applyCadrageToMandate, listCadrageCandidates } from "@/actions/ai/cadrage";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { FileText, Loader2, Sparkles, Check } from "lucide-react";

// Panneau fiche de cadrage (buy-side v76), onglet sourcing d'un mandat ma_buy :
// choisir le PDF du brief repreneur -> l'IA extrait les critères (PROPOSE) ->
// vérifier -> appliquer au dossier + créer la chasse rattachée (DISPOSE).
const fmtEur = (n: number | null) =>
  n == null ? null : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M€` : `${Math.round(n / 1_000)} k€`;

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map((x) => (
        <span key={x} style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 6, background: "var(--surface-3)", color: "var(--text-3)", fontWeight: 600 }}>{x}</span>
      ))}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}>
      <span style={{ minWidth: 96, color: "var(--text-5)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-2)" }}>{children}</span>
    </div>
  );
}

export function CadragePanel({ dealId, initialCadrage }: { dealId: string; initialCadrage: CadrageContent | null }) {
  const [cadrage, setCadrage] = useState<CadrageContent | null>(initialCadrage);
  const [candidates, setCandidates] = useState<{ id: string; file_name: string | null }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    listCadrageCandidates(dealId).then((c) => {
      if (!alive) return;
      setCandidates(c);
      if (c[0]) setSelectedDoc(c[0].id);
    });
    return () => { alive = false; };
  }, [dealId]);

  async function analyze() {
    if (!selectedDoc) return;
    setAnalyzing(true); setMsg(null);
    const res = await extractCadrageAction(selectedDoc);
    setAnalyzing(false);
    if (!res.success || !res.content) { setMsg({ kind: "err", text: res.error ?? "Échec de l'analyse." }); return; }
    setCadrage(res.content);
    setMsg({ kind: "ok", text: "Fiche analysée. Vérifiez les critères ci-dessous, puis appliquez." });
  }

  async function apply() {
    setApplying(true); setMsg(null);
    const res = await applyCadrageToMandate(dealId);
    setApplying(false);
    if (!res.success) { setMsg({ kind: "err", text: res.error ?? "Échec." }); return; }
    setMsg({ kind: "ok", text: `Appliqué : ${res.fields_written ?? 0} critères du dossier, et la chasse rattachée est prête. Lancez-la depuis Prospection.` });
  }

  const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <FileText size={15} color="#6366F1" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Fiche de cadrage</h3>
        <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>le brief du repreneur pilote la recherche de cible</span>
      </div>

      {candidates.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)", margin: 0, lineHeight: 1.6 }}>
          Uploadez la fiche de cadrage (PDF) dans l&apos;onglet <strong>Documents</strong> de ce mandat, puis revenez ici pour l&apos;analyser.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", maxWidth: 320 }}>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.file_name ?? "Document PDF"}</option>)}
          </select>
          <button type="button" onClick={analyze} disabled={analyzing || !selectedDoc}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "#6366F1", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: analyzing || !selectedDoc ? 0.6 : 1 }}>
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {analyzing ? "Analyse…" : cadrage ? "Ré-analyser" : "Analyser la fiche"}
          </button>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, background: msg.kind === "ok" ? "#D1FAE5" : "#FEE2E2", color: msg.kind === "ok" ? "#065F46" : "#991B1B" }}>
          {msg.text}
        </div>
      )}

      {cadrage && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {cadrage.repreneur_nom && <Line label="Repreneur">{cadrage.repreneur_nom}</Line>}
          {cadrage.secteurs.length > 0 && <Line label="Secteurs"><Chips items={cadrage.secteurs} /></Line>}
          {cadrage.naf_codes.length > 0 && <Line label="NAF"><Chips items={cadrage.naf_codes} /></Line>}
          {(cadrage.ca_min != null || cadrage.ca_max != null) && (
            <Line label="CA cible">{[fmtEur(cadrage.ca_min), fmtEur(cadrage.ca_max)].filter(Boolean).join(" à ")}</Line>
          )}
          {(cadrage.departements.length > 0 || cadrage.regions.length > 0) && (
            <Line label="Géographie">{[...cadrage.departements, ...cadrage.regions].join(", ")}</Line>
          )}
          {(cadrage.dirigeant_age_min != null || cadrage.dirigeant_age_max != null) && (
            <Line label="Âge dirigeant">{[cadrage.dirigeant_age_min, cadrage.dirigeant_age_max].filter((v) => v != null).join(" à ")} ans</Line>
          )}
          {cadrage.full_acquisition != null && <Line label="Opération">{cadrage.full_acquisition ? "Majoritaire / achat de titres" : "Minoritaire"}</Line>}
          {cadrage.apport != null && <Line label="Apport">{fmtEur(cadrage.apport)}</Line>}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={apply} disabled={applying}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#0F766E", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: applying ? 0.6 : 1 }}>
              {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Appliquer au dossier et préparer la chasse
            </button>
            <Link href="/protected/prospection" style={{ fontSize: 12, color: "var(--text-4)", textDecoration: "none" }}>
              Aller lancer la chasse →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
