/**
 * Liste d'acquéreurs du dossier — rendu imprimable (Deal OS, chantier C).
 *
 * Toujours à jour : la page relance le matching V2 au chargement, aucun
 * stockage. Usage : support de discussion avec le cédant (« voici à qui
 * nous proposons d'aller ») et feuille de route d'approche.
 * Charte Vectis Finance, impression navigateur, zéro dépendance.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAcquirerMatches } from "@/actions/ma-matching";
import { computeFunnelStage } from "@/lib/crm/funnel";
import { funnelStageLabels, organizationTypeLabels } from "@/lib/crm/labels";
import { PrintBar } from "./print-bar";

export const revalidate = 0;

const NAVY = "#192348";
const BLUE = "#7EB3D8";
const SERIF = "Georgia, 'Times New Roman', serif";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type")
    .eq("id", id)
    .maybeSingle();
  if (!deal || deal.deal_type !== "ma_sell") notFound();

  const { matches, error } = await getAcquirerMatches(id, false);
  const scored = matches.filter((m) => m.result.score !== null).slice(0, 20);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F5F7", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .liste-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <PrintBar />

      <div className="liste-sheet" style={{ maxWidth: 860, margin: "0 auto 40px", background: "#fff", boxShadow: "0 2px 14px rgba(17,24,48,.14)" }}>
        <div style={{ background: NAVY, color: "#fff", padding: "24px 36px" }}>
          <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
            Liste d&apos;acquéreurs pressentis · Confidentiel
          </div>
          <h1 style={{ margin: "8px 0 0", fontFamily: SERIF, fontSize: 23, fontWeight: 600 }}>{deal.name}</h1>
          <div style={{ marginTop: 6, fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>
            {scored.length} acquéreur{scored.length > 1 ? "s" : ""} retenu{scored.length > 1 ? "s" : ""} par le scoring Vectis Finance · {new Date().toLocaleDateString("fr-FR")}
          </div>
        </div>

        <div style={{ padding: "26px 36px 34px" }}>
          {error && <div style={{ color: "#991B1B", fontSize: 13 }}>Erreur : {error}</div>}
          {scored.length === 0 && !error && (
            <div style={{ color: "#6B7280", fontSize: 13.5 }}>
              Aucun acquéreur scoré : remplissez les profils acquéreurs de vos organisations (fourchettes, opérations pratiquées, secteurs).
            </div>
          )}
          {scored.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${NAVY}` }}>
                  {["#", "Acquéreur", "Type", "Thèse", "Score", "Étape"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Score" ? "center" : "left", padding: "7px 8px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: NAVY }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scored.map((m, i) => (
                  <tr key={m.org.id} style={{ borderBottom: "1px solid #E3E6EC", pageBreakInside: "avoid" }}>
                    <td style={{ padding: "9px 8px", color: "#9CA3AF", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: "9px 8px", fontWeight: 700, color: NAVY }}>
                      {m.org.name}
                      {m.org.location && <div style={{ fontSize: 11, fontWeight: 400, color: "#6B7280" }}>{m.org.location}</div>}
                    </td>
                    <td style={{ padding: "9px 8px", color: "#4B5563" }}>{organizationTypeLabels[m.org.organization_type] ?? m.org.organization_type}</td>
                    <td style={{ padding: "9px 8px", color: "#4B5563", maxWidth: 260 }}>
                      {m.org.acquirer_summary ?? (m.org.operation_types ?? []).join(", ") ?? ""}
                    </td>
                    <td style={{ padding: "9px 8px", textAlign: "center" }}>
                      <span style={{ fontWeight: 800, color: NAVY }}>{m.result.score}</span>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{m.result.coverage.evaluated}/{m.result.coverage.total} critères</div>
                    </td>
                    <td style={{ padding: "9px 8px", color: "#4B5563" }}>
                      {m.suggestion
                        ? (m.suggestion.status === "rejected" ? "Écarté" : funnelStageLabels[computeFunnelStage(m.suggestion)])
                        : "À qualifier"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "#111830", color: "rgba(255,255,255,.85)", padding: "16px 36px", fontSize: 11.5 }}>
          <strong style={{ color: "#fff" }}>Vectis Finance</strong> · Scores calculés par la grille propriétaire
          (capacité, secteur, type d&apos;opération, appétit, géographie, structure). Document de travail interne, diffusion restreinte.
        </div>
      </div>
    </div>
  );
}

export default function ListeAcquereursPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#6B7280" }}>Calcul du matching…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
