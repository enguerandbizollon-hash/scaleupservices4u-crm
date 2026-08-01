/**
 * Information Memorandum du dossier — rendu imprimable (plan R1 lot 6).
 *
 * Pattern teaser : HTML mono-colonne A4, le navigateur imprime en PDF,
 * zéro dépendance. Charte Vectis Finance : navy #192348 / #111830, accent
 * bleu #7EB3D8, design carré, titres serif. Différence clé avec le
 * teaser : l'IM est NOMINATIF et post-NDA, bandeau de confidentialité
 * en tête, projections signalées.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { IMContent } from "@/lib/ai/im-engine";
import { ImActionsBar } from "./im-actions-bar";

export const revalidate = 0;
// La génération IA (server action de cette page) dépasse les 15 s par défaut.
export const maxDuration = 300;

const NAVY = "#192348";
const NAVY_DARK = "#111830";
const BLUE = "#7EB3D8";
const SERIF = "Georgia, 'Times New Roman', serif";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
      {children}
    </h2>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.7, color: "#333", whiteSpace: "pre-wrap" }}>{children}</p>;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, im_content, im_generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!deal || deal.deal_type !== "ma_sell") notFound();

  const im = deal.im_content as IMContent | null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F5F7", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .im-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <ImActionsBar dealId={deal.id} hasContent={!!im} />

      {!im ? (
        <div className="no-print" style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", color: "#4B5563", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Aucun IM généré</div>
          Cliquez sur « Générer l&apos;IM » : l&apos;IA compose le mémorandum à partir du dossier
          (screening, finances réelles ET projections, synthèse 360). L&apos;IM est nominatif :
          il ne se diffuse qu&apos;après signature du NDA, marquée sur la carte acquéreur.
        </div>
      ) : (
        <div className="im-sheet" style={{
          maxWidth: 760, margin: "0 auto 40px", background: "#fff",
          boxShadow: "0 2px 14px rgba(17,24,48,.14)",
        }}>
          {/* Bandeau */}
          <div style={{ background: NAVY, color: "#fff", padding: "28px 40px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
              Confidentiel · Diffusion sous NDA uniquement
            </div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>
              {im.titre}
            </h1>
            {deal.im_generated_at && (
              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,.6)" }}>
                Établi le {new Date(deal.im_generated_at).toLocaleDateString("fr-FR")}
              </div>
            )}
          </div>

          <div style={{ padding: "30px 40px 36px" }}>
            {/* Résumé */}
            <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.65, color: NAVY_DARK, fontWeight: 500 }}>
              {im.resume}
            </p>

            {/* Chiffres clés */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "#E3E6EC", border: "1px solid #E3E6EC", margin: "0 0 26px" }}>
              {im.chiffres_cles.map((c, i) => (
                <div key={i} style={{ background: "#F7F8FA", padding: "14px 16px" }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: NAVY }}>{c.valeur}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>{c.label}</div>
                </div>
              ))}
            </div>

            <SectionTitle>La société</SectionTitle>
            <Paragraph>{im.societe_historique}</Paragraph>

            <SectionTitle>Activité et modèle</SectionTitle>
            <Paragraph>{im.activite_modele}</Paragraph>

            <SectionTitle>Marché et position</SectionTitle>
            <Paragraph>{im.marche_position}</Paragraph>

            <SectionTitle>Éléments financiers</SectionTitle>
            <Paragraph>{im.finances_commentees}</Paragraph>

            <SectionTitle>Management et organisation</SectionTitle>
            <Paragraph>{im.management_organisation}</Paragraph>

            <SectionTitle>Forces</SectionTitle>
            <ul style={{ margin: "0 0 22px", padding: 0, listStyle: "none" }}>
              {im.forces.map((p, i) => (
                <li key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: "#333", padding: "3px 0 3px 18px", position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: BLUE, fontWeight: 800 }}>■</span>
                  {p}
                </li>
              ))}
            </ul>

            {im.points_attention.length > 0 && (
              <>
                <SectionTitle>Points d&apos;attention</SectionTitle>
                <ul style={{ margin: "0 0 22px", padding: 0, listStyle: "none" }}>
                  {im.points_attention.map((p, i) => (
                    <li key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: "#333", padding: "3px 0 3px 18px", position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "#B45309", fontWeight: 800 }}>■</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <SectionTitle>L&apos;opération envisagée</SectionTitle>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "#333", whiteSpace: "pre-wrap" }}>{im.operation_envisagee}</p>
          </div>

          {/* Pied */}
          <div style={{ background: NAVY_DARK, color: "rgba(255,255,255,.85)", padding: "18px 40px", fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: "#fff" }}>Vectis Finance</strong> · Conseil en fusions-acquisitions small cap.
            <div style={{ marginTop: 4, color: "rgba(255,255,255,.5)" }}>
              Document strictement confidentiel remis sous NDA, établi à partir d&apos;informations communiquées par la société.
              Les projections sont indicatives et ne constituent pas un engagement. Diffusion restreinte.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#6B7280" }}>Chargement…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
