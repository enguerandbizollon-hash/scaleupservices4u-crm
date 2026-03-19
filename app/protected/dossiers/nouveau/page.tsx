import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDealAction } from "./actions";

const inputCls = "w-full rounded-xl border border-[#E8E0D0] bg-[#F9F7F4] px-4 py-3 text-sm text-[#0F1B2D] outline-none focus:border-[#2D6EA4] focus:bg-white focus:ring-1 focus:ring-[#2D6EA4] transition-all";
const labelCls = "mb-2 block text-sm font-medium text-[#0F1B2D]";

async function Content() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations").select("id, name").order("name");

  return (
    <div className="p-8 min-h-screen bg-[#F5F0E8]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#2D6EA4]">DOSSIERS</p>
            <h1 className="mt-1 text-3xl font-bold text-[#0F1B2D]" style={{ letterSpacing: "-0.02em" }}>Nouveau dossier</h1>
          </div>
          <Link href="/protected/dossiers" className="rounded-xl border border-[#E8E0D0] bg-white px-4 py-2 text-sm font-medium text-[#3F6080] hover:bg-[#F5F0E8] transition-all">
            ← Retour
          </Link>
        </div>

        <form action={createDealAction} className="space-y-5">
          {/* Infos principales */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xs font-semibold tracking-widest text-[#7A9BB5]">INFORMATIONS PRINCIPALES</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Nom du dossier *</label>
                <input name="name" required placeholder="Ex. Redpeaks – Série A" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Type de mission *</label>
                <select name="deal_type" required defaultValue="fundraising" className={inputCls}>
                  <option value="fundraising">📈 Fundraising</option>
                  <option value="ma_sell">🏢 M&A Sell-side</option>
                  <option value="ma_buy">🎯 M&A Buy-side</option>
                  <option value="cfo_advisor">💼 CFO Advisor</option>
                  <option value="recruitment">👤 Recrutement</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Statut *</label>
                <select name="deal_status" required defaultValue="active" className={inputCls}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Étape *</label>
                <select name="deal_stage" required defaultValue="kickoff" className={inputCls}>
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
                <label className={labelCls}>Priorité *</label>
                <select name="priority_level" required defaultValue="medium" className={inputCls}>
                  <option value="high">🔴 Haute</option>
                  <option value="medium">🟡 Moyenne</option>
                  <option value="low">⚪ Basse</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Secteur</label>
                <input name="sector" placeholder="Ex. SaaS, FinTech, Santé…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Valorisation (€)</label>
                <input name="valuation_amount" placeholder="Ex. 5000000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Montant levée (€)</label>
                <input name="fundraising_amount" placeholder="Ex. 3000000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date de début</label>
                <input name="start_date" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date cible</label>
                <input name="target_date" type="date" className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Contexte / description</label>
                <textarea name="description" rows={3} placeholder="Décrivez le contexte de l'opération…" className={inputCls + " resize-none"} />
              </div>
            </div>
          </div>

          {/* Organisation */}
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xs font-semibold tracking-widest text-[#7A9BB5]">ORGANISATION CLIENTE</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Mode *</label>
                <select name="organization_mode" required defaultValue="existing" className={inputCls}>
                  <option value="existing">Organisation existante</option>
                  <option value="new">Créer une nouvelle organisation</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Organisation existante</label>
                <select name="client_organization_id" defaultValue="" className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {(organizations ?? []).map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 rounded-xl border border-[#E8E0D0] bg-[#F9F7F4] p-4">
                <p className="mb-3 text-xs font-semibold tracking-widest text-[#7A9BB5]">NOUVELLE ORGANISATION</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Nom</label>
                    <input name="new_org_name" placeholder="Ex. Redpeaks" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select name="new_org_type" defaultValue="client" className={inputCls}>
                      <option value="client">Client</option>
                      <option value="prospect_client">Prospect client</option>
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
                    <label className={labelCls}>Pays</label>
                    <input name="new_org_country" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Site web</label>
                    <input name="new_org_website" placeholder="https://…" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Secteur</label>
                    <input name="new_org_sector" className={inputCls} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <Link href="/protected/dossiers" className="rounded-xl border border-[#E8E0D0] bg-white px-5 py-2.5 text-sm font-medium text-[#3F6080] hover:bg-[#F5F0E8] transition-all">
              Annuler
            </Link>
            <button type="submit" className="rounded-xl bg-[#0F1B2D] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#163959] transition-all">
              Créer le dossier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NouveauDossierPage() {
  return (
    <Suspense fallback={<div className="p-8 min-h-screen bg-[#F5F0E8]"><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content />
    </Suspense>
  );
}
