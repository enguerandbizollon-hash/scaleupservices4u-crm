"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Calendar, Mail, HardDrive, Building2, ArrowRight, Plus, ExternalLink, Check } from "lucide-react";

type Stat = "connected" | "disconnected" | "checking";

type GCalEvent = {
  id: string; title: string; starts_at: string; ends_at: string | null;
  location: string | null; meet_link: string | null; description: string | null; event_type: string;
};

type Deal = { id: string; name: string };

function StatusPill({ s }: { s: Stat }) {
  if (s === "checking") return <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color:"var(--text-4)",background:"var(--surface-2)",borderRadius:20,padding:"3px 10px" }}><Loader2 size={11} style={{ animation:"spin 1s linear infinite" }}/> Vérification</span>;
  if (s === "connected") return <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:"var(--deal-fundraising-text)",background:"var(--deal-fundraising-bg)",borderRadius:20,padding:"3px 10px" }}><CheckCircle size={11}/> Connecté</span>;
  return <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:"var(--deal-recruitment-text)",background:"var(--deal-recruitment-bg)",borderRadius:20,padding:"3px 10px" }}><XCircle size={11}/> Non connecté</span>;
}

function fmtDT(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }); }
  catch { return v; }
}

export default function ConnecteursPage() {
  const [googleStat, setGoogleStat] = useState<Stat>("checking");
  const [pappersStat, setPappersStat] = useState<Stat>("checking");

  // Calendar
  const [calEvents, setCalEvents] = useState<GCalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calLoaded, setCalLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [targetDeal, setTargetDeal] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  // Sync CRM → GCal
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Pappers
  const [pQuery, setPQuery] = useState("");
  const [pResults, setPResults] = useState<any[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [importedOrgs, setImportedOrgs] = useState(0);

  useEffect(() => {
    fetch("/api/auth/session").then(r=>r.json()).then(s=>setGoogleStat(s?.user?"connected":"disconnected")).catch(()=>setGoogleStat("disconnected"));
    fetch("/api/pappers?q=test").then(r=>r.json()).then(d=>setPappersStat(d.error?.includes("Clé")?"disconnected":"connected")).catch(()=>setPappersStat("disconnected"));
    fetch("/protected/dossiers").catch(()=>{});
    // Charger les dossiers
    fetch("/api/deals/list").then(r=>r.json()).then(d=>setDeals(d.deals??[])).catch(()=>{});
  }, []);

  async function loadCalEvents() {
    setCalLoading(true);
    const r = await fetch("/api/gcal/list");
    const d = await r.json();
    setCalEvents(d.events ?? []);
    setCalLoaded(true);
    setCalLoading(false);
    // Tout sélectionner par défaut
    setSelected(new Set((d.events??[]).map((e: GCalEvent) => e.id)));
  }

  function toggleEvent(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === calEvents.length) setSelected(new Set());
    else setSelected(new Set(calEvents.map(e => e.id)));
  }

  async function importSelected() {
    const toImport = calEvents.filter(e => selected.has(e.id));
    if (!toImport.length) return;
    setImporting(true);
    const r = await fetch("/api/gcal/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: toImport, deal_id: targetDeal || null }),
    });
    const d = await r.json();
    setImportResult(d);
    setImporting(false);
    setSelected(new Set());
  }

  async function syncToGCal() {
    setSyncing(true); setSyncResult(null);
    const r = await fetch("/api/gcal/sync", { method: "POST" });
    setSyncResult(await r.json()); setSyncing(false);
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
      <div style={{ maxWidth:820, margin:"0 auto" }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--su-600)", marginBottom:4 }}>INTÉGRATIONS</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"var(--text-1)", margin:0, letterSpacing:"-0.02em" }}>Connecteurs</h1>
          <p style={{ fontSize:13, color:"var(--text-3)", marginTop:6 }}>Synchronise tes outils avec le CRM.</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── GOOGLE ── */}
          <div className="su-card" style={{ overflow:"hidden" }}>
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
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <p style={{ fontSize:12, color:"var(--text-3)", margin:0 }}>Connecte ton compte Google pour activer Gmail, Calendar et Drive.</p>
                  <a href="/api/auth/signin/google" style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"var(--su-700)", color:"white", textDecoration:"none", fontSize:13, fontWeight:600 }}>
                    Connecter Google <ArrowRight size={13}/>
                  </a>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

                  {/* Features */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    {[
                      { icon:<Mail size={14}/>, label:"Gmail", desc:"Bouton ✉ sur les fiches contact" },
                      { icon:<Calendar size={14}/>, label:"Calendar", desc:"Import sélectif + export vers Google" },
                      { icon:<HardDrive size={14}/>, label:"Drive", desc:"Picker de fichiers dans les documents" },
                    ].map(f => (
                      <div key={f.label} style={{ padding:"12px 14px", borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, color:"var(--su-600)" }}>{f.icon}<span style={{ fontSize:12, fontWeight:700, color:"var(--text-1)" }}>{f.label}</span></div>
                        <p style={{ fontSize:11, color:"var(--text-3)", margin:0 }}>{f.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Import sélectif Calendar */}
                  <div style={{ borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
                    <div style={{ padding:"14px 18px", background:"var(--surface-2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-3)", display:"flex", alignItems:"center", gap:6 }}>
                        <Calendar size={13}/> IMPORTER DEPUIS GOOGLE CALENDAR
                      </div>
                      {!calLoaded ? (
                        <button onClick={loadCalEvents} disabled={calLoading}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:"none", background:"var(--su-700)", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          {calLoading ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <Calendar size={12}/>}
                          {calLoading ? "Chargement…" : "Voir mes événements"}
                        </button>
                      ) : (
                        <span style={{ fontSize:11, color:"var(--text-4)" }}>{calEvents.length} événement{calEvents.length>1?"s":""} (60 prochains jours)</span>
                      )}
                    </div>

                    {calLoaded && (
                      <div style={{ padding:"16px 18px" }}>
                        {/* Sélection + dossier */}
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                          <button onClick={toggleAll} style={{ fontSize:11, fontWeight:600, color:"var(--su-600)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                            {selected.size === calEvents.length ? "Tout désélectionner" : "Tout sélectionner"}
                          </button>
                          <span style={{ fontSize:11, color:"var(--text-4)" }}>{selected.size} sélectionné{selected.size>1?"s":""}</span>
                          <select value={targetDeal} onChange={e=>setTargetDeal(e.target.value)}
                            style={{ flex:1, minWidth:180, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"6px 10px", fontSize:12, color:"var(--text-1)", outline:"none" }}>
                            <option value="">Sans dossier associé</option>
                            {deals.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <button onClick={importSelected} disabled={importing || selected.size===0}
                            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"none", background: selected.size===0?"var(--border)":"var(--su-700)", color: selected.size===0?"var(--text-4)":"white", fontSize:12, fontWeight:600, cursor: selected.size===0?"not-allowed":"pointer" }}>
                            {importing ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <Plus size={12}/>}
                            {importing ? "Import…" : `Importer ${selected.size}`}
                          </button>
                        </div>

                        {/* Liste events */}
                        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:320, overflowY:"auto" }}>
                          {calEvents.map(ev => (
                            <div key={ev.id} onClick={()=>toggleEvent(ev.id)}
                              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:9, border:`1px solid ${selected.has(ev.id)?"var(--su-400)":"var(--border)"}`, background: selected.has(ev.id)?"var(--su-50)":"var(--surface)", cursor:"pointer" }}>
                              <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${selected.has(ev.id)?"var(--su-600)":"var(--border-2)"}`, background: selected.has(ev.id)?"var(--su-600)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                {selected.has(ev.id) && <Check size={11} color="white"/>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ev.title}</div>
                                <div style={{ fontSize:11, color:"var(--text-4)", marginTop:2 }}>
                                  {fmtDT(ev.starts_at)}{ev.location ? ` · 📍 ${ev.location}` : ""}{ev.meet_link ? " · 🎥 Meet" : ""}
                                </div>
                              </div>
                            </div>
                          ))}
                          {calEvents.length === 0 && <p style={{ fontSize:12, color:"var(--text-4)", textAlign:"center", padding:"20px 0" }}>Aucun événement dans les 60 prochains jours.</p>}
                        </div>

                        {/* Résultat import */}
                        {importResult && (
                          <div style={{ marginTop:12, padding:"10px 14px", borderRadius:9, background: importResult.errors.length?"var(--deal-ma-sell-bg)":"var(--deal-fundraising-bg)" }}>
                            <div style={{ fontWeight:700, color:"var(--deal-fundraising-text)", fontSize:12 }}>✓ {importResult.imported} événement{importResult.imported>1?"s":""} importé{importResult.imported>1?"s":""}</div>
                            {importResult.errors.map((e,i)=><div key={i} style={{ fontSize:11, color:"var(--deal-ma-sell-text)", marginTop:3 }}>• {e}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Export CRM → Google */}
                  <div style={{ padding:"14px 16px", borderRadius:12, border:"1px solid var(--border)", background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                    <div style={{ fontSize:12, color:"var(--text-2)" }}>
                      <span style={{ fontWeight:600 }}>Exporter vers Google Calendar</span>
                      <span style={{ color:"var(--text-4)", marginLeft:8 }}>Envoie tes événements CRM dans ton Google Calendar</span>
                    </div>
                    <button onClick={syncToGCal} disabled={syncing}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"white", color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      {syncing ? <Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/> : <RefreshCw size={12}/>}
                      {syncing ? "Export…" : "Exporter CRM → Google"}
                    </button>
                    {syncResult && <div style={{ width:"100%", fontSize:12, fontWeight:600, color:"var(--deal-fundraising-text)" }}>✓ {syncResult.synced} événement{syncResult.synced>1?"s":""} exporté{syncResult.synced>1?"s":""}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── PAPPERS / API GOV ── */}
          <div className="su-card" style={{ overflow:"hidden" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:"var(--deal-ma-buy-bg)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Building2 size={18} color="var(--deal-ma-buy-text)"/>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Données entreprises FR</div>
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:1 }}>API officielle gouvernementale — SIREN, SIRET, dirigeants</div>
                </div>
              </div>
              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:"var(--deal-fundraising-text)",background:"var(--deal-fundraising-bg)",borderRadius:20,padding:"3px 10px" }}><CheckCircle size={11}/> Gratuit</span>
            </div>
            <div style={{ padding:"18px 24px" }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"var(--text-3)", marginBottom:12 }}>RECHERCHER UNE ENTREPRISE — Nom ou SIRET</div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <input value={pQuery} onChange={e=>setPQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPappers()}
                  placeholder="Ex. Redpeaks ou 40351272600023…"
                  style={{ flex:1, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)", padding:"10px 14px", fontSize:13, color:"var(--text-1)", outline:"none" }}
                />
                <button onClick={searchPappers} disabled={pLoading}
                  style={{ padding:"10px 20px", borderRadius:10, background:"var(--su-700)", color:"white", fontSize:13, fontWeight:600, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                  {pLoading ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : null}
                  {pLoading ? "Recherche…" : "Chercher"}
                </button>
              </div>
              {importedOrgs > 0 && <div style={{ marginBottom:12, fontSize:12, fontWeight:700, color:"var(--deal-fundraising-text)" }}>✓ {importedOrgs} organisation{importedOrgs>1?"s":""} ajoutée{importedOrgs>1?"s":""} au CRM</div>}
              {pResults.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {pResults.slice(0,6).map((r,i) => (
                    <PappersResult key={i} r={r} onImported={()=>setImportedOrgs(c=>c+1)} />
                  ))}
                </div>
              )}
              {pResults.length===0 && pQuery && !pLoading && <p style={{ fontSize:12, color:"var(--text-4)", fontStyle:"italic" }}>Aucun résultat.</p>}
            </div>
          </div>

          {/* À VENIR */}
          <div className="su-card" style={{ padding:"18px 24px", opacity:0.5 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--text-4)", marginBottom:12 }}>PROCHAINS CONNECTEURS</div>
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

function PappersResult({ r, onImported }: { r: any; onImported: () => void }) {
  const [state, setState] = useState<"idle"|"loading"|"done"|"duplicate"|"error">("idle");
  const [dupId, setDupId] = useState("");

  async function importOrg() {
    setState("loading");
    const res = await fetch("/api/pappers/import", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ result: r }) });
    const data = await res.json();
    if (res.status === 409) { setState("duplicate"); setDupId(data.id); return; }
    if (!res.ok) { setState("error"); return; }
    setState("done"); onImported();
  }

  return (
    <div style={{ padding:"14px 16px", borderRadius:12, border:"1px solid var(--border)", background:"var(--surface)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", marginBottom:5 }}>{r.nom_entreprise}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, fontSize:11, color:"var(--text-3)" }}>
          {r.siren && <span style={{ background:"var(--su-50)", color:"var(--su-700)", borderRadius:6, padding:"2px 8px", fontWeight:700 }}>SIREN {r.siren}</span>}
          {r.siege?.commune && <span>📍 {r.siege.code_postal} {r.siege.commune}</span>}
          {r.activite_principale_libelle && <span>🏭 {r.activite_principale_libelle}</span>}
          {r.chiffre_affaires && <span>💰 {new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(r.chiffre_affaires)}</span>}
        </div>
        {r.dirigeants?.length > 0 && <div style={{ fontSize:11, color:"var(--text-4)", marginTop:5 }}>👤 {r.dirigeants.slice(0,3).map((d:any)=>`${d.prenoms??""} ${d.nom??""} (${d.qualite??""})`.trim()).join(" · ")}</div>}
      </div>
      <div style={{ flexShrink:0 }}>
        {state==="idle" && <button onClick={importOrg} style={{ display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:"var(--su-700)",color:"white",fontSize:12,fontWeight:600,border:"none",cursor:"pointer" }}><Plus size={12}/>Ajouter</button>}
        {state==="loading" && <span style={{ fontSize:11, color:"var(--text-3)", display:"flex", alignItems:"center", gap:4 }}><Loader2 size={12} style={{ animation:"spin 1s linear infinite" }}/>Import…</span>}
        {state==="done" && <span style={{ fontSize:12, fontWeight:700, color:"var(--deal-fundraising-text)", display:"flex", alignItems:"center", gap:4 }}><CheckCircle size={13}/>Ajoutée</span>}
        {state==="duplicate" && <div style={{ textAlign:"right" }}><div style={{ fontSize:11, color:"var(--deal-ma-sell-text)", fontWeight:600, marginBottom:3 }}>Déjà dans le CRM</div><a href={`/protected/organisations/${dupId}`} style={{ fontSize:11, color:"var(--su-600)", textDecoration:"none", fontWeight:600, display:"flex", alignItems:"center", gap:3 }}>Voir <ExternalLink size={10}/></a></div>}
        {state==="error" && <span style={{ fontSize:11, color:"var(--deal-recruitment-text)", fontWeight:600 }}>Erreur</span>}
      </div>
    </div>
  );
}
