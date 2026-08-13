/**
 * Profil de reprise anonyme du mandat d'acquisition — rendu imprimable.
 *
 * Pendant du teaser (cession) : une page qui présente le REPRENEUR et son
 * projet au dirigeant d'une cible approchée, sans révéler son identité.
 * Pattern export existant : HTML mono-colonne A4, le navigateur imprime en
 * PDF, zéro dépendance. Charte Vectis Finance : navy #192348 / #111830,
 * accent bleu #7EB3D8, design carré (pas d'arrondis), titres serif.
 * Le contenu vient de deals.profil_reprise_content (généré + anonymisé).
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfilRepriseContent } from "@/lib/ai/profil-reprise-engine";
import { ProfilRepriseActionsBar } from "./profil-reprise-actions-bar";

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
    .select("id, name, deal_type, profil_reprise_content, profil_reprise_generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!deal || deal.deal_type !== "ma_buy") notFound();

  const profil = deal.profil_reprise_content as ProfilRepriseContent | null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F5F7", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .profil-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <ProfilRepriseActionsBar dealId={deal.id} hasContent={!!profil} />

      {!profil ? (
        <div className="no-print" style={{ maxWidth: 640, margin: "60px auto", textAlign: "center", color: "#4B5563", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Aucun profil de reprise généré</div>
          Cliquez sur « Générer le profil » : l&apos;IA compose une page anonyme à partir du mandat
          (projet, critères, capacité financière), le code retire le nom du repreneur, vous relisez avant envoi.
        </div>
      ) : (
        <div className="profil-sheet" style={{
          maxWidth: 760, margin: "0 auto 40px", background: "#fff",
          boxShadow: "0 2px 14px rgba(17,24,48,.14)",
        }}>
          {/* Bandeau */}
          <div style={{ background: NAVY, color: "#fff", padding: "28px 40px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
              Projet de reprise · Strictement confidentiel
            </div>
            <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 27, fontWeight: 600, lineHeight: 1.25 }}>
              {profil.titre}
            </h1>
          </div>

          <div style={{ padding: "30px 40px 36px" }}>
            {/* Accroche */}
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: NAVY_DARK, fontWeight: 500 }}>
              {profil.accroche}
            </p>

            {/* Critères de la cible recherchée */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "#E3E6EC", border: "1px solid #E3E6EC", margin: "24px 0" }}>
              {profil.criteres.map((c, i) => (
                <div key={i} style={{ background: "#F7F8FA", padding: "14px 16px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>{c.valeur}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Le repreneur */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              Le repreneur
            </h2>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{profil.profil}</p>

            {/* Le projet */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              Le projet
            </h2>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{profil.projet}</p>

            {/* Capacité financière */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              Capacité financière
            </h2>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{profil.capacite}</p>

            {/* La démarche */}
            <h2 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: NAVY, margin: "0 0 8px", borderBottom: `2px solid ${BLUE}`, paddingBottom: 6 }}>
              La démarche
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{profil.demarche}</p>
          </div>

          {/* Pied */}
          <div style={{ background: NAVY_DARK, color: "rgba(255,255,255,.85)", padding: "18px 40px", fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: "#fff" }}>Vectis Finance</strong> · Conseil en fusions-acquisitions small cap.
            Pour un échange confidentiel et sans engagement, contactez Enguérand Bizollon.
            <div style={{ marginTop: 4, color: "rgba(255,255,255,.5)" }}>
              Document non contractuel. L&apos;identité du repreneur est communiquée après premier échange, sous accord de confidentialité.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilReprisePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#6B7280" }}>Chargement…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
