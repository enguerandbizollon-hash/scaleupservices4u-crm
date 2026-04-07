import Link from "next/link";
import { createDealAction } from "./actions";
import { SECTORS, COMPANY_STAGES } from "@/lib/crm/matching-maps";
import { GeoSelectField } from "@/components/ui/GeoSelectField";
import { MandateSelect } from "@/components/mandates/MandateSelect";
import { createClient } from "@/lib/supabase/server";

export default async function NouveauDossierPage() {
  const supabase = await createClient();
  const { data: mandatesRaw } = await supabase
    .from("mandates")
    .select("id,name,type,status,organizations:client_organization_id(name)")
    .order("created_at", { ascending: false });
  const mandates = (mandatesRaw ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    client_name: Array.isArray(m.organizations) ? m.organizations[0]?.name : m.organizations?.name ?? null,
  }));

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <div className="section-label" style={{ marginBottom:4 }}>Dossiers</div>
            <h1 style={{ margin:0 }}>Nouveau dossier</h1>
          </div>
          <Link href="/protected/dossiers" className="btn btn-secondary">← Retour</Link>
        </div>

        <form action={createDealAction}>
          <div className="card" style={{ padding:28, display:"flex", flexDirection:"column", gap:18 }}>

            {/* Nom */}
            <div>
              <label className="lbl">NOM DU DOSSIER *</label>
              <input name="name" required className="inp" placeholder="Ex. Redpeaks Série A"/>
            </div>

            {/* Type + Statut */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label className="lbl">TYPE *</label>
                <select name="deal_type" required className="inp">
                  <option value="">— Choisir —</option>
                  <option value="fundraising">Fundraising</option>
                  <option value="ma_sell">M&A Sell-side</option>
                  <option value="ma_buy">M&A Buy-side</option>
                  <option value="cfo_advisor">CFO Advisor</option>
                  <option value="recruitment">Recrutement</option>
                </select>
              </div>
              <div>
                <label className="lbl">STATUT</label>
                <select name="deal_status" className="inp">
                  <option value="open">En cours</option>
                  <option value="paused">En pause</option>
                </select>
              </div>
            </div>

            {/* Étape + Priorité */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label className="lbl">ÉTAPE</label>
                <select name="deal_stage" className="inp">
                  <option value="kickoff">Kickoff</option>
                  <option value="preparation">Préparation</option>
                  <option value="outreach">Outreach</option>
                  <option value="management_meetings">Mgmt meetings</option>
                  <option value="dd">Due Diligence</option>
                  <option value="negotiation">Négociation</option>
                  <option value="closing">Closing</option>
                  <option value="post_closing">Post-closing</option>
                  <option value="ongoing_support">Suivi</option>
                </select>
              </div>
              <div>
                <label className="lbl">PRIORITÉ</label>
                <select name="priority_level" className="inp">
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
            </div>

            {/* Secteur + Localisation */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label className="lbl">SECTEUR D'ACTIVITÉ</label>
                <select name="sector" className="inp">
                  <option value="">— Choisir —</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">LOCALISATION</label>
                <GeoSelectField name="location" />
              </div>
            </div>

            {/* Profil matching (fundraising) */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label className="lbl">STADE DE LEVÉE</label>
                <select name="company_stage" className="inp">
                  <option value="">— Non renseigné —</option>
                  {COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">GÉOGRAPHIE CIBLE</label>
                <GeoSelectField name="company_geography" />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label className="lbl">DATE DE DÉBUT</label>
                <input name="start_date" type="date" className="inp"/>
              </div>
              <div>
                <label className="lbl">DATE CIBLE</label>
                <input name="target_date" type="date" className="inp"/>
              </div>
            </div>

            {/* Mandat associé — la création inline d'un mandat est volontairement
                désactivée ici car le dossier n'existe pas encore. Pour créer un
                mandat lié, créer d'abord le dossier puis utiliser l'onglet Mandat. */}
            <div>
              <label className="lbl">MANDAT ASSOCIÉ</label>
              <MandateSelect name="mandate_id" mandates={mandates} />
            </div>

            {/* Description */}
            <div>
              <label className="lbl">DESCRIPTION</label>
              <textarea name="description" rows={3} className="inp" placeholder="Contexte, objectifs, notes…"/>
            </div>

          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
            <Link href="/protected/dossiers" className="btn btn-secondary">Annuler</Link>
            <button type="submit" className="btn btn-primary">Créer le dossier</button>
          </div>
        </form>
      </div>
    </div>
  );
}
