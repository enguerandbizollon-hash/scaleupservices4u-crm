import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDealAction } from "./actions";

async function Content() {
  const supabase = await createClient();
  const {data:orgs} = await supabase.from("organizations").select("id,name").order("name");

  return (
    <div style={{padding:32,minHeight:"100vh",background:"var(--bg)"}}>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <div>
            <p className="section-title mb-1">Dossiers</p>
            <h1 style={{color:"var(--text-1)"}}>Nouveau dossier</h1>
          </div>
          <Link href="/protected/dossiers" className="btn-secondary">← Retour</Link>
        </div>

        <form action={createDealAction} style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Infos principales */}
          <div className="card" style={{padding:24}}>
            <p className="section-title mb-4">Informations principales</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <label className="label">Nom du dossier *</label>
                <input name="name" required placeholder="Ex. Redpeaks – Série A" className="input"/>
              </div>
              <div>
                <label className="label">Type de mission *</label>
                <select name="deal_type" required defaultValue="fundraising" className="input">
                  <option value="fundraising">📈 Fundraising</option>
                  <option value="ma_sell">🏢 M&A Sell-side</option>
                  <option value="ma_buy">🎯 M&A Buy-side</option>
                  <option value="cfo_advisor">💼 CFO Advisor</option>
                  <option value="recruitment">👤 Recrutement</option>
                </select>
              </div>
              <div>
                <label className="label">Priorité *</label>
                <select name="priority_level" required defaultValue="medium" className="input">
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
              <div>
                <label className="label">Statut *</label>
                <select name="deal_status" required defaultValue="active" className="input">
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
              <div>
                <label className="label">Étape *</label>
                <select name="deal_stage" required defaultValue="kickoff" className="input">
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
                <label className="label">Secteur</label>
                <input name="sector" placeholder="Ex. SaaS, FinTech…" className="input"/>
              </div>
              <div>
                <label className="label">Valorisation (€)</label>
                <input name="valuation_amount" placeholder="Ex. 5000000" className="input"/>
              </div>
              <div>
                <label className="label">Montant levée (€)</label>
                <input name="fundraising_amount" placeholder="Ex. 3000000" className="input"/>
              </div>
              <div>
                <label className="label">Date de début</label>
                <input name="start_date" type="date" className="input"/>
              </div>
              <div>
                <label className="label">Date cible</label>
                <input name="target_date" type="date" className="input"/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="label">Contexte / description</label>
                <textarea name="description" rows={3} placeholder="Décrivez le contexte de l'opération…" className="input" style={{resize:"none"}}/>
              </div>
            </div>
          </div>

          {/* Organisation */}
          <div className="card" style={{padding:24}}>
            <p className="section-title mb-4">Organisation cliente</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <label className="label">Mode *</label>
                <select name="organization_mode" required defaultValue="existing" className="input">
                  <option value="existing">Organisation existante</option>
                  <option value="new">Créer une nouvelle organisation</option>
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="label">Organisation existante</label>
                <select name="client_organization_id" defaultValue="" className="input">
                  <option value="">— Sélectionner —</option>
                  {(orgs??[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1/-1",background:"var(--surface-2)",borderRadius:10,padding:16,border:"1px solid var(--border)"}}>
                <p className="section-title mb-3">Nouvelle organisation</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{gridColumn:"1/-1"}}>
                    <label className="label">Nom</label>
                    <input name="new_org_name" placeholder="Ex. Redpeaks" className="input"/>
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select name="new_org_type" defaultValue="client" className="input">
                      <option value="client">Client</option>
                      <option value="prospect_client">Prospect</option>
                      <option value="investor">Investisseur</option>
                      <option value="buyer">Repreneur</option>
                      <option value="target">Cible</option>
                      <option value="law_firm">Cabinet juridique</option>
                      <option value="bank">Banque</option>
                      <option value="advisor">Conseil</option>
                      <option value="family_office">Family office</option>
                      <option value="corporate">Corporate</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Pays</label>
                    <input name="new_org_country" className="input"/>
                  </div>
                  <div>
                    <label className="label">Site web</label>
                    <input name="new_org_website" placeholder="https://…" className="input"/>
                  </div>
                  <div>
                    <label className="label">Secteur</label>
                    <input name="new_org_sector" className="input"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"flex-end",gap:10,paddingBottom:20}}>
            <Link href="/protected/dossiers" className="btn-secondary">Annuler</Link>
            <button type="submit" className="btn-primary">Créer le dossier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouveauDossierPage(){
  return(
    <Suspense fallback={<div style={{padding:32,background:"var(--bg)",minHeight:"100vh"}}><div style={{height:400,borderRadius:14,background:"var(--border)"}} /></div>}>
      <Content/>
    </Suspense>
  );
}
