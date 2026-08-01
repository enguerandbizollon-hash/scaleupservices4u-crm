/**
 * Page d'export d'un dossier — version imprimable optimisée pour PDF.
 *
 * Ouverte via le bouton "Exporter PDF" sur la fiche dossier. Si l'URL
 * contient `?print=1`, déclenche automatiquement `window.print()` côté
 * client. Sinon on affiche un bandeau avec un bouton manuel.
 *
 * Convention :
 *   - Rendu mono-colonne A4 portrait
 *   - Header avec nom du dossier, type, stade, montant cible
 *   - Sections : Synthèse, Données financières N/N-1/N-2, Pipeline /
 *     Investisseurs, Activité récente, Honoraires
 *
 * Pas de Server Action ni de génération côté backend : le rendu HTML
 * brut est imprimé par le navigateur, ce qui produit un PDF propre
 * sans dépendance externe.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stageLabel } from "@/lib/crm/matching-maps";
import { roleInDossierLabels } from "@/lib/crm/labels";
import { ExportPrintBootstrap } from "./export-print-bootstrap";

const DEAL_TYPE_LABEL: Record<string, string> = {
  ma_sell:     "Cession (sell-side)",
  ma_buy:      "Acquisition (buy-side)",
};

function fmtMoney(n: number | null | undefined, c: string | null | undefined): string {
  if (n == null) return "—";
  const cur = c ?? "EUR";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M ${cur}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k ${cur}`;
  return `${Math.round(n)} ${cur}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

interface FinancialRow {
  fiscal_year: number;
  currency: string | null;
  revenue: number | null;
  gross_margin: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  net_debt: number | null;
  arr: number | null;
  mrr: number | null;
  nrr: number | null;
  headcount: number | null;
}

async function Content({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  const autoPrint = print === "1";

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(`
      id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,
      description,start_date,target_date,target_amount,currency,
      executive_summary,motivation_narrative,key_differentiators,key_risks,
      asking_price_min,asking_price_max,deal_timing,strategic_rationale,
      ai_valuation_low,ai_valuation_high,ai_financial_notes,
      organization_id,
      estimated_fee_amount,confirmed_fee_amount,retainer_monthly,
      success_fee_percent,operation_amount,close_date,
      dirigeant_nom,dirigeant_email,dirigeant_telephone,dirigeant_titre
    `)
    .eq("id", id)
    .maybeSingle();

  if (!deal) notFound();

  const clientOrg = deal.organization_id
    ? (await supabase.from("organizations").select("id,name,sector,location,website").eq("id", deal.organization_id).maybeSingle()).data
    : null;

  const [orgsRes, financialRes, recentActsRes] = await Promise.all([
    supabase.from("deal_organizations")
      .select("organization_id,role_in_dossier,organizations(id,name,organization_type,base_status,location)")
      .eq("deal_id", id),
    supabase.from("financial_data")
      .select("fiscal_year,currency,revenue,gross_margin,ebitda,ebitda_margin,net_debt,arr,mrr,nrr,headcount")
      .eq("deal_id", id)
      .order("fiscal_year", { ascending: false })
      .limit(3),
    supabase.from("actions")
      .select("id,title,type,due_date,start_datetime,status")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const orgs = (orgsRes.data ?? []).map(r => {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations as { id: string; name: string; organization_type: string | null; location: string | null } | null;
    return o ? { ...o, role_in_dossier: (r as { role_in_dossier?: string }).role_in_dossier ?? "autre" } : null;
  }).filter((o): o is { id: string; name: string; organization_type: string | null; location: string | null; role_in_dossier: string } => o !== null);

  const financials = (financialRes.data ?? []) as FinancialRow[];
  const acts = (recentActsRes.data ?? []) as Array<{ id: string; title: string; type: string; due_date: string | null; start_datetime: string | null; status: string }>;

  const isMaSell      = deal.deal_type === "ma_sell";
  const isMaBuy       = deal.deal_type === "ma_buy";

  return (
    <>
      <ExportPrintBootstrap autoPrint={autoPrint} dealName={deal.name} />

      {/* Bandeau actions (caché à l'impression) */}
      <div className="print-hide" style={{ background:"#f9fafb", borderBottom:"1px solid #e5e7eb", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <a href={`/protected/dossiers/${id}`} style={{ color:"#3468B0", textDecoration:"none", fontSize:13 }}>← Retour au dossier</a>
          <span style={{ color:"#6b7280", fontSize:12 }}>Aperçu PDF</span>
        </div>
        <button id="trigger-print" style={{ padding:"7px 18px", borderRadius:6, background:"#1a56db", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      {/* Contenu A4 */}
      <article className="export-doc" style={{
        maxWidth: "210mm", margin: "0 auto", padding: "20mm 18mm",
        background: "#fff", color: "#1f2937", fontFamily: "DM Sans, Inter, sans-serif",
        fontSize: 11.5, lineHeight: 1.5,
      }}>

        {/* En-tête */}
        <header style={{ borderBottom: "2px solid #1f2937", paddingBottom: 12, marginBottom: 18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>
                Synthèse dossier — {DEAL_TYPE_LABEL[deal.deal_type] ?? deal.deal_type}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a", fontFamily: "Cormorant Garamond, serif" }}>
                {deal.name}
              </h1>
              {clientOrg && (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>
                  Client : <strong>{clientOrg.name}</strong>
                  {clientOrg.location ? ` · ${clientOrg.location}` : ""}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 11 }}>
              <div style={{ color:"#6b7280" }}>Stade actuel</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{stageLabel(deal.deal_stage)}</div>
              {deal.target_amount && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ color:"#6b7280" }}>Objectif</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color:"#1a56db" }}>{fmtMoney(deal.target_amount, deal.currency)}</div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Bloc 1 — Synthèse */}
        {(deal.executive_summary || deal.description) && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Synthèse
            </h2>
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{deal.executive_summary ?? deal.description}</p>
          </section>
        )}

        {/* Bloc 2 — Différenciateurs + risques */}
        {((deal.key_differentiators?.length ?? 0) > 0 || (deal.key_risks?.length ?? 0) > 0) && (
          <section style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {(deal.key_differentiators?.length ?? 0) > 0 && (
              <div>
                <h2 style={{ fontSize: 12, fontWeight: 700, color: "#15803d", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Différenciateurs
                </h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(deal.key_differentiators ?? []).map((k: string, i: number) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
            {(deal.key_risks?.length ?? 0) > 0 && (
              <div>
                <h2 style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Points d'attention
                </h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(deal.key_risks ?? []).map((k: string, i: number) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Bloc 3 — Données financières N/N-1/N-2 */}
        {financials.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Données financières
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                  <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700 }}>Métrique</th>
                  {financials.map(f => (
                    <th key={f.fiscal_year} style={{ textAlign: "right", padding: "5px 6px", fontWeight: 700 }}>FY {f.fiscal_year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "revenue", label: "Revenue", format: (r: FinancialRow) => fmtMoney(r.revenue, r.currency) },
                  { key: "gross_margin", label: "Marge brute", format: (r: FinancialRow) => fmtPct(r.gross_margin) },
                  { key: "ebitda", label: "EBITDA", format: (r: FinancialRow) => fmtMoney(r.ebitda, r.currency) },
                  { key: "ebitda_margin", label: "Marge EBITDA", format: (r: FinancialRow) => fmtPct(r.ebitda_margin) },
                  { key: "net_debt", label: "Dette nette", format: (r: FinancialRow) => fmtMoney(r.net_debt, r.currency) },
                  { key: "arr", label: "ARR", format: (r: FinancialRow) => fmtMoney(r.arr, r.currency) },
                  { key: "nrr", label: "NRR", format: (r: FinancialRow) => fmtPct(r.nrr) },
                  { key: "headcount", label: "Effectifs", format: (r: FinancialRow) => r.headcount?.toString() ?? "—" },
                ].filter(row => financials.some(f => (f as unknown as Record<string, unknown>)[row.key] != null))
                  .map(row => (
                    <tr key={row.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "4px 6px", color: "#6b7280" }}>{row.label}</td>
                      {financials.map(f => (
                        <td key={f.fiscal_year} style={{ textAlign: "right", padding: "4px 6px" }}>{row.format(f)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Bloc 4 — Spécifiques par deal_type */}
        {isMaSell && (deal.asking_price_min || deal.asking_price_max || deal.ai_valuation_low) && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Valorisation
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {deal.asking_price_min && <KpiBox label="Asking min" value={fmtMoney(deal.asking_price_min, deal.currency)} />}
              {deal.asking_price_max && <KpiBox label="Asking max" value={fmtMoney(deal.asking_price_max, deal.currency)} />}
              {deal.ai_valuation_low && <KpiBox label="Valorisation IA basse" value={fmtMoney(deal.ai_valuation_low, deal.currency)} />}
              {deal.ai_valuation_high && <KpiBox label="Valorisation IA haute" value={fmtMoney(deal.ai_valuation_high, deal.currency)} />}
              {deal.deal_timing && <KpiBox label="Timing" value={deal.deal_timing} />}
            </div>
            {deal.ai_financial_notes && (
              <p style={{ marginTop: 8, fontSize: 11, color: "#374151" }}>
                <strong>Notes IA :</strong> {deal.ai_financial_notes}
              </p>
            )}
          </section>
        )}

        {isMaBuy && deal.strategic_rationale && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Stratégie d'acquisition
            </h2>
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{deal.strategic_rationale}</p>
          </section>
        )}

        {/* Bloc 5 — Organisations liées */}
        {orgs.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Pipeline ({orgs.length} {orgs.length > 1 ? "organisations" : "organisation"})
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d1d5db" }}>
                  <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700 }}>Organisation</th>
                  <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700 }}>Rôle</th>
                  <th style={{ textAlign: "left", padding: "5px 6px", fontWeight: 700 }}>Localisation</th>
                </tr>
              </thead>
              <tbody>
                {orgs.slice(0, 30).map(o => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "4px 6px", fontWeight: 600 }}>{o.name}</td>
                    <td style={{ padding: "4px 6px", color: "#6b7280" }}>{roleInDossierLabels[o.role_in_dossier] ?? o.role_in_dossier}</td>
                    <td style={{ padding: "4px 6px", color: "#6b7280" }}>{o.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orgs.length > 30 && (
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
                {orgs.length - 30} autres organisations non listées.
              </div>
            )}
          </section>
        )}

        {/* Bloc 6 — Honoraires (portés par le dossier depuis v65) */}
        {(deal.estimated_fee_amount != null || deal.success_fee_percent != null || deal.retainer_monthly != null || (deal.confirmed_fee_amount ?? 0) > 0) && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Honoraires
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {deal.estimated_fee_amount != null && (
                <KpiBox label="Honoraires estimés" value={fmtMoney(deal.estimated_fee_amount, deal.currency)} />
              )}
              {(deal.confirmed_fee_amount ?? 0) > 0 && (
                <KpiBox label="Encaissés" value={fmtMoney(deal.confirmed_fee_amount, deal.currency)} />
              )}
              {deal.success_fee_percent != null && (
                <KpiBox label="Success fee" value={`${deal.success_fee_percent}%`} />
              )}
              {deal.retainer_monthly != null && (
                <KpiBox label="Retainer mensuel" value={fmtMoney(deal.retainer_monthly, deal.currency)} />
              )}
              {deal.target_date && (
                <KpiBox label="Closing cible" value={fmtDate(deal.target_date)} />
              )}
            </div>
          </section>
        )}

        {/* Bloc 7 — Activité récente */}
        {acts.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Activité récente
            </h2>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
              {acts.map(a => (
                <li key={a.id} style={{ padding: "4px 0", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>
                    <strong>[{a.type}]</strong> {a.title}
                  </span>
                  <span style={{ color: "#6b7280", fontSize: 10.5, whiteSpace: "nowrap" }}>
                    {fmtDate(a.due_date ?? a.start_datetime)} · {a.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 28, paddingTop: 8, borderTop: "1px solid #e5e7eb", fontSize: 9, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
          <span>Vectis Finance — Synthèse confidentielle</span>
          <span>Généré le {new Date().toLocaleDateString("fr-FR")}</span>
        </footer>
      </article>

      {/* Styles d'impression */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .export-doc { padding: 0 !important; max-width: 100% !important; }
          @page { size: A4 portrait; margin: 14mm; }
        }
        @media screen {
          body { background: #e5e7eb; }
        }
      `}</style>
    </>
  );
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: "6px 10px" }}>
      <div style={{ fontSize: 9.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1f2937", marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function ExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Chargement de la synthèse...</div>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
