"use client";
import { useEffect, useState } from "react";
import { ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnecteursContent() {
  const params = useSearchParams();
  const gcalSuccess = params.get("gcal") === "success";
  const [gcalConnected, setGcalConnected] = useState(gcalSuccess);

  return (
    <div style={{ padding:"28px 24px", maxWidth:700, margin:"0 auto" }}>
      <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text-1)", marginBottom:6 }}>Connecteurs</h1>
      <p style={{ fontSize:13.5, color:"var(--text-4)", marginBottom:28 }}>Intégrations externes pour enrichir et centraliser les données.</p>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

        {/* Google Calendar */}
        <div style={{ background:"var(--surface)", border:`1px solid ${gcalConnected?"#bbf7d0":"var(--border)"}`, borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📅</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Google Calendar</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Synchronise les tâches et événements avec ton agenda</div>
              </div>
            </div>
            {gcalConnected ? (
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:"#16a34a", fontWeight:600 }}>
                <CheckCircle size={14}/> Connecté
              </div>
            ) : (
              <a href="/api/gcal" style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:"#1a56db", color:"#fff", textDecoration:"none", fontSize:13, fontWeight:600 }}>
                Connecter
              </a>
            )}
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            {gcalConnected
              ? "✅ Connecté — le bouton Google Cal dans chaque tâche ajoute l'événement avec les contacts en participants."
              : "Nécessite GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local. Crée un projet sur console.cloud.google.com → APIs → Google Calendar API → OAuth2 credentials."}
          </div>
        </div>

        {/* Google Drive */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📁</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Google Drive</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Liez des documents Drive dans les dossiers</div>
              </div>
            </div>
            <a href="https://drive.google.com" target="_blank" rel="noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text-3)", textDecoration:"none", fontSize:13 }}>
              <ExternalLink size={12}/> Ouvrir Drive
            </a>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            Dans un dossier → Documents → "+ Ajouter" → colle le lien de partage Google Drive.
          </div>
        </div>

        {/* Pappers */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏛</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Pappers</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Enrichissement auto — SIRET, CA, effectif, dirigeants</div>
              </div>
            </div>
            <div style={{ fontSize:12, padding:"4px 10px", borderRadius:20, background:"var(--fund-bg)", color:"var(--fund-tx)", fontWeight:600 }}>Actif</div>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            Bouton "Enrichir" sur chaque fiche organisation. Clé : <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>PAPPERS_API_KEY</code> dans .env.local
          </div>
        </div>

        {/* Hunter */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔍</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Hunter.io</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Recherche d'emails professionnels</div>
              </div>
            </div>
            <div style={{ fontSize:12, padding:"4px 10px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-4)", fontWeight:600 }}>Optionnel</div>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            Bouton "Enrichir" sur chaque fiche contact. Clé : <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>HUNTER_API_KEY</code> dans .env.local
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ConnecteursPage() {
  return <Suspense fallback={null}><ConnecteursContent/></Suspense>;
}
