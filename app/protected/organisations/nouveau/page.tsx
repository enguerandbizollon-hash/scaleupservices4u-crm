"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft } from "lucide-react";

const TYPES = [
  { value:"investor",        label:"Investisseur",       desc:"VC, PE, Growth" },
  { value:"business_angel",   label:"Business Angel",     desc:"Investisseur individuel" },
  { value:"family_office",   label:"Family Office",      desc:"SFO, MFO, GFI" },
  { value:"corporate",       label:"Corporate / CVC",    desc:"Investisseur corporate" },
  { value:"bank",            label:"Banque",             desc:"Banque privée, commerciale" },
  { value:"client",          label:"Client",             desc:"Société accompagnée" },
  { value:"prospect_client", label:"Prospect client",    desc:"Cible commerciale" },
  { value:"target",          label:"Cible M&A",          desc:"Cible d'acquisition" },
  { value:"buyer",           label:"Repreneur",          desc:"Acquéreur potentiel" },
  { value:"law_firm",        label:"Cabinet juridique",  desc:"Avocat, notaire" },
  { value:"advisor",         label:"Conseil",            desc:"Banque d'affaires, advisor" },
  { value:"accounting_firm", label:"Cabinet comptable",  desc:"Expert-comptable, audit" },
  { value:"consulting_firm", label:"Cabinet de conseil", desc:"Conseil stratégique" },
  { value:"other",           label:"Autre",              desc:"" },
];

const STATUSES = [
  { value:"to_qualify",  label:"À qualifier" },
  { value:"qualified",   label:"Qualifié" },
  { value:"active",      label:"Actif" },
  { value:"priority",    label:"Prioritaire" },
  { value:"dormant",     label:"Dormant" },
  { value:"inactive",    label:"Inactif" },
  { value:"excluded",    label:"Exclu" },
];

const TICKETS = ["< 500k€","500k – 1M€","1M – 3M€","3M – 10M€","10M – 50M€","50M – 100M€","> 100M€","< 500k CHF","500k – 2M CHF","2M – 10M CHF","> 10M CHF"];
const STAGES  = ["Pre-seed","Seed","Série A","Série B","Série C+","Growth","Buyout","Toutes étapes"];
const SECTORS = ["Technologie / SaaS","Fintech / Insurtech","Santé / MedTech","Intelligence Artificielle","Cybersécurité","Industrie","Immobilier","Énergie / Cleantech","Retail / E-commerce","Média / Contenu","Généraliste","Autre"];

// Champs dynamiques selon le type
function extraFields(type: string) {
  const isInvestor = ["investor","business_angel","family_office","corporate","bank"].includes(type);
  const isTarget   = ["target","client","prospect_client"].includes(type);
  const isBuyer    = type === "buyer";

  return { isInvestor, isTarget, isBuyer };
}

const inp: React.CSSProperties = { width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:13.5, fontFamily:"inherit", outline:"none", background:"#fff", color:"#111", boxSizing:"border-box" };
const sel: React.CSSProperties = { ...inp };
const lbl: React.CSSProperties = { display:"block", fontSize:12.5, fontWeight:600, color:"#374151", marginBottom:5 };
const section: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px 22px", marginBottom:14 };
const grid2: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 };

export default function NouvelleOrganisationPage() {
  const router = useRouter();
  const [type, setType] = useState("investor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isInvestor, isTarget, isBuyer } = extraFields(type);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/organisations/create", {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      router.push("/protected/organisations");
    } catch(err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", padding:"28px 24px" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>

        <Link href="/protected/organisations" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"#6b7280", textDecoration:"none", marginBottom:20 }}>
          <ArrowLeft size={13}/> Organisations
        </Link>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Building2 size={18} color="#1a56db"/>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#111" }}>Nouvelle organisation</h1>
            <p style={{ margin:0, fontSize:13, color:"#6b7280" }}>Les champs varient selon le type</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="organization_type" value={type}/>

          {/* Type — sélecteur visuel */}
          <div style={section}>
            <label style={lbl}>Type d'organisation *</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  style={{
                    padding:"10px 12px", borderRadius:9, border:`1.5px solid ${type===t.value?"#1a56db":"#e5e7eb"}`,
                    background: type===t.value ? "#eff6ff" : "#fff",
                    color: type===t.value ? "#1a56db" : "#374151",
                    cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                    transition:"all .1s",
                  }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{t.label}</div>
                  {t.desc && <div style={{ fontSize:11, color: type===t.value?"#3b82f6":"#9ca3af", marginTop:2 }}>{t.desc}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Informations générales */}
          <div style={section}>
            <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>Informations générales</div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Nom *</label>
              <input name="name" required style={inp} placeholder="ex: Alven Capital, Andreessen Horowitz…"/>
            </div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Statut</label>
                <select name="base_status" defaultValue="to_qualify" style={sel}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Localisation</label>
                <input name="location" style={inp} placeholder="ex: Paris (FR), Genève (CH)"/>
              </div>
              <div>
                <label style={lbl}>Site web</label>
                <input name="website" type="url" style={inp} placeholder="https://…"/>
              </div>
              <div>
                <label style={lbl}>LinkedIn</label>
                <input name="linkedin_url" style={inp} placeholder="https://linkedin.com/company/…"/>
              </div>
            </div>
          </div>

          {/* Champs investisseur */}
          {isInvestor && (
            <div style={section}>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>
                {type === "family_office" ? "Profil Family Office" : type === "bank" ? "Profil Banque" : "Profil Investisseur"}
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Ticket d'investissement</label>
                  <select name="investment_ticket" style={sel}>
                    <option value="">— Non renseigné —</option>
                    {TICKETS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Stade d'investissement</label>
                  <select name="investment_stage" style={sel}>
                    <option value="">— Non renseigné —</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:"1 / -1" }}>
                  <label style={lbl}>Secteurs d'investissement</label>
                  <select name="sector" style={sel}>
                    <option value="">— Non renseigné —</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:"1 / -1" }}>
                  <label style={lbl}>Thèse / Profil d'investissement</label>
                  <textarea name="description" rows={3} style={{ ...inp, resize:"vertical" }}
                    placeholder="ex: Spécialiste SaaS B2B Europe, tickets Seed à Série A, forte valeur ajoutée opérationnelle…"/>
                </div>
              </div>
            </div>
          )}

          {/* Champs cible / client */}
          {(isTarget || isBuyer) && (
            <div style={section}>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>
                {isBuyer ? "Profil Repreneur" : "Profil Société"}
              </div>
              <div style={grid2}>
                <div>
                  <label style={lbl}>Secteur d'activité</label>
                  <input name="sector" style={inp} placeholder="ex: Logiciel, Industrie…"/>
                </div>
                <div>
                  <label style={lbl}>Effectif estimé</label>
                  <select name="employee_range" style={sel}>
                    <option value="">— Non renseigné —</option>
                    <option value="1-10">1 – 10</option>
                    <option value="10-50">10 – 50</option>
                    <option value="50-200">50 – 200</option>
                    <option value="200-500">200 – 500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>CA estimé</label>
                  <select name="revenue_range" style={sel}>
                    <option value="">— Non renseigné —</option>
                    <option value="< 1M€">&lt; 1M€</option>
                    <option value="1-5M€">1 – 5M€</option>
                    <option value="5-20M€">5 – 20M€</option>
                    <option value="20-100M€">20 – 100M€</option>
                    <option value="> 100M€">&gt; 100M€</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{isBuyer ? "Budget d'acquisition" : "Valorisation estimée"}</label>
                  <input name="valuation_range" style={inp} placeholder="ex: 5-15M€"/>
                </div>
                <div style={{ gridColumn:"1 / -1" }}>
                  <label style={lbl}>Description</label>
                  <textarea name="description" rows={3} style={{ ...inp, resize:"vertical" }}
                    placeholder="Activité principale, points différenciants…"/>
                </div>
              </div>
            </div>
          )}

          {/* Champs cabinet / conseil */}
          {["law_firm","advisor","accounting_firm","consulting_firm"].includes(type) && (
            <div style={section}>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:14 }}>Spécialités</div>
              <div>
                <label style={lbl}>Domaines d'expertise</label>
                <input name="sector" style={inp} placeholder="ex: M&A, Private Equity, Droit des sociétés…"/>
              </div>
              <div style={{ marginTop:12 }}>
                <label style={lbl}>Description</label>
                <textarea name="description" rows={2} style={{ ...inp, resize:"vertical" }}
                  placeholder="Positionnement, zone géographique, taille de dossiers…"/>
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={section}>
            <label style={lbl}>Notes internes</label>
            <textarea name="notes" rows={3} style={{ ...inp, resize:"vertical" }}
              placeholder="Informations complémentaires, contexte de la rencontre…"/>
          </div>

          {error && (
            <div style={{ padding:"10px 14px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, fontSize:13, color:"#dc2626", marginBottom:14 }}>
              {error}
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <Link href="/protected/organisations" style={{ padding:"9px 18px", borderRadius:9, border:"1px solid #d1d5db", background:"#fff", color:"#374151", textDecoration:"none", fontSize:13.5 }}>
              Annuler
            </Link>
            <button type="submit" disabled={loading} style={{ padding:"9px 22px", borderRadius:9, background:"#1a56db", color:"#fff", border:"none", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:loading?.6:1 }}>
              {loading ? "Création…" : "Créer l'organisation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
