/**
 * Teaser anonymisé du dossier — rendu imprimable (Deal OS, chantier C).
 *
 * Pattern export existant : HTML mono-colonne A4, le navigateur imprime en
 * PDF, zéro dépendance. Charte Vectis Finance : navy #192348 / #111830,
 * accent bleu #7EB3D8, design carré (pas d'arrondis), titres serif.
 * Le contenu vient de deals.teaser_content (généré + anonymisé par code).
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TeaserContent } from "@/lib/ai/teaser-engine";
import { TeaserActionsBar } from "./teaser-actions-bar";

export const revalidate = 0;
// La génération IA (server action de cette page) dépasse les 15 s par défaut.
export const maxDuration = 300;

const NAVY = "#192348";
const NAVY_DARK = "#111830";
const BLUE = "#7EB3D8";
const SERIF = "Georgia, 'Times New Roman', serif";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, teaser_content, teaser_generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();

  const teaser = deal.teaser_content as TeaserContent | null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F5F7", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .teaser-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <TeaserActionsBar dealId={deal.id} hasContent={!!teaser} />

      {!teaser ? (
        <div className="no-print" style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", color: "#4B5563", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Aucun teaser généré</div>
          Cliquez sur « Générer le teaser » : l&apos;IA compose une page anonyme à partir du dossier
          (screening, finances, fiche 360), le code retire le nom et le SIREN, vous relisez avant envoi.
        </div>
      ) : (
        <div className="teaser-sheet" style={{
          maxWidth: 760, margin: "0 auto 40px", background: "#fff",
          boxShadow: "0 2px 14px rgba(17,24,48,.14)",
        }}>
          {/* Bandeau */}
          <div style={{ background: NAVY, color: "#fff", padding: "28px 40px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
              Opportunité d&apos;acquisition · Strictement confidentiel
            </div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 27, fontWeight: 600, lineHeight: 1.25 }}>
              {teaser.titre}
            </h1>
            <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.75)" }}>{teaser.localisation}</div>
          </div>

          <div style={{ padding: "30px 40px 36px" }}>
            {/* Accroche */}
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: NAVY_DARK, fontWeight: 500 }}>
              {teaser.accroche}
            </p>

            {/* Chiffres clés */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "#E3E6EC", border: "1px solid #E3E6EC", margin: "24px 0" }}>
              {teaser.chiffres_cles.map((c, i) => (
                <div key={i} style={{ background: "#F7F8FA", padding: "14px 16px" }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: NAVY }}>{c.valeur}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Activité */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              Activité
            </h2>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{teaser.activite}</p>

            {/* Points forts */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              Points forts
            </h2>
            <ul style={{ margin: "0 0 22px", padding: 0, listStyle: "none" }}>
              {teaser.points_forts.map((p, i) => (
                <li key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: "#333", padding: "3px 0 3px 18px", position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: BLUE, fontWeight: 800 }}>■</span>
                  {p}
                </li>
              ))}
            </ul>

            {/* Opération */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              L&apos;opération
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{teaser.operation}</p>
          </div>

          {/* Pied */}
          <div style={{ background: NAVY_DARK, color: "rgba(255,255,255,.85)", padding: "18px 40px", fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: "#fff" }}>Vectis Finance</strong> · Conseil en fusions-acquisitions small cap.
            Pour recevoir l&apos;information mémorandum sous NDA, contactez Enguérand Bizollon.
            <div style={{ marginTop: 4, color: "rgba(255,255,255,.5)" }}>
              Document non contractuel, établi à partir d&apos;informations communiquées par la société. Diffusion restreinte.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeaserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#6B7280" }}>Chargement…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
