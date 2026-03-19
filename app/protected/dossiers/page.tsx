import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Plus } from "lucide-react";

export const revalidate = 60;

const DT: Record<string, { label:string; icon:string; bg:string; tx:string; dot:string; border:string }> = {
  fundraising: { label:"Fundraising",  icon:"📈", bg:"var(--fund-bg)", tx:"var(--fund-tx)", dot:"var(--fund-dot)", border:"var(--fund-mid)" },
  ma_sell:     { label:"M&A Sell",     icon:"🏢", bg:"var(--sell-bg)", tx:"var(--sell-tx)", dot:"var(--sell-dot)", border:"var(--sell-mid)" },
  ma_buy:      { label:"M&A Buy",      icon:"🎯", bg:"var(--buy-bg)",  tx:"var(--buy-tx)",  dot:"var(--buy-dot)",  border:"var(--buy-mid)"  },
  cfo_advisor: { label:"CFO Advisor",  icon:"💼", bg:"var(--cfo-bg)",  tx:"var(--cfo-tx)",  dot:"var(--cfo-dot)",  border:"var(--cfo-mid)"  },
  recruitment: { label:"Recrutement",  icon:"👤", bg:"var(--rec-bg)",  tx:"var(--rec-tx)",  dot:"var(--rec-dot)",  border:"var(--rec-mid)"  },
};

const STAGE: Record<string,string> = {
  kickoff:"Kickoff", preparation:"Préparation", outreach:"Outreach",
  management_meetings:"Mgmt meetings", dd:"Due Diligence",
  negotiation:"Négociation", closing:"Closing",
  post_closing:"Post-closing", ongoing_support:"Suivi", search:"Recherche",
};

const PRIO: Record<string,string> = {
  high:"var(--rec-dot)", medium:"var(--sell-dot)", low:"var(--border-2)"
};

function fmtDate(v:string|null) {
  if (!v) return null;
  return new Intl.DateTimeFormat("fr-FR", { day:"numeric", month:"short" }).format(new Date(v));
}

async function Content() {
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id,sector,target_date")
    .order("priority_level");

  // Résoudre les noms d'organisation
  const orgIds = [...new Set((deals ?? []).map(d => d.client_organization_id).filter(Boolean))];
  let orgMap: Record<string, string> = {};
  if (orgIds.length) {
    const { data: orgs } = await supabase.from("organizations").select("id,name").in("id", orgIds);
    orgMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
  }

  const all     = deals ?? [];
  const active  = all.filter(d => d.deal_status === "active");
  const inactive = all.filter(d => d.deal_status === "inactive");
  const closed  = all.filter(d => d.deal_status === "closed");

  // Grouper par type
  const types = ["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const groups = types.map(t => ({
    t, dt: DT[t],
    active:  active.filter(d => d.deal_type === t),
    inactive: inactive.filter(d => d.deal_type === t),
    closed:  closed.filter(d => d.deal_type === t),
  })).filter(g => g.active.length + g.inactive.length + g.closed.length > 0);

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="section-label" style={{ marginBottom:6 }}>CRM</div>
          <h1 style={{ margin:0 }}>Dossiers</h1>
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
            <span className="stat-pill">{all.length} total</span>
            <span className="stat-pill" style={{ background:"var(--fund-bg)", color:"var(--fund-tx)", border:"1px solid var(--fund-mid)" }}>
              {active.length} actif{active.length !== 1 ? "s" : ""}
            </span>
            {closed.length > 0 && (
              <span className="stat-pill" style={{ background:"var(--surface-3)", color:"var(--text-4)" }}>
                {closed.length} clôturé{closed.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <Link href="/protected/dossiers/nouveau" className="btn btn-primary">
          <Plus size={14}/> Nouveau dossier
        </Link>
      </div>

      {/* ── KPIs par type ── */}
      {groups.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:10, marginBottom:28 }}>
          {groups.map(g => (
            <div key={g.t} className="type-card" style={{ padding:"16px 18px", borderRadius:14, background:g.dt.bg, border:`1px solid ${g.dt.border}`, boxShadow:"var(--shadow-xs)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                <span style={{ fontSize:17 }}>{g.dt.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, color:g.dt.tx }}>{g.dt.label}</span>
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                <span style={{ fontSize:30, fontWeight:800, color:g.dt.tx, lineHeight:1 }}>
                  {g.active.length + g.inactive.length + g.closed.length}
                </span>
              </div>
              <div style={{ display:"flex", gap:8, fontSize:11, flexWrap:"wrap" }}>
                {g.active.length > 0 && (
                  <span style={{ color:g.dt.tx, fontWeight:600 }}>
                    ● {g.active.length} actif{g.active.length > 1 ? "s" : ""}
                  </span>
                )}
                {g.inactive.length > 0 && (
                  <span style={{ color:g.dt.tx, opacity:.5 }}>
                    ● {g.inactive.length} inactif{g.inactive.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sections par type ── */}
      {all.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize:14, fontWeight:600, color:"var(--text-3)", marginBottom:12 }}>Aucun dossier</div>
          <Link href="/protected/dossiers/nouveau" className="btn btn-primary"><Plus size={14}/>Créer le premier</Link>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
          {groups.map(g => (
            <div key={g.t}>

              {/* Section header */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, paddingBottom:10, borderBottom:`2px solid ${g.dt.border}` }}>
                <div style={{ width:32, height:32, borderRadius:9, background:g.dt.bg, border:`1px solid ${g.dt.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
                  {g.dt.icon}
                </div>
                <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:g.dt.tx }}>{g.dt.label}</h2>
                <div style={{ display:"flex", gap:6, marginLeft:4 }}>
                  {g.active.length > 0 && (
                    <span style={{ fontSize:11, fontWeight:700, background:g.dt.bg, color:g.dt.tx, border:`1px solid ${g.dt.border}`, borderRadius:20, padding:"2px 9px" }}>
                      {g.active.length} actif{g.active.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {g.inactive.length > 0 && (
                    <span style={{ fontSize:11, fontWeight:500, background:"var(--surface-3)", color:"var(--text-4)", borderRadius:20, padding:"2px 9px" }}>
                      {g.inactive.length} inactif{g.inactive.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {g.closed.length > 0 && (
                    <span style={{ fontSize:11, fontWeight:500, background:"var(--surface-3)", color:"var(--text-5)", borderRadius:20, padding:"2px 9px" }}>
                      {g.closed.length} clôturé{g.closed.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Cards actifs */}
              {g.active.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10, marginBottom: g.inactive.length + g.closed.length > 0 ? 10 : 0 }}>
                  {g.active.map(d => (
                    <DealCard key={d.id} deal={d} dt={g.dt} orgName={orgMap[d.client_organization_id] ?? ""} />
                  ))}
                </div>
              )}

              {/* Cards inactifs + clôturés — atténués */}
              {(g.inactive.length + g.closed.length) > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10, opacity:.5 }}>
                  {[...g.inactive, ...g.closed].map(d => (
                    <DealCard key={d.id} deal={d} dt={g.dt} orgName={orgMap[d.client_organization_id] ?? ""} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Deal = { id:string; name:string; deal_type:string; deal_status:string; deal_stage:string; priority_level:string; client_organization_id:string; sector:string|null; target_date:string|null; };
type DT = typeof DT[keyof typeof DT];

function DealCard({ deal, dt, orgName }: { deal: Deal; dt: DT; orgName: string }) {
  const pcolor = PRIO[deal.priority_level] ?? "var(--border-2)";
  const statusLabel = deal.deal_status === "active" ? "Actif" : deal.deal_status === "closed" ? "Clôturé" : "Inactif";
  const statusBg = deal.deal_status === "active" ? dt.bg : "var(--surface-3)";
  const statusTx = deal.deal_status === "active" ? dt.tx : "var(--text-4)";
  const date = fmtDate(deal.target_date);

  return (
    <Link href={`/protected/dossiers/${deal.id}`}
      className="card deal-card"
      style={{ display:"block", textDecoration:"none", overflow:"hidden" }}
>

      {/* Barre priorité en haut */}
      <div style={{ height:3, background:pcolor, borderRadius:"14px 14px 0 0" }}/>

      <div style={{ padding:"14px 16px" }}>
        {/* Titre + statut */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:8 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:"var(--text-1)", lineHeight:1.35, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as any }}>
            {deal.name}
          </div>
          <span style={{ fontSize:10.5, fontWeight:700, borderRadius:6, padding:"2px 8px", background:statusBg, color:statusTx, flexShrink:0 }}>
            {statusLabel}
          </span>
        </div>

        {/* Organisation + secteur */}
        {(orgName || deal.sector) && (
          <div style={{ fontSize:11.5, color:"var(--text-4)", marginBottom:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {orgName && <span style={{ color:"var(--su-500)", fontWeight:500 }}>{orgName}</span>}
            {orgName && deal.sector && <span style={{ margin:"0 4px" }}>·</span>}
            {deal.sector && <span>{deal.sector}</span>}
          </div>
        )}

        {/* Footer : stage + date */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <span style={{ fontSize:11, fontWeight:600, borderRadius:6, padding:"3px 9px", background:"var(--surface-2)", color:"var(--text-3)", border:"1px solid var(--border)" }}>
            {STAGE[deal.deal_stage] ?? deal.deal_stage}
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {date && (
              <span style={{ fontSize:11, color:"var(--text-5)" }}>🗓 {date}</span>
            )}
            <ArrowRight size={11} color="var(--border-2)"/>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div style={{ padding:32, background:"var(--bg)", minHeight:"100vh" }}>
      <div className="skeleton" style={{ height:36, width:180, marginBottom:24 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10 }}>
        {[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height:140, borderRadius:14 }}/>)}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  return <Suspense fallback={<Skeleton/>}><Content/></Suspense>;
}
