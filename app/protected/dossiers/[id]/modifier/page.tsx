import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDealAction } from "@/app/protected/dossiers/nouveau/actions";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,target_amount,currency,description,start_date,target_date")
    .eq("id", id)
    .maybeSingle();

  if (!deal) notFound();

  const inp = "width:100%;padding:9px 13px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:#fff;color:#111";
  const sel = inp;
  const lbl = "display:block;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:5px";

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg,#f8f7f4)", padding:"32px 24px" }}>
      <div style={{ maxWidth:700, margin:"0 auto" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <div style={{ fontSize:12, color:"#6b7280", fontWeight:600, letterSpacing:".05em", textTransform:"uppercase", marginBottom:4 }}>Modifier le dossier</div>
            <h1 style={{ fontSize:22, fontWeight:700, color:"#111", margin:0 }}>{deal.name}</h1>
          </div>
          <Link href={`/protected/dossiers/${id}`} style={{ fontSize:13, padding:"8px 16px", borderRadius:8, border:"1px solid #d1d5db", background:"#fff", color:"#374151", textDecoration:"none" }}>
            ← Retour
          </Link>
        </div>

        <form action={updateDealAction}>
          <input type="hidden" name="deal_id" value={deal.id}/>

          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:24, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#111", marginBottom:18 }}>Informations principales</div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ cssText: lbl } as any}>Nom du dossier *</label>
                <input name="name" defaultValue={deal.name ?? ""} required style={{ cssText: inp } as any}/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Type de mission</label>
                <select name="deal_type" defaultValue={deal.deal_type} style={{ cssText: sel } as any}>
                  <option value="fundraising">Fundraising</option>
                  <option value="ma_sell">M&A Sell-side</option>
                  <option value="ma_buy">M&A Buy-side</option>
                  <option value="cfo_advisor">CFO Advisor</option>
                  <option value="recruitment">Recrutement</option>
                </select>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Statut</label>
                <select name="deal_status" defaultValue={deal.deal_status} style={{ cssText: sel } as any}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Étape</label>
                <select name="deal_stage" defaultValue={deal.deal_stage} style={{ cssText: sel } as any}>
                  <option value="kickoff">Kickoff</option>
                  <option value="preparation">Préparation</option>
                  <option value="outreach">Outreach</option>
                  <option value="management_meetings">Management meetings</option>
                  <option value="dd">Due diligence</option>
                  <option value="negotiation">Négociation</option>
                  <option value="closing">Closing</option>
                  <option value="post_closing">Post-closing</option>
                  <option value="ongoing_support">Suivi en cours</option>
                  <option value="search">Recherche</option>
                </select>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Priorité</label>
                <select name="priority_level" defaultValue={deal.priority_level} style={{ cssText: sel } as any}>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Secteur</label>
                <input name="sector" defaultValue={deal.sector ?? ""} style={{ cssText: inp } as any} placeholder="ex: Technologie / SaaS"/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Localisation</label>
                <input name="location" defaultValue={deal.location ?? ""} style={{ cssText: inp } as any} placeholder="ex: Paris (FR)"/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Date de lancement</label>
                <input name="start_date" type="date" defaultValue={deal.start_date ?? ""} style={{ cssText: inp } as any}/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Date cible de closing</label>
                <input name="target_date" type="date" defaultValue={deal.target_date ?? ""} style={{ cssText: inp } as any}/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Montant cible</label>
                <input name="target_amount" type="number" defaultValue={deal.target_amount ?? ""} style={{ cssText: inp } as any} placeholder="ex: 3000000"/>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Devise</label>
                <select name="currency" defaultValue={deal.currency ?? "EUR"} style={{ cssText: sel } as any}>
                  <option value="EUR">EUR</option>
                  <option value="CHF">CHF</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ cssText: lbl } as any}>Description</label>
                <textarea name="description" defaultValue={deal.description ?? ""} rows={4}
                  style={{ cssText: inp + ";resize:vertical;height:90px" } as any}/>
              </div>

            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Link href={`/protected/dossiers/${id}`} style={{ fontSize:13.5, padding:"9px 18px", borderRadius:9, border:"1px solid #d1d5db", background:"#fff", color:"#374151", textDecoration:"none" }}>
              Annuler
            </Link>
            <button type="submit" style={{ fontSize:13.5, padding:"9px 22px", borderRadius:9, background:"#1a56db", color:"#fff", border:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding:32 }}><div style={{ height:300, borderRadius:14, background:"#f3f4f6" }}/></div>}>
      <Content params={params}/>
    </Suspense>
  );
}
