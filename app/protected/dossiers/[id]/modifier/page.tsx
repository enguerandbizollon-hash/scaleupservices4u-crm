import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDealAction } from "@/app/protected/dossiers/nouveau/actions";
import { SENIORITY_OPTIONS, REMOTE_OPTIONS, RH_GEOGRAPHIES, SECTORS, COMPANY_STAGES } from "@/lib/crm/matching-maps";
import { GeoSelectField } from "@/components/ui/GeoSelectField";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,deal_stage,priority_level,sector,location,target_amount,currency,description,start_date,target_date,next_action_date,job_title,required_seniority,required_location,required_remote,salary_min,salary_max,mandate_id,company_stage")
    .eq("id", id)
    .maybeSingle();

  if (!deal) notFound();

  const { data: mandates } = await supabase
    .from("mandates")
    .select("id,name,type")
    .order("created_at", { ascending: false });

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
                  <option value="open">En cours</option>
                  <option value="paused">En pause</option>
                  <option value="won">Gagné</option>
                  <option value="lost">Perdu</option>
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
                <select name="sector" defaultValue={deal.sector ?? ""} style={{ cssText: sel } as any}>
                  <option value="">— Non renseigné —</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ cssText: lbl } as any}>Localisation</label>
                <GeoSelectField name="location" defaultValue={deal.location ?? ""} />
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
                <label style={{ cssText: lbl } as any}>Prochaine relance</label>
                <input name="next_action_date" type="date" defaultValue={(deal as any).next_action_date ?? ""} style={{ cssText: inp } as any}/>
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
                <label style={{ cssText: lbl } as any}>Mandat associé</label>
                <select name="mandate_id" defaultValue={(deal as any).mandate_id ?? ""} style={{ cssText: sel } as any}>
                  <option value="">— Aucun mandat —</option>
                  {(mandates ?? []).map((m: any) => {
                    const typeLabel: Record<string,string> = { fundraising:"Fundraising", ma_sell:"M&A Sell", ma_buy:"M&A Buy", cfo_advisor:"CFO Advisory", recruitment:"Recrutement" };
                    return <option key={m.id} value={m.id}>[{typeLabel[m.type] ?? m.type}] {m.name}</option>;
                  })}
                </select>
              </div>

              {/* Profil matching — fundraising et M&A */}
              {["fundraising","ma_sell","ma_buy"].includes(deal.deal_type) && (
                <>
                  <div>
                    <label style={{ cssText: lbl } as any}>Stade de l&apos;entreprise</label>
                    <select name="company_stage" defaultValue={(deal as any).company_stage ?? ""} style={{ cssText: sel } as any}>
                      <option value="">— Non renseigné —</option>
                      {COMPANY_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ cssText: lbl } as any}>Géographie de l&apos;entreprise</label>
                    <GeoSelectField name="company_geography" defaultValue={(deal as any).company_geography ?? ""} />
                  </div>
                </>
              )}

              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ cssText: lbl } as any}>Description</label>
                <textarea name="description" defaultValue={deal.description ?? ""} rows={4}
                  style={{ cssText: inp + ";resize:vertical;height:90px" } as any}/>
              </div>

            </div>
          </div>

          {/* Profil de poste — recrutement uniquement */}
          {deal.deal_type === "recruitment" && (
            <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:24, marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#111", marginBottom:18 }}>Profil de poste</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

                <div style={{ gridColumn:"1 / -1" }}>
                  <label style={{ cssText: lbl } as any}>Intitulé exact du poste</label>
                  <input name="job_title" defaultValue={(deal as any).job_title ?? ""} style={{ cssText: inp } as any} placeholder="ex: Directeur Financier" />
                </div>

                <div>
                  <label style={{ cssText: lbl } as any}>Séniorité requise</label>
                  <select name="required_seniority" defaultValue={(deal as any).required_seniority ?? ""} style={{ cssText: sel } as any}>
                    <option value="">— Non renseignée —</option>
                    {SENIORITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ cssText: lbl } as any}>Remote</label>
                  <select name="required_remote" defaultValue={(deal as any).required_remote ?? ""} style={{ cssText: sel } as any}>
                    <option value="">— Non renseigné —</option>
                    {REMOTE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn:"1 / -1" }}>
                  <label style={{ cssText: lbl } as any}>Localisation du poste</label>
                  <select name="required_location" defaultValue={(deal as any).required_location ?? ""} style={{ cssText: sel } as any}>
                    <option value="">— Non renseignée —</option>
                    {Object.entries(
                      RH_GEOGRAPHIES.reduce((acc, g) => ({ ...acc, [g.group]: [...(acc[g.group as keyof typeof acc] ?? []), g] }), {} as Record<string, typeof RH_GEOGRAPHIES[number][]>)
                    ).map(([group, geos]) => (
                      <optgroup key={group} label={group}>
                        {geos.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ cssText: lbl } as any}>Salaire min (€/an)</label>
                  <input name="salary_min" type="number" defaultValue={(deal as any).salary_min ?? ""} style={{ cssText: inp } as any} placeholder="ex: 70000" />
                </div>

                <div>
                  <label style={{ cssText: lbl } as any}>Salaire max (€/an)</label>
                  <input name="salary_max" type="number" defaultValue={(deal as any).salary_max ?? ""} style={{ cssText: inp } as any} placeholder="ex: 95000" />
                </div>

              </div>
            </div>
          )}

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
