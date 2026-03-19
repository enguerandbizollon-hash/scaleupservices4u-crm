"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ExternalLink, RefreshCw } from "lucide-react";

type ConnectorStatus = "connected" | "disconnected" | "checking";

export default function ConnecteursPage() {
  const [googleStatus, setGoogleStatus] = useState<ConnectorStatus>("checking");
  const [pappersStatus, setPappersStatus] = useState<ConnectorStatus>("checking");

  useEffect(() => {
    // Vérifier session Google
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(s => setGoogleStatus(s?.user ? "connected" : "disconnected"))
      .catch(() => setGoogleStatus("disconnected"));

    // Vérifier Pappers
    fetch("/api/pappers?q=test")
      .then(r => r.json())
      .then(d => setPappersStatus(d.error && d.error.includes("Clé") ? "disconnected" : "connected"))
      .catch(() => setPappersStatus("disconnected"));
  }, []);

  const connectors = [
    {
      id: "google",
      name: "Google Workspace",
      desc: "Gmail · Calendar · Drive",
      status: googleStatus,
      services: ["Gmail → sync emails en activités", "Calendar → sync agenda", "Drive → liens documents"],
      connectHref: "/api/auth/signin/google",
      disconnectHref: "/api/auth/signout",
      logo: "🔵",
    },
    {
      id: "pappers",
      name: "Pappers",
      desc: "Données entreprises françaises",
      status: pappersStatus,
      services: ["SIRET, dirigeants, bilans", "Enrichissement auto des organisations", "Kbis et actes"],
      connectHref: "https://pappers.fr/api",
      logo: "🏢",
    },
  ];

  return (
    <div style={{ padding: 32, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--su-600)", marginBottom: 4 }}>INTÉGRATIONS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Connecteurs</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>Connectez vos outils pour enrichir automatiquement le CRM.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {connectors.map(c => (
            <div key={c.id} className="su-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ fontSize: 32 }}>{c.logo}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{c.name}</span>
                      {c.status === "connected" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--deal-fundraising-dot)", background: "var(--deal-fundraising-bg)", padding: "2px 8px", borderRadius: 20 }}>
                          <CheckCircle size={11} /> Connecté
                        </span>
                      )}
                      {c.status === "disconnected" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--deal-recruitment-text)", background: "var(--deal-recruitment-bg)", padding: "2px 8px", borderRadius: 20 }}>
                          <XCircle size={11} /> Non connecté
                        </span>
                      )}
                      {c.status === "checking" && (
                        <span style={{ fontSize: 11, color: "var(--text-4)", display: "flex", alignItems: "center", gap: 4 }}>
                          <RefreshCw size={11} /> Vérification…
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, marginBottom: 10 }}>{c.desc}</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                      {c.services.map(s => (
                        <li key={s} style={{ fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--su-400)", flexShrink: 0, display: "inline-block" }} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.status !== "connected" ? (
                    <a href={c.connectHref} className="su-btn-primary" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, textDecoration: "none", fontSize: 12, fontWeight: 600, color: "white", background: "var(--su-700)" }}>
                      <ExternalLink size={12} /> Connecter
                    </a>
                  ) : (
                    <a href={c.disconnectHref} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, textDecoration: "none", fontSize: 12, fontWeight: 600, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      Déconnecter
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Guide rapide */}
        <div className="su-card" style={{ padding: 20, marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-4)", marginBottom: 12 }}>COMMENT ÇA FONCTIONNE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { title: "Gmail → Activités", desc: "Les emails échangés avec vos contacts sont automatiquement enregistrés comme activités sur le dossier concerné." },
              { title: "Calendar → Agenda", desc: "Les événements Google Calendar sont synchronisés dans l'agenda CRM et liés aux dossiers." },
              { title: "Drive → Documents", desc: "Ajoutez directement un lien Drive dans les documents d'un dossier. Un clic pour ouvrir." },
              { title: "Pappers → Organisations", desc: "Sur une fiche organisation, cliquez 'Enrichir' pour récupérer automatiquement SIRET, dirigeants et bilans." },
            ].map(item => (
              <div key={item.title} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
