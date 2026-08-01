import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Handshake, Plus, ChevronRight, FolderOpen } from "lucide-react";
import { ACQUIRER_BUYER_TYPES } from "@/lib/crm/acquirer-scoring";
import { organizationTypeLabels } from "@/lib/crm/labels";
import { OPERATION_TYPES, DEAL_STANCES } from "@/lib/crm/matching-maps";

export const revalidate = 0;

// La base d'acquéreurs : LE réservoir que le matching (grille phase 3) score
// contre chaque mandat de cession. Cette page rend visible ce qui était
// enfoui dans un onglet de dossier : qui est dans la base, quels profils
// sont exploitables par la grille, et où le matching s'ouvre.

type AcqRow = {
  id: string;
  name: string;
  organization_type: string;
  sector: string | null;
  location: string | null;
  base_status: string | null;
  target_sectors: string[] | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  operation_types: string[] | null;
  deal_stance: string | null;
  acquirer_summary: string | null;
};

const fmtM = (v: number | null) => {
  if (v == null) return null;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} k€`;
  return `${v} €`;
};

/** Les 4 critères que la grille de scoring sait exploiter. */
function completude(o: AcqRow): { rempli: number; manques: string[] } {
  const manques: string[] = [];
  if (o.target_ebitda_min == null && o.target_ebitda_max == null && o.target_revenue_min == null && o.target_revenue_max == null) {
    manques.push("fourchette CA/EBITDA");
  }
  if (!o.target_sectors || o.target_sectors.length === 0) manques.push("secteurs cibles");
  if (!o.operation_types || o.operation_types.length === 0) manques.push("opérations pratiquées");
  if (!o.deal_stance) manques.push("posture majoritaire/minoritaire");
  return { rempli: 4 - manques.length, manques };
}

async function Content() {
  const supabase = await createClient();

  const [acqRes, dealsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,organization_type,sector,location,base_status,target_sectors,target_revenue_min,target_revenue_max,target_ebitda_min,target_ebitda_max,operation_types,deal_stance,acquirer_summary")
      .in("organization_type", ACQUIRER_BUYER_TYPES)
      .order("name", { ascending: true }),
    supabase
      .from("deals")
      .select("id,name,sector,deal_context")
      .eq("deal_type", "ma_sell")
      .eq("deal_status", "open")
      .order("created_at", { ascending: false }),
  ]);

  const acquereurs = (acqRes.data ?? []) as AcqRow[];
  const mandats = dealsRes.data ?? [];

  const actifs = acquereurs.filter(a => !["inactive", "excluded"].includes(a.base_status ?? ""));
  const complets = actifs.filter(a => completude(a).rempli === 4).length;
  const parFamille = ACQUIRER_BUYER_TYPES
    .map(t => ({ type: t, n: actifs.filter(a => a.organization_type === t).length }))
    .filter(f => f.n > 0);

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
  };

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 9 }}>
              <Handshake size={20} color="#3730A3" /> Acquéreurs
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-4)" }}>
              La base que le matching score contre chaque mandat de cession. Elle se nourrit de trois gestes :
              « Marquer acquéreur » en prospection, approbation d&apos;une suggestion de sourcing, création manuelle.
            </p>
          </div>
          <Link href="/protected/organisations/nouveau"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "#3730A3", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
            <Plus size={14} /> Nouvel acquéreur
          </Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, margin: "16px 0" }}>
          <div style={{ ...card, padding: "10px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)" }}>{actifs.length}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Acquéreurs actifs</div>
          </div>
          <div style={{ ...card, padding: "10px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: complets > 0 ? "#065F46" : "#B45309" }}>{complets}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Profils complets</div>
            <div style={{ fontSize: 10.5, color: "var(--text-5)" }}>les 4 critères de la grille remplis</div>
          </div>
          {parFamille.map(f => (
            <div key={f.type} style={{ ...card, padding: "10px 14px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-2)" }}>{f.n}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{organizationTypeLabels[f.type]}</div>
            </div>
          ))}
        </div>

        {/* Mandats de cession : là où le matching s'ouvre */}
        {mandats.length > 0 && (
          <div style={{ ...card, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Matching par mandat de cession
            </div>
            {mandats.map((d, i) => (
              <Link key={d.id} href={`/protected/dossiers/${d.id}?tab=acquereurs`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: i < mandats.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <FolderOpen size={14} color="var(--sell-tx)" />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }}>{d.name}</span>
                {d.sector && <span style={{ fontSize: 12, color: "var(--text-4)" }}>{d.sector}</span>}
                {!d.deal_context && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#FEF3C7", color: "#92400E" }}>
                    contexte à renseigner
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 700, color: "#3730A3" }}>
                  Classement des acquéreurs <ChevronRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Liste des acquéreurs */}
        {acquereurs.length === 0 ? (
          <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
              Aucun acquéreur dans la base
            </div>
            <div style={{ fontSize: 13, color: "var(--text-5)", maxWidth: 520, margin: "0 auto 18px", lineHeight: 1.6 }}>
              Trois façons de la remplir : ouvrir une fiche en prospection et cliquer
              « Marquer acquéreur » (consolidateurs repérés au BODACC), approuver une suggestion
              dans l&apos;onglet Sourcing d&apos;un mandat, ou créer l&apos;organisation à la main
              et remplir son profil acquéreur.
            </div>
            <Link href="/protected/organisations/nouveau"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "#3730A3", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> Créer le premier acquéreur
            </Link>
          </div>
        ) : (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              {acquereurs.length} acquéreur{acquereurs.length > 1 ? "s" : ""}
            </div>
            {acquereurs.map((o, i) => {
              const c = completude(o);
              const stance = o.deal_stance ? DEAL_STANCES.find(s => s.value === o.deal_stance)?.label : null;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < acquereurs.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/protected/organisations/${o.id}`}
                        style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}>
                        {o.name}
                      </Link>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: "#EEF2FF", color: "#3730A3" }}>
                        {organizationTypeLabels[o.organization_type] ?? o.organization_type}
                      </span>
                      {["inactive", "excluded"].includes(o.base_status ?? "") && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-5)" }}>
                          Inactif (hors matching)
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 11.5, color: "var(--text-5)", flexWrap: "wrap" }}>
                      {o.sector && <span>{o.sector}</span>}
                      {o.location && <span>{o.location}</span>}
                      {(o.target_ebitda_min != null || o.target_ebitda_max != null) && (
                        <span>EBITDA cible {fmtM(o.target_ebitda_min) ?? "?"} à {fmtM(o.target_ebitda_max) ?? "?"}</span>
                      )}
                      {o.target_ebitda_min == null && o.target_ebitda_max == null && (o.target_revenue_min != null || o.target_revenue_max != null) && (
                        <span>CA cible {fmtM(o.target_revenue_min) ?? "?"} à {fmtM(o.target_revenue_max) ?? "?"}</span>
                      )}
                      {(o.operation_types?.length ?? 0) > 0 && (
                        <span>{o.operation_types!.map(t => OPERATION_TYPES.find(x => x.value === t)?.label ?? t).join(", ")}</span>
                      )}
                      {stance && <span>{stance}</span>}
                    </div>
                  </div>
                  {c.rempli === 4 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#D1FAE5", color: "#065F46", flexShrink: 0 }}>
                      Profil complet
                    </span>
                  ) : (
                    <Link href={`/protected/organisations/${o.id}/modifier`}
                      title={`Manque : ${c.manques.join(", ")}`}
                      style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#FEF3C7", color: "#92400E", textDecoration: "none", flexShrink: 0 }}>
                      À compléter ({c.rempli}/4)
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcquereursPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content />
    </Suspense>
  );
}
