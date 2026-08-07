"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuyMandateTargets, type BuyTarget } from "@/actions/prospection";
import { Crosshair, Loader2, ArrowUpRight } from "lucide-react";

// Vue Cibles d'un mandat d'acquisition (buy-side v75) : les fiches univers
// trouvées par les chasses rattachées à ce mandat. Chaque cible pointe vers
// son tiroir 360 dans Prospection (navigation deux sens). Rendu dans l'onglet
// « sourcing » de la fiche mandat, uniquement pour un deal ma_buy.
export function BuyMandateTargets({ dealId }: { dealId: string }) {
  const [targets, setTargets] = useState<BuyTarget[] | null>(null);

  useEffect(() => {
    let alive = true;
    getBuyMandateTargets(dealId).then((t) => { if (alive) setTargets(t); });
    return () => { alive = false; };
  }, [dealId]);

  const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 };

  if (targets === null) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 8, color: "var(--text-4)", fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Chargement des cibles…
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: targets.length ? 14 : 8 }}>
        <Crosshair size={15} color="#0F766E" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Cibles des chasses rattachées</h3>
        {targets.length > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, background: "var(--surface-3)", color: "var(--text-4)", borderRadius: 20, padding: "2px 9px" }}>{targets.length}</span>
        )}
      </div>

      {targets.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)", margin: 0, lineHeight: 1.6 }}>
          Aucune cible pour l&apos;instant. Analysez la fiche de cadrage ci-dessus (elle prépare la chasse), ou depuis <Link href="/protected/prospection" style={{ color: "#1a56db", fontWeight: 600 }}>Prospection</Link> rattachez une chasse à ce mandat, puis lancez-la : ses résultats apparaîtront ici, les mieux alignés à la fiche d&apos;abord.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {targets.map((t) => (
            <Link key={t.siren} href={`/protected/prospection?fiche=${t.siren}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", textDecoration: "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nom}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[t.secteur, t.ville, t.chasse_name && `via ${t.chasse_name}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              {t.fit_score != null && (
                <span title="Fit à la fiche de cadrage (secteur, taille, géographie)" style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", background: "rgba(99,102,241,.12)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
                  fit {t.fit_score}
                </span>
              )}
              {t.cedabilite_score != null && (
                <span title="Score de cédabilité (radar)" style={{ fontSize: 11, fontWeight: 800, color: "#0F766E", background: "rgba(15,118,110,.12)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
                  radar {Math.round(t.cedabilite_score)}
                </span>
              )}
              <ArrowUpRight size={14} color="var(--text-5)" style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
