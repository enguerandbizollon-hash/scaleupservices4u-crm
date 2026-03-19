"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Calendar, Mail, HardDrive, Building2, ArrowRight } from "lucide-react";

type Status = "connected"|"disconnected"|"checking"|"loading";

export default function ConnecteursPage() {
  const [googleStatus, setGoogleStatus] = useState<Status>("checking");
  const [pappersStatus, setPappersStatus] = useState<Status>("checking");
  const [calSyncResult, setCalSyncResult] = useState<{synced?:number;imported?:number;errors?:string[];total?:number}|null>(null);
  const [calAction, setCalAction] = useState<"idle"|"syncing"|"importing">("idle");
  const [pappersSearch, setPappersSearch] = useState("");
  const [pappersResults, setPappersResults] = useState<any[]>([]);
  const [pappersLoading, setPappersLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then(r=>r.json()).then(s=>setGoogleStatus(s?.user ? "connected" : "disconnected")).catch(()=>setGoogleStatus("disconnected"));
    fetch("/api/pappers?q=test").then(r=>r.json()).then(d=>setPappersStatus(d.error?.includes("Clé") ? "disconnected" : "connected")).catch(()=>setPappersStatus("disconnected"));
  }, []);

  async function syncToGCal() {
    setCalAction("syncing");
    const res = await fetch("/api/gcal/sync", { method: "POST" });
    const data = await res.json();
    setCalSyncResult(data);
    setCalAction("idle");
  }

  async function importFromGCal() {
    setCalAction("importing");
    const res = await fetch("/api/gcal/import", { method: "POST" });
    const data = await res.json();
    setCalSyncResult(data);
    setCalAction("idle");
  }

  async function searchPappers() {
    if (!pappersSearch.trim()) return;
    setPappersLoading(true);
    const res = await fetch(`/api/pappers?q=${encodeURIComponent(pappersSearch)}`);
    const data = await res.json();
    setPappersResults(data.resultats ?? []);
    setPappersLoading(false);
  }

  function StatusBadge({ s }: { s: Status }) {
    if (s === "checking") return <span style={{ fontSize: 11, color: "var(--text-4)", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={12} className="animate-spin" /> Vérification…</span>;
    if (s === "connected") return <span style={{ fontSize: 11, fontWeight: 700, color: "var(--deal-fundraising-text)", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={13} /> Connecté</span>;
    return <span style={{ fontSize: 11, fontWeight: 700, color: "var(--deal-recruitment-text)", display: "flex", alignItems: "center", gap: 4 }}><XCircle size={13} /> Non connecté</span>;
  }

  return (
    <div style={{ padding: 32, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--su-600)", marginBottom: 4 }}>INTÉGRATIONS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Connecteurs</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>Connecte tes outils externes au CRM.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Google */}
          <div className="su-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--su-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>G</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Google Workspace</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Gmail · Calendar · Drive</div>
                </div>
              </div>
              <StatusBadge s={googleStatus} />
            </div>

            {googleStatus === "disconnected" ? (
              <a href="/api/auth/signin/google" className="su-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
                Connecter Google <ArrowRight size={13} />
              </a>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Actions Calendar */}
                <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} /> Google Calendar
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={syncToGCal} disabled={calAction !== "idle"}
                      className="su-btn-secondary" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      {calAction === "syncing" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {calAction === "syncing" ? "Sync en cours…" : "Exporter vers Google Calendar"}
                    </button>
                    <button onClick={importFromGCal} disabled={calAction !== "idle"}
                      className="su-btn-secondary" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      {calAction === "importing" ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                      {calAction === "importing" ? "Import en cours…" : "Importer depuis Google Calendar"}
                    </button>
                  </div>
                  {calSyncResult && (
                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9, background: calSyncResult.errors?.length ? "var(--deal-ma-sell-bg)" : "var(--deal-fundraising-bg)", fontSize: 12 }}>
                      {"synced" in calSyncResult && <div style={{ color: "var(--deal-fundraising-text)", fontWeight: 600 }}>✓ {calSyncResult.synced} événement{(calSyncResult.synced??0)>1?"s":""} exporté{(calSyncResult.synced??0)>1?"s":""} sur {calSyncResult.total}</div>}
                      {"imported" in calSyncResult && <div style={{ color: "var(--deal-fundraising-text)", fontWeight: 600 }}>✓ {calSyncResult.imported} événement{(calSyncResult.imported??0)>1?"s":""} importé{(calSyncResult.imported??0)>1?"s":""} sur {calSyncResult.total}</div>}
                      {(calSyncResult.errors?.length ?? 0) > 0 && (
                        <div style={{ color: "var(--deal-ma-sell-text)", marginTop: 6 }}>
                          {calSyncResult.errors?.map((e,i) => <div key={i}>• {e}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
                    <Mail size={13} color="var(--su-600)" /> Gmail — bouton ✉ sur les fiches contact
                  </div>
                  <div style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
                    <HardDrive size={13} color="var(--su-600)" /> Drive — picker dans les documents
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pappers */}
          <div className="su-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--deal-ma-buy-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={18} color="var(--deal-ma-buy-text)" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Pappers</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Données entreprises françaises — SIREN, dirigeants, bilans</div>
                </div>
              </div>
              <StatusBadge s={pappersStatus} />
            </div>

            {pappersStatus === "disconnected" ? (
              <div>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>Ajoute ta clé API dans <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: 5 }}>.env.local</code> : <code>PAPPERS_API_KEY=...</code></p>
                <a href="https://www.pappers.fr/api" target="_blank" rel="noreferrer" className="su-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12 }}>
                  Obtenir une clé Pappers <ArrowRight size={12} />
                </a>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>Tester la recherche Pappers</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input value={pappersSearch} onChange={e => setPappersSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchPappers()}
                    placeholder="Nom d'entreprise ou SIRET…" className="su-input" style={{ flex: 1, fontSize: 12 }} />
                  <button onClick={searchPappers} disabled={pappersLoading} className="su-btn-primary"
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "9px 16px" }}>
                    {pappersLoading ? <Loader2 size={12} className="animate-spin" /> : "Chercher"}
                  </button>
                </div>
                {pappersResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pappersResults.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{r.nom_entreprise}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {r.siren && <span>SIREN: {r.siren}</span>}
                          {r.siege?.ville && <span>📍 {r.siege.code_postal} {r.siege.ville}</span>}
                          {r.domaine_activite && <span>🏭 {r.domaine_activite}</span>}
                          {r.chiffre_affaires && <span>💰 CA: {new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(r.chiffre_affaires)}</span>}
                        </div>
                        {r.dirigeants?.length > 0 && (
                          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
                            👤 {r.dirigeants.slice(0,3).map((d:any) => `${d.prenom??""} ${d.nom??""} (${d.qualite??""})`.trim()).join(" · ")}
                          </div>
                        )}
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: "var(--text-4)", fontStyle: "italic" }}>
                      Ce bouton "Enrichir" est disponible sur chaque fiche organisation pour pré-remplir automatiquement les données.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
