/**
 * Liste de cibles du mandat d'acquisition — rendu imprimable.
 *
 * Pendant buy de la liste acquéreurs (cession) : le document de travail à
 * partager avec le repreneur client. Les cibles SUIVIES du mandat avec leur
 * étape d'approche (funnel role target), leur fit et leur relance. Document
 * INTERNE : nominatif, ne se diffuse pas aux cédants. Charte Vectis Finance,
 * impression navigateur, zéro dépendance.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeFunnelStage, funnelStageLabel } from "@/lib/crm/funnel";
import { ListeCiblesBar } from "./liste-cibles-bar";

export const revalidate = 0;

const NAVY = "#192348";
const NAVY_DARK = "#111830";
const BLUE = "#7EB3D8";
const SERIF = "Georgia, 'Times New Roman', serif";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, deal_type, dirigeant_nom")
    .eq("id", id)
    .maybeSingle();
  if (!deal || deal.deal_type !== "ma_buy") notFound();

  const { data: rows } = await supabase
    .from("deal_target_suggestions")
    .select(`
      id, status, score_algo, intent_score,
      teaser_sent_at, nda_signed_at, im_sent_at, offer_received_at, next_followup_at,
      organizations(name, sector, location)
    `)
    .eq("deal_id", id)
    .eq("role_suggested", "target")
    .neq("status", "rejected")
    .order("created_at", { ascending: true });

  const cibles = (rows ?? []).map((r) => {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as
      | { name?: string | null; sector?: string | null; location?: string | null }
      | null;
    const stage = computeFunnelStage({
      status: r.status as string,
      teaser_sent_at: r.teaser_sent_at,
      nda_signed_at: r.nda_signed_at,
      im_sent_at: r.im_sent_at,
      offer_received_at: r.offer_received_at,
    });
    const stageDate = r.offer_received_at ?? r.im_sent_at ?? r.nda_signed_at ?? r.teaser_sent_at;
    return {
      id: r.id as string,
      nom: org?.name ?? "Organisation",
      secteur: org?.sector ?? null,
      localisation: org?.location ?? null,
      etape: funnelStageLabel(stage, "target"),
      etapeDate: stageDate as string | null,
      relance: r.next_followup_at as string | null,
      fit: r.score_algo as number | null,
      intention: r.intent_score as number | null,
    };
  });

  const today = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  return (
    <div style={{ minHeight: "100vh", background: "#F4F5F7", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .liste-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <ListeCiblesBar />

      <div className="liste-sheet" style={{
        maxWidth: 860, margin: "0 auto 40px", background: "#fff",
        boxShadow: "0 2px 14px rgba(17,24,48,.14)",
      }}>
        {/* Bandeau */}
        <div style={{ background: NAVY, color: "#fff", padding: "26px 40px" }}>
          <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
            Mandat de recherche · Document de travail confidentiel
          </div>
          <h1 style={{ margin: "10px 0 0", fontFamily: SERIF, fontSize: 25, fontWeight: 600, lineHeight: 1.25 }}>
            Cibles suivies : {deal.name}
          </h1>
          <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.75)" }}>
            {cibles.length} cible{cibles.length > 1 ? "s" : ""} au {today}
          </div>
        </div>

        <div style={{ padding: "26px 40px 34px" }}>
          {cibles.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#4B5563", lineHeight: 1.6 }}>
              Aucune cible suivie pour l&apos;instant. Suivez des cibles depuis l&apos;onglet Cibles du mandat : elles apparaîtront ici avec leur étape d&apos;approche.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["Cible", "Secteur", "Localisation", "Étape", "Le", "Relance", "Fit", "Intention"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", background: "#F0F2F6", color: NAVY, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: `2px solid ${BLUE}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cibles.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #E7E9EF" }}>
                    <td style={{ padding: "9px 10px", fontWeight: 700, color: NAVY_DARK }}>{c.nom}</td>
                    <td style={{ padding: "9px 10px", color: "#444" }}>{c.secteur ?? ""}</td>
                    <td style={{ padding: "9px 10px", color: "#444" }}>{c.localisation ?? ""}</td>
                    <td style={{ padding: "9px 10px", color: NAVY, fontWeight: 600 }}>{c.etape}</td>
                    <td style={{ padding: "9px 10px", color: "#666" }}>{fmtDate(c.etapeDate)}</td>
                    <td style={{ padding: "9px 10px", color: "#666" }}>{fmtDate(c.relance)}</td>
                    <td style={{ padding: "9px 10px", color: "#444" }}>{c.fit != null ? Math.round(c.fit) : ""}</td>
                    <td style={{ padding: "9px 10px", color: "#444" }}>{c.intention != null ? Math.round(c.intention) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pied */}
        <div style={{ background: NAVY_DARK, color: "rgba(255,255,255,.85)", padding: "16px 40px", fontSize: 12, lineHeight: 1.6 }}>
          <strong style={{ color: "#fff" }}>Vectis Finance</strong> · Conseil en fusions-acquisitions small cap.
          <div style={{ marginTop: 4, color: "rgba(255,255,255,.5)" }}>
            Document de travail interne au mandat{deal.dirigeant_nom ? ` de ${deal.dirigeant_nom}` : ""}. Ne pas diffuser aux entreprises approchées.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListeCiblesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#6B7280" }}>Chargement…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
