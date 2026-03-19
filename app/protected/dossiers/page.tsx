import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "lucide-react";

const typeLabel: Record<string,string> = {
  fundraising:"Fundraising",ma_sell:"M&A Sell-side",ma_buy:"M&A Buy-side",cfo_advisor:"CFO Advisor",recruitment:"Recrutement"
};
const typeIcon: Record<string,string> = {
  fundraising:"📈",ma_sell:"🏢",ma_buy:"🎯",cfo_advisor:"💼",recruitment:"👤"
};
const typeBadge: Record<string,string> = {
  fundraising:"badge-fundraising",ma_sell:"badge-ma-sell",ma_buy:"badge-ma-buy",cfo_advisor:"badge-cfo",recruitment:"badge-recruitment"
};
const stageLabel: Record<string,string> = {
  kickoff:"Kickoff",preparation:"Préparation",outreach:"Outreach",
  management_meetings:"Mgmt meetings",dd:"Due diligence",negotiation:"Négociation",
  closing:"Closing",post_closing:"Post-closing",ongoing_support:"Suivi",search:"Recherche"
};

function fmt(v:string|null){if(!v)return null;return new Intl.DateTimeFormat("fr-FR",{dateStyle:"short"}).format(new Date(v));}

async function Content() {
  const supabase = await createClient();
  const {data:deals} = await supabase.from("deals").select("id,name,deal_type,deal_status,deal_stage,priority_level,client_organization_id,sector,target_date").order("priority_level");

  const orgIds = [...new Set((deals??[]).map(d=>d.client_organization_id).filter(Boolean))];
  let orgMap: Record<string,string>={};
  if(orgIds.length){
    const {data:orgs}=await supabase.from("organizations").select("id,name").in("id",orgIds);
    orgMap=Object.fromEntries((orgs??[]).map(o=>[o.id,o.name]));
  }

  const all=deals??[];
  const active=all.filter(d=>d.deal_status==="active");
  const inactive=all.filter(d=>d.deal_status==="inactive");
  const closed=all.filter(d=>d.deal_status==="closed");

  const types=["fundraising","ma_sell","ma_buy","cfo_advisor","recruitment"];
  const groups=types.map(t=>({
    type:t,
    active:active.filter(d=>d.deal_type===t),
    inactive:inactive.filter(d=>d.deal_type===t),
    closed:closed.filter(d=>d.deal_type===t),
  })).filter(g=>g.active.length+g.inactive.length+g.closed.length>0);

  function DealCard({deal}:{deal:typeof all[0]}) {
    const statusBadge = deal.deal_status==="active"?"badge-active":deal.deal_status==="closed"?"badge-closed":"badge-inactive";
    const statusLabel = deal.deal_status==="active"?"Actif":deal.deal_status==="closed"?"Clôturé":"Inactif";
    return (
      <Link href={`/protected/dossiers/${deal.id}`} className="card row-hover" style={{
        display:"block",padding:16,textDecoration:"none",
        borderLeft:`3px solid`,
        borderLeftColor:deal.priority_level==="high"?"var(--c-high)":deal.priority_level==="medium"?"var(--c-medium)":"var(--border-2)",
        transition:"box-shadow 0.15s"
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
          <p style={{fontSize:13,fontWeight:600,color:"var(--text-1)",lineHeight:1.3}}>{deal.name}</p>
          <span className={`badge ${statusBadge}`}>{statusLabel}</span>
        </div>
        <p style={{fontSize:11,color:"var(--text-4)",marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{orgMap[deal.client_organization_id]??""}{deal.sector?` · ${deal.sector}`:""}</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span className="badge badge-inactive">{stageLabel[deal.deal_stage]??deal.deal_stage}</span>
          {fmt(deal.target_date)&&<span style={{fontSize:11,color:"var(--text-4)"}}>{fmt(deal.target_date)}</span>}
        </div>
      </Link>
    );
  }

  return (
    <div style={{padding:32,minHeight:"100vh",background:"var(--bg)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:28}}>
        <div>
          <p className="section-title mb-1">Module CRM</p>
          <h1 style={{color:"var(--text-1)"}}>Dossiers</h1>
          <p style={{fontSize:12,color:"var(--text-3)",marginTop:4}}>
            {all.length} dossiers · {active.length} actifs · {closed.length} clôturés
          </p>
        </div>
        <Link href="/protected/dossiers/nouveau" className="btn-primary">+ Nouveau dossier</Link>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:32}}>
        {[
          {label:"Actifs",count:active.length,color:"var(--c-active)",bg:"var(--c-active-bg)"},
          {label:"Inactifs",count:inactive.length,color:"var(--c-inactive)",bg:"var(--c-inactive-bg)"},
          {label:"Clôturés",count:closed.length,color:"var(--c-closed)",bg:"var(--c-closed-bg)"},
        ].map(k=>(
          <div key={k.label} style={{background:k.bg,borderRadius:12,padding:"14px 18px",border:"1px solid",borderColor:k.color,opacity:0.85}}>
            <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",color:k.color,textTransform:"uppercase"}}>{k.label}</p>
            <p style={{fontSize:32,fontWeight:700,color:k.color,lineHeight:1,marginTop:6}}>{k.count}</p>
          </div>
        ))}
      </div>

      {/* Sections par type */}
      <div style={{display:"flex",flexDirection:"column",gap:32}}>
        {groups.map(g=>(
          <div key={g.type}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:18}}>{typeIcon[g.type]}</span>
              <h2 style={{color:"var(--text-1)"}}>{typeLabel[g.type]}</h2>
              <div style={{display:"flex",gap:6}}>
                {g.active.length>0&&<span className="badge badge-active">{g.active.length} actif{g.active.length>1?"s":""}</span>}
                {g.inactive.length>0&&<span className="badge badge-inactive">{g.inactive.length} inactif{g.inactive.length>1?"s":""}</span>}
                {g.closed.length>0&&<span className="badge badge-closed">{g.closed.length} clôturé{g.closed.length>1?"s":""}</span>}
              </div>
            </div>

            {g.active.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:g.inactive.length+g.closed.length>0?12:0}}>
                {g.active.map(d=><DealCard key={d.id} deal={d}/>)}
              </div>
            )}
            {(g.inactive.length+g.closed.length>0)&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,opacity:0.55}}>
                {[...g.inactive,...g.closed].map(d=><DealCard key={d.id} deal={d}/>)}
              </div>
            )}
          </div>
        ))}

        {all.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed var(--border-2)",borderRadius:14}}>
            <p style={{color:"var(--text-3)",marginBottom:16}}>Aucun dossier. Créez votre premier.</p>
            <Link href="/protected/dossiers/nouveau" className="btn-primary">+ Nouveau dossier</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  return (
    <Suspense fallback={<div style={{padding:32,background:"var(--bg)",minHeight:"100vh"}}><div style={{height:400,borderRadius:14,background:"var(--border)"}}/>  </div>}>
      <Content/>
    </Suspense>
  );
}
