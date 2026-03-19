import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDealAction } from "./actions";

async function Content() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, organization_type")
    .order("name");

  return (
    <div className="p-8 min-h-screen" style={{ background: "var(--bg-app)" }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest" style={{ color: "var(--brand-blue)" }}>DOSSIERS</p>
            <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Nouveau dossier</h1>
          </div>
          <Link href="/protected/dossiers" className="rounded-xl border px-4 py-2 text-sm font-medium transition-all hover:opacity-80"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)", background: "white" }}>
            Retour
          </Link>
        </div>

        <form action={createDealAction} className="space-y-5">

          {/* Infos principales */}
          <div className="rounded-2xl border p-6 shadow-sm" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <h2 className="mb-5 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>INFORMATIONS PRINCIPALES</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nom du dossier *</label>
                <input name="name" required placeholder="Ex. Redpeaks – Série A"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}
                  onFocus={e => e.target.style.borderColor = "var(--brand-blue)"}
                  onBlur={e => e.target.style.borderColor = "var(--border-default)"}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Type de mission *</label>
                <select name="deal_type" required defaultValue="fundraising"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                  <option value="fundraising">📈 Fundraising</option>
                  <option value="ma_sell">🏢 M&A Sell-side</option>
                  <option value="ma_buy">🎯 M&A Buy-side</option>
                  <option value="cfo_advisor">💼 CFO Advisor</option>
                  <option value="recruitment">👤 Recrutement</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Statut *</label>
                <select name="deal_status" required defaultValue="active"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Étape *</label>
                <select name="deal_stage" required defaultValue="kickoff"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
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
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Priorité *</label>
                <select name="priority_level" required defaultValue="medium"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                  <option value="high">🔴 Haute</option>
                  <option value="medium">🟡 Moyenne</option>
                  <option value="low">⚪ Basse</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Secteur</label>
                <input name="sector" placeholder="Ex. SaaS, FinTech, Santé…"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Date de début</label>
                <input name="start_date" type="date"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Date cible</label>
                <input name="target_date" type="date"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Valorisation (€)</label>
                <input name="valuation_amount" type="text" placeholder="Ex. 5000000"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Montant levée (€)</label>
                <input name="fundraising_amount" type="text" placeholder="Ex. 3000000"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Contexte / description</label>
                <textarea name="description" rows={3} placeholder="Décrivez le contexte de l'opération…"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }} />
              </div>
            </div>
          </div>

          {/* Organisation */}
          <div className="rounded-2xl border p-6 shadow-sm" style={{ background: "white", borderColor: "var(--border-default)" }}>
            <h2 className="mb-5 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>ORGANISATION CLIENTE</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Mode *</label>
                <select name="organization_mode" required defaultValue="existing"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                  <option value="existing">Organisation existante</option>
                  <option value="new">Créer une nouvelle organisation</option>
                </select>
              </div>

              {/* Existante */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Organisation existante</label>
                <select name="client_organization_id" defaultValue=""
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                  <option value="">— Sélectionner —</option>
                  {(organizations ?? []).map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              {/* Nouvelle */}
              <div className="md:col-span-2 rounded-xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-app)" }}>
                <p className="mb-3 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>NOUVELLE ORGANISATION</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nom</label>
                    <input name="new_org_name" placeholder="Ex. Redpeaks"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border-default)", background: "white" }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Type</label>
                    <select name="new_org_type" defaultValue="client"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border-default)", background: "white" }}>
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
                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Pays</label>
                    <input name="new_org_country" className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border-default)", background: "white" }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Site web</label>
                    <input name="new_org_website" placeholder="https://…"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border-default)", background: "white" }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Secteur</label>
                    <input name="new_org_sector" className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: "var(--border-default)", background: "white" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-8">
            <Link href="/protected/dossiers" className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)", background: "white" }}>
              Annuler
            </Link>
            <button type="submit" className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "var(--sidebar-bg)" }}>
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
    <Suspense fallback={<div className="p-8 min-h-screen" style={{ background: "var(--bg-app)" }}><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>}>
      <Content />
    </Suspense>
  );
}
