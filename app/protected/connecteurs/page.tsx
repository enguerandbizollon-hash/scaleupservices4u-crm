"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Calendar, Mail, HardDrive, Building2, ArrowRight, Plug } from "lucide-react";

type Stat = "connected" | "disconnected" | "checking";

function StatusPill({ s }: { s: Stat }) {
  if (s === "checking") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"var(--text-4)", background:"var(--surface-2)", borderRadius:20, padding:"3px 10px" }}>
      <Loader2 size={11} style={{ animation:"spin 1s linear infinite" }} /> Vérification
    </span>
  );
  if (s === "connected") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"var(--deal-fundraising-text)", background:"var(--deal-fundraising-bg)", borderRadius:20, padding:"3px 10px" }}>
      <CheckCircle size={11} /> Connecté
    </span>
  );
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"var(--deal-recruitment-text)", background:"var(--deal-recruitment-bg)", borderRadius:20, padding:"3px 10px" }}>
      <XCircle size={11} /> Non connecté
    </span>
  );
}

function FeatureLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--text-2)", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ color:"var(--su-600)", flexShrink:0 }}>{icon}</span>
      {label}
    </div>
  );
}

export default function ConnecteursPage() {
  const [googleStat, setGoogleStat] = useState<Stat>("checking");
  const [pappersStat, setPappersStat] = useState<Stat>("checking");
  const [calAction, setCalAction] = useState<"idle"|"syncing"|"importing">("idle");
  const [calResult, setCalResult] = useState<{ synced?:number; imported?:number; errors?:string[]; total?:number }|null>(null);
  const [pQuery, setPQuery] = useState("");
  const [pResults, setPResults] = useState<any[]>([]);
  const [pLoading, setPLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then(r=>r.json())
      .then(s => setGoogleStat(s?.user ? "connected" : "disconnected"))
      .catch(() => setGoogleStat("disconnected"));
    fetch("/api/pappers?q=test").then(r=>r.json())
      .then(d => setPappersStat(d.error?.includes("Clé") ? "disconnected" : "connected"))
      .catch(() => setPappersStat("disconnected"));
  }, []);

  async function syncToGCal() {
    setCalAction("syncing"); setCalResult(null);
    const r = await fetch("/api/gcal/sync", { method:"POST" });
    setCalResult(await r.json()); setCalAction("idle");
  }

  async function importFromGCal() {
    setCalAction("importing"); setCalResult(null);
    const r = await fetch("/api/gcal/import", { method:"POST" });
    setCalResult(await r.json()); setCalAction("idle");
  }

  async function searchPappers() {
    if (!pQuery.trim()) return;
    setPLoading(true); setPResults([]);
    const r = await fetch(`/api/pappers?q=${encodeURIComponent(pQuery)}`);
    const d = await r.json();
    setPResults(d.resultats ?? []); setPLoading(false);
  }

  return (
    <div style={{ padding:32, minHeight:"100vh", background:"var(--bg)" }}>
      <div style={{ maxWidth:780, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>INTÉGRATIONS</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Connecteurs</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:6 }}>Connecte tes outils au CRM pour enrichir automatiquement tes données.</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── GOOGLE ── */}
          <div className="su-card" style={{ overflow:"hidden" }}>
            {/* Card header */}
            <div style={{ padding:"18px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:"var(--su-50)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, color:"var(--su-700)" }}>G</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Google Workspace</div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:1 }}>Gmail · Calendar · Drive</div>
                </div>
              </div>
              <StatusPill s={googleStat} />
            </div>

            <div style={{ padding:"18px 24px" }}>
              {googleStat === "disconnected" ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                  <p style={{ fontSize:12, color:"var(--text-3)", margin:0 }}>
                    Connecte ton compte Google pour activer Gmail, Calendar et Drive dans le CRM.
                  </p>
                  <a href="/api/auth/signin/google"
                    style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600, flexShrink:0 }}>
                    Connecter Google <ArrowRight size={13} />
                  </a>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

                  {/* Features actives */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    {[
                      { icon:<Mail size={14}/>, label:"Gmail", desc:"Envoyer un email depuis une fiche contact" },
                      { icon:<Calendar size={14}/>, label:"Calendar", desc:"Sync agenda bidirectionnel" },
                      { icon:<HardDrive size={14}/>, label:"Drive", desc:"Picker de fichiers dans les documents" },
                    ].map(f => (
                      <div key={f.label} style={{ padding:"12px 14px", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, color:"var(--su-600)" }}>
                          {f.icon}
                          <span style={{ fontSize:12, fontWeight:700, color:"var(--text-1)" }}>{f.label}</span>
                        </div>
                        <p style={{ fontSize:11, color:"var(--text-3)", margin:0 }}>{f.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Calendar actions */}
                  <div style={{ padding:"16px 18px", borderRadius:12, border:"1px solid var(--border)", background:"var(--surface-2)" }}>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-3)", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
                      <Calendar size={13} /> SYNCHRONISATION CALENDAR
                    </div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <button onClick={syncToGCal} disabled={calAction !== "idle"}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {calAction === "syncing" ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <RefreshCw size={12}/>}
                        {calAction === "syncing" ? "Export en cours…" : "Exporter CRM → Google"}
                      </button>
                      <button onClick={importFromGCal} disabled={calAction !== "idle"}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {calAction === "importing" ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <Calendar size={12}/>}
                        {calAction === "importing" ? "Import en cours…" : "Importer Google → CRM"}
                      </button>
                    </div>

                    {calResult && (
                      <div style={{ marginTop:12, padding:"10px 14px", borderRadius:9, background: calResult.errors?.length ? "var(--deal-ma-sell-bg)" : "var(--deal-fundraising-bg)", fontSize:12 }}>
                        {"synced" in calResult && (
                          <div style={{ fontWeight:700, color:"var(--deal-fundraising-text)" }}>
                            ✓ {calResult.synced} événement{(calResult.synced??0)>1?"s":""} exporté{(calResult.synced??0)>1?"s":""} sur {calResult.total}
                          </div>
                        )}
                        {"imported" in calResult && (
                          <div style={{ fontWeight:700, color:"var(--deal-fundraising-text)" }}>
                            ✓ {calResult.imported} événement{(calResult.imported??0)>1?"s":""} importé{(calResult.imported??0)>1?"s":""} sur {calResult.total}
                          </div>
                        )}
                        {(calResult.errors?.length ?? 0) > 0 && (
                          <div style={{ color:"var(--deal-ma-sell-text)", marginTop:6 }}>
                            {calResult.errors?.map((e,i) => <div key={i} style={{ marginBottom:2 }}>• {e}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── PAPPERS ── */}
          <div className="su-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:"var(--deal-ma-buy-bg)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Building2 size={18} color="var(--deal-ma-buy-text)" />
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Pappers</div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:1 }}>SIREN · Dirigeants · Bilans · Données légales FR</div>
                </div>
              </div>
              <StatusPill s={pappersStat} />
            </div>

            <div style={{ padding:"18px 24px" }}>
              {pappersStat === "disconnected" ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                  <p style={{ fontSize:12, color:"var(--text-3)", margin:0 }}>
                    Ajoute <code style={{ background:"var(--surface-2)", padding:"2px 6px", borderRadius:5, fontSize:11 }}>PAPPERS_API_KEY=...</code> dans ton fichier <code style={{ background:"var(--surface-2)", padding:"2px 6px", borderRadius:5, fontSize:11 }}>.env.local</code>
                  </p>
                  <a href="https://www.pappers.fr/api" target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"var(--su-50)", color:"var(--su-700)", textDecoration:"none", fontSize:13, fontWeight:600, border:"1px solid var(--border)", flexShrink:0 }}>
                    Obtenir une clé <ArrowRight size={13} />
                  </a>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-3)", marginBottom:12 }}>TESTER LA RECHERCHE</div>
                  <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                    <input value={pQuery} onChange={e=>setPQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPappers()}
                      placeholder="Nom d'entreprise ou SIRET…"
                      style={{ flex:1, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"10px 14px", fontSize:13, color:"var(--text-1)", outline:"none" }}
                    />
                    <button onClick={searchPappers} disabled={pLoading}
                      style={{ padding:"10px 20px", borderRadius:10, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                      {pLoading ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : null}
                      {pLoading ? "Recherche…" : "Chercher"}
                    </button>
                  </div>

                  {pResults.length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {pResults.slice(0,5).map((r,i)=>(
                        <div key={i} style={{ padding:"12px 16px", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)" }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:4 }}>{r.nom_entreprise}</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:12, fontSize:11, color:"var(--text-3)" }}>
                            {r.siren && <span style={{ background:"var(--su-50)", color:"var(--su-700)", borderRadius:5, padding:"2px 8px", fontWeight:600 }}>SIREN {r.siren}</span>}
                            {r.siege?.ville && <span>📍 {r.siege.code_postal} {r.siege.ville}</span>}
                            {r.domaine_activite && <span>🏭 {r.domaine_activite}</span>}
                            {r.chiffre_affaires && <span>💰 {new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(r.chiffre_affaires)}</span>}
                          </div>
                          {r.dirigeants?.length > 0 && (
                            <div style={{ fontSize:11, color:"var(--text-4)", marginTop:6 }}>
                              👤 {r.dirigeants.slice(0,3).map((d:any)=>`${d.prenom??""} ${d.nom??""} (${d.qualite??""})`.trim()).join(" · ")}
                            </div>
                          )}
                        </div>
                      ))}
                      <p style={{ fontSize:11, color:"var(--text-4)", fontStyle:"italic", margin:"4px 0 0" }}>
                        Le bouton "Enrichir depuis Pappers" est disponible sur chaque fiche organisation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── À VENIR ── */}
          <div className="su-card" style={{ padding:"18px 24px", opacity:0.5 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--text-4)", marginBottom:14 }}>PROCHAINS CONNECTEURS</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {["Yousign (NDA / mandats)", "LinkedIn (enrichissement contacts)", "Slack (notifications)", "Stripe (facturation)"].map(l=>(
                <span key={l} style={{ fontSize:12, padding:"6px 12px", borderRadius:8, border:"1px dashed var(--border)", color:"var(--text-3)" }}>{l}</span>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
